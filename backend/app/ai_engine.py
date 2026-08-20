import os
import time
import math
import logging
from typing import Dict, Any, List, Optional, Tuple

# Prevent Matplotlib from freezing on macOS system font scan or creating temp directories
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TEMP_DIR = os.path.join(BASE_DIR, "backend", "uploads", "temp")
os.makedirs(TEMP_DIR, exist_ok=True)
os.environ["MPLCONFIGDIR"] = os.path.join(TEMP_DIR, "matplotlib")

# Set PyTorch CPU thread count to 1 to prevent severe thread thrashing on cloud platforms like Render
try:
    import torch
    torch.set_num_threads(1)
    torch.set_num_interop_threads(1)
except Exception:
    pass

from PIL import Image, ImageStat

logger = logging.getLogger("civora.ai")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)

MODEL_DIR = os.path.join(BASE_DIR, "trained_model")

GARBAGE_MODEL_PATH = os.path.join(MODEL_DIR, "garbage_best.pt")
POTHOLE_MODEL_PATH = os.path.join(MODEL_DIR, "pothole_best.pt")
STREETLIGHT_MODEL_PATH = os.path.join(MODEL_DIR, "streetlight_best.pt")

_models_loaded = False
_garbage_model = None
_pothole_model = None
_streetlight_model = None

# Internal model keys mapped to user-facing labels and API categories
ISSUE_CONFIG: Dict[str, Dict[str, str]] = {
    "Pothole": {
        "issue": "Pothole",
        "category": "road",
        "department": "Public Works Department (PWD)",
        "reason": "A road-surface depression consistent with a pothole was detected in the uploaded image.",
        "message": "Pothole detected successfully.",
    },
    "Garbage": {
        "issue": "Garbage / Waste",
        "category": "sanitation",
        "department": "Municipal Sanitation Department",
        "reason": "Accumulated waste or debris consistent with a garbage dumping area was detected in the uploaded image.",
        "message": "Garbage accumulation detected successfully.",
    },
    "Streetlight": {
        "issue": "Streetlight / Electrical",
        "category": "electrical",
        "department": "Electrical Wing",
        "reason": "A non-functional or damaged streetlight was detected in the uploaded image.",
        "message": "Streetlight issue detected successfully.",
    },
}

CLASS_THRESHOLDS = {
    "Pothole": 0.60,
    "Garbage": 0.55,
    "Streetlight": 0.12,
}

CLASS_IMGSZ = {
    "Pothole": 416,
    "Garbage": 640,
    "Streetlight": 640,
}

MIN_BBOX_AREA_RATIOS = {
    "Pothole": 0.001,
    "Garbage": 0.002,
    "Streetlight": 0.0001,
}

CATEGORY_ALIASES = {
    "road": "Pothole",
    "pothole": "Pothole",
    "garbage": "Garbage",
    "waste": "Garbage",
    "streetlight": "Streetlight",
    "light": "Streetlight",
    "electrical": "Streetlight",
}


def clamp_confidence(value: Optional[float]) -> float:
    if value is None or not isinstance(value, (int, float)):
        return 0.0
    if math.isnan(value) or math.isinf(value):
        return 0.0
    return round(max(0.0, min(1.0, float(value))), 3)


def load_ai_models() -> bool:
    """Load YOLO models once at startup and cache in memory."""
    global _models_loaded, _garbage_model, _pothole_model, _streetlight_model
    if _models_loaded:
        return True

    logger.info("[AI] Loading models into memory...")
    start_time = time.time()

    try:
        from ultralytics import YOLO

        if os.path.exists(GARBAGE_MODEL_PATH):
            g_start = time.time()
            _garbage_model = YOLO(GARBAGE_MODEL_PATH)
            logger.info(f"[AI] Garbage model loaded in {(time.time() - g_start) * 1000:.1f} ms")

        if os.path.exists(POTHOLE_MODEL_PATH):
            p_start = time.time()
            _pothole_model = YOLO(POTHOLE_MODEL_PATH)
            logger.info(f"[AI] Pothole model loaded in {(time.time() - p_start) * 1000:.1f} ms")

        if os.path.exists(STREETLIGHT_MODEL_PATH):
            s_start = time.time()
            _streetlight_model = YOLO(STREETLIGHT_MODEL_PATH)
            logger.info(f"[AI] Streetlight model loaded in {(time.time() - s_start) * 1000:.1f} ms")

        total_time = (time.time() - start_time) * 1000
        has_any_model = any([_garbage_model, _pothole_model, _streetlight_model])
        if not has_any_model:
            logger.error("[AI] No model weight files found in trained_model/")
            _models_loaded = False
            return False

        logger.info(f"[AI] All models successfully loaded into memory in {total_time:.1f} ms")
        _models_loaded = True
        return True
    except Exception as e:
        logger.error(f"[AI] Failed to load YOLO models: {e}")
        _models_loaded = False
        return False


def check_image_quality(image_path: str) -> Dict[str, Any]:
    """Cheap pre-inference image check for dimensions, corruption, and extreme blur."""
    if not os.path.exists(image_path):
        return {"valid": False, "reason": "Image file not found."}

    try:
        with Image.open(image_path) as img:
            img.verify()

        with Image.open(image_path) as img:
            width, height = img.size
            if width < 80 or height < 80:
                return {
                    "valid": False,
                    "reason": "Image dimensions are too small for reliable analysis.",
                }

            stat = ImageStat.Stat(img.convert("L"))
            var = stat.var[0] if stat.var else 0.0
            if var < 5.0:
                return {
                    "valid": False,
                    "reason": "Image appears blank or has insufficient contrast for analysis.",
                }

        return {"valid": True, "reason": "Image quality passed."}
    except Exception as e:
        return {"valid": False, "reason": f"Corrupted or invalid image file: {e}"}


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance formula in meters."""
    R = 6371000
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def predict_priority(issue_key: str, confidence: float, bbox_area_ratio: float = 0.01, detection_count: int = 1) -> str:
    if issue_key == "Pothole":
        if confidence >= 0.85 or bbox_area_ratio >= 0.05:
            return "High"
        if confidence >= 0.65 or bbox_area_ratio >= 0.02:
            return "Medium"
        return "Low"
    if issue_key == "Garbage":
        if detection_count >= 2 or bbox_area_ratio >= 0.08 or confidence >= 0.85:
            return "High"
        if confidence >= 0.65:
            return "Medium"
        return "Low"
    if issue_key == "Streetlight":
        if confidence >= 0.50 or bbox_area_ratio >= 0.01:
            return "High"
        if confidence >= 0.25:
            return "Medium"
        return "Low"
    return "Medium"


def _build_response(
    *,
    is_civic_issue: bool,
    issue_key: Optional[str],
    confidence: float,
    priority: Optional[str],
    reason: str,
    message: str,
    analysis_time_seconds: float,
) -> Dict[str, Any]:
    if is_civic_issue and issue_key:
        cfg = ISSUE_CONFIG[issue_key]
        return {
            "is_civic_issue": True,
            "issue": cfg["issue"],
            "category": cfg["category"],
            "confidence": clamp_confidence(confidence),
            "priority": priority,
            "department": cfg["department"],
            "reason": reason or cfg["reason"],
            "message": message or cfg["message"],
            "duplicate_group": None,
            "analysis_time_seconds": round(analysis_time_seconds, 3),
        }

    return {
        "is_civic_issue": False,
        "issue": "Not a Civic Issue",
        "category": None,
        "confidence": clamp_confidence(confidence),
        "priority": None,
        "department": None,
        "reason": reason,
        "message": message,
        "duplicate_group": None,
        "analysis_time_seconds": round(analysis_time_seconds, 3),
    }


def _select_target_models(expected_category: Optional[str]) -> Tuple[Dict[str, Any], str]:
    normalized = (expected_category or "").strip().lower()
    models: Dict[str, Any] = {}

    if normalized in ["road", "pothole"]:
        if _pothole_model:
            models["Pothole"] = _pothole_model
        return models, "explicit:road"

    if normalized in ["garbage", "waste"]:
        if _garbage_model:
            models["Garbage"] = _garbage_model
        return models, "explicit:garbage"

    if normalized in ["streetlight", "light", "electrical"]:
        if _streetlight_model:
            models["Streetlight"] = _streetlight_model
        return models, "explicit:streetlight"

    if normalized in ["water", "drainage", "public-space", "parks", "other"]:
        return {}, f"unsupported:{normalized}"

    if _pothole_model:
        models["Pothole"] = _pothole_model
    if _garbage_model:
        models["Garbage"] = _garbage_model
    if _streetlight_model:
        models["Streetlight"] = _streetlight_model
    return models, "auto"


def run_civora_ai(image_path: str, expected_category: Optional[str] = None) -> Dict[str, Any]:
    """
    Optimized AI prediction pipeline using cached YOLO models.
    The uploaded image always drives classification; no filename or hardcoded fallbacks.
    """
    total_start = time.time()
    logger.info("[AI] REQUEST RECEIVED")
    logger.info(f"[AI] image_path = {image_path}")
    logger.info(f"[AI] expected_category = {expected_category}")

    load_start = time.time()
    models_ready = load_ai_models()
    load_time_ms = (time.time() - load_start) * 1000
    logger.info(f"[AI] model initialization = {load_time_ms:.1f} ms")

    if not models_ready:
        elapsed = time.time() - total_start
        logger.error("[AI] decision = ERROR (models unavailable)")
        return _build_response(
            is_civic_issue=False,
            issue_key=None,
            confidence=0.0,
            priority=None,
            reason="AI inference models could not be loaded. Unable to analyze the uploaded image.",
            message="Unable to analyze image at this time. Please try again later.",
            analysis_time_seconds=elapsed,
        )

    prep_start = time.time()
    quality = check_image_quality(image_path)
    prep_time_ms = (time.time() - prep_start) * 1000
    logger.info(f"[AI] image read = {prep_time_ms:.1f} ms")
    logger.info(f"[AI] preprocessing = {prep_time_ms:.1f} ms")

    if not quality["valid"]:
        elapsed = time.time() - total_start
        logger.info(f"[AI] decision = REJECT (Invalid Image: {quality['reason']})")
        return _build_response(
            is_civic_issue=False,
            issue_key=None,
            confidence=0.0,
            priority=None,
            reason=f"Image quality check failed: {quality['reason']}",
            message="Image quality is too low for reliable analysis. Please upload a clearer photo.",
            analysis_time_seconds=elapsed,
        )

    image_area = 1.0
    try:
        with Image.open(image_path) as img:
            image_area = float(img.width * img.height)
    except Exception:
        pass

    target_models, mode = _select_target_models(expected_category)
    logger.info(f"[AI] routing mode = {mode}")

    if mode.startswith("unsupported:"):
        elapsed = time.time() - total_start
        selected = mode.split(":", 1)[1]
        logger.info(f"[AI] decision = REJECT (unsupported category: {selected})")
        return _build_response(
            is_civic_issue=False,
            issue_key=None,
            confidence=0.0,
            priority=None,
            reason=(
                f"The selected category ('{expected_category}') is not supported by automated AI vision. "
                "Please choose Pothole, Garbage / Waste, or Streetlight / Electrical."
            ),
            message="No supported civic issue detected for the selected category.",
            analysis_time_seconds=elapsed,
        )

    if not target_models:
        elapsed = time.time() - total_start
        logger.error("[AI] decision = ERROR (no models available for selected route)")
        return _build_response(
            is_civic_issue=False,
            issue_key=None,
            confidence=0.0,
            priority=None,
            reason="Required AI model for the selected category is unavailable.",
            message="Unable to analyze image at this time.",
            analysis_time_seconds=elapsed,
        )

    final_detections: List[Dict[str, Any]] = []
    raw_scores: List[Tuple[str, float]] = []
    total_inference_start = time.time()

    for issue_key, model in target_models.items():
        m_start = time.time()
        try:
            min_conf = CLASS_THRESHOLDS.get(issue_key, 0.50)
            imgsz = CLASS_IMGSZ.get(issue_key, 416)
            predict_conf = 0.10 if issue_key == "Streetlight" else 0.25

            results = model.predict(
                source=image_path,
                conf=predict_conf,
                imgsz=imgsz,
                device="cpu",
                verbose=False,
            )
            m_time = (time.time() - m_start) * 1000
            logger.info(f"[AI] {issue_key} inference = {m_time:.1f} ms (imgsz={imgsz})")

            best_raw_for_model = 0.0
            for result in results:
                if result.boxes is None:
                    continue
                for box in result.boxes:
                    confidence = float(box.conf[0])
                    best_raw_for_model = max(best_raw_for_model, confidence)
                    x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                    bbox_area = float((x2 - x1) * (y2 - y1))
                    bbox_ratio = bbox_area / image_area if image_area > 0 else 0.001
                    min_ratio = MIN_BBOX_AREA_RATIOS.get(issue_key, 0.0001)

                    if confidence >= min_conf and bbox_ratio >= min_ratio:
                        final_detections.append({
                            "issue_key": issue_key,
                            "confidence": round(confidence, 3),
                            "bbox": [x1, y1, x2, y2],
                            "bbox_ratio": round(bbox_ratio, 5),
                        })

            if best_raw_for_model > 0:
                raw_scores.append((issue_key, best_raw_for_model))
                logger.info(f"[AI] {issue_key} best raw confidence = {best_raw_for_model:.3f}")
        except Exception as e:
            logger.error(f"[AI] {issue_key} prediction error: {e}")

    total_inference_time = (time.time() - total_inference_start) * 1000
    logger.info(f"[AI] inference = {total_inference_time:.1f} ms")

    post_start = time.time()

    if final_detections:
        issue_counts: Dict[str, int] = {}
        for d in final_detections:
            issue_counts[d["issue_key"]] = issue_counts.get(d["issue_key"], 0) + 1

        best_detection = max(final_detections, key=lambda x: x["confidence"])
        best_issue_key = best_detection["issue_key"]
        best_conf = best_detection["confidence"]
        best_ratio = best_detection["bbox_ratio"]

        unique_classes = set(d["issue_key"] for d in final_detections)
        if len(unique_classes) > 1 and mode == "auto":
            sorted_confs = sorted([d["confidence"] for d in final_detections], reverse=True)
            if len(sorted_confs) >= 2 and (sorted_confs[0] - sorted_confs[1]) < 0.20:
                elapsed = time.time() - total_start
                logger.info("[AI] decision = REJECT ambiguous conflicting detections")
                return _build_response(
                    is_civic_issue=False,
                    issue_key=None,
                    confidence=clamp_confidence(sorted_confs[0]),
                    priority=None,
                    reason="The image contains ambiguous visual evidence across multiple issue types. Please upload a clearer photo.",
                    message="Unable to classify confidently.",
                    analysis_time_seconds=elapsed,
                )

        cfg = ISSUE_CONFIG[best_issue_key]
        priority = predict_priority(
            best_issue_key,
            best_conf,
            best_ratio,
            issue_counts.get(best_issue_key, 1),
        )
        reason = (
            f"{cfg['reason']} Detection confidence: {best_conf:.0%}."
        )
        elapsed = time.time() - total_start
        post_time_ms = (time.time() - post_start) * 1000
        logger.info(f"[AI] postprocessing = {post_time_ms:.1f} ms")
        logger.info(f"[AI] decision = ACCEPT ({cfg['issue']}, conf={best_conf})")
        logger.info(f"[AI] TOTAL = {(elapsed * 1000):.1f} ms")

        return _build_response(
            is_civic_issue=True,
            issue_key=best_issue_key,
            confidence=best_conf,
            priority=priority,
            reason=reason,
            message=cfg["message"],
            analysis_time_seconds=elapsed,
        )

    # No detections above threshold — use highest raw model score as confidence signal
    max_raw_conf = max((score for _, score in raw_scores), default=0.0)
    elapsed = time.time() - total_start
    post_time_ms = (time.time() - post_start) * 1000
    logger.info(f"[AI] postprocessing = {post_time_ms:.1f} ms")
    logger.info(f"[AI] decision = REJECT no reliable detections (max_raw={max_raw_conf:.3f})")
    logger.info(f"[AI] TOTAL = {(elapsed * 1000):.1f} ms")

    if mode.startswith("explicit:"):
        requested = CATEGORY_ALIASES.get((expected_category or "").strip().lower(), expected_category)
        reason = (
            f"No reliable evidence of {requested or 'the selected issue'} was found in the uploaded image. "
            f"Highest model confidence was {max_raw_conf:.0%}."
        )
    else:
        reason = (
            "No reliable pothole, garbage accumulation, or streetlight issue was detected in the uploaded image. "
            f"Highest model confidence was {max_raw_conf:.0%}."
        )

    return _build_response(
        is_civic_issue=False,
        issue_key=None,
        confidence=max_raw_conf,
        priority=None,
        reason=reason,
        message="Image does not appear to contain a supported civic issue.",
        analysis_time_seconds=elapsed,
    )


def find_duplicate(
    new_issue: str,
    new_lat: Optional[float],
    new_lng: Optional[float],
    existing_complaints: List[Dict[str, Any]],
    threshold_meters: float = 100.0,
) -> Dict[str, Any]:
    if new_lat is None or new_lng is None:
        return {"is_duplicate": False, "duplicate_of": None, "distance_meters": None}

    for old in existing_complaints:
        old_issue = old.get("category") or old.get("issue")
        old_lat = old.get("latitude") or old.get("lat")
        old_lng = old.get("longitude") or old.get("lng")

        if not old_issue or old_lat is None or old_lng is None:
            continue

        if old_issue.lower() not in new_issue.lower() and new_issue.lower() not in old_issue.lower():
            continue

        try:
            distance = calculate_distance(float(new_lat), float(new_lng), float(old_lat), float(old_lng))
            if distance <= threshold_meters:
                return {
                    "is_duplicate": True,
                    "duplicate_of": old.get("id") or old.get("complaint_id"),
                    "distance_meters": round(distance, 2),
                }
        except Exception:
            continue

    return {"is_duplicate": False, "duplicate_of": None, "distance_meters": None}
