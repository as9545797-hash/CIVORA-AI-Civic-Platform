import os
import time
import math
import logging
from typing import Dict, Any, List, Optional

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

# Class-specific confidence thresholds matching empirical model behavior
CLASS_THRESHOLDS = {
    "Pothole": 0.60,       # Pothole model true positive conf ~0.91 vs false positive ~0.52
    "Garbage": 0.55,       # Garbage model true positive conf ~0.73 at imgsz=640
    "Streetlight": 0.12    # Streetlight model raw confidence is ~0.15 at imgsz=640
}

# Class-specific image sizes for optimal inference
CLASS_IMGSZ = {
    "Pothole": 416,
    "Garbage": 640,         # 640px required for garbage model to localize waste & eliminate false positives
    "Streetlight": 640      # Higher resolution needed for small streetlight objects
}

MIN_BBOX_AREA_RATIOS = {
    "Pothole": 0.001,       # 0.1% of image area
    "Garbage": 0.002,       # 0.2% of image area
    "Streetlight": 0.0001   # 0.01% of image area
}


def load_ai_models() -> bool:
    """
    Load YOLO models once at startup and cache in memory.
    """
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
            g_time = (time.time() - g_start) * 1000
            logger.info(f"[AI] Garbage model loaded in {g_time:.1f} ms")

        if os.path.exists(POTHOLE_MODEL_PATH):
            p_start = time.time()
            _pothole_model = YOLO(POTHOLE_MODEL_PATH)
            p_time = (time.time() - p_start) * 1000
            logger.info(f"[AI] Pothole model loaded in {p_time:.1f} ms")

        if os.path.exists(STREETLIGHT_MODEL_PATH):
            s_start = time.time()
            _streetlight_model = YOLO(STREETLIGHT_MODEL_PATH)
            s_time = (time.time() - s_start) * 1000
            logger.info(f"[AI] Streetlight model loaded in {s_time:.1f} ms")

        total_time = (time.time() - start_time) * 1000
        logger.info(f"[AI] All models successfully loaded into memory in {total_time:.1f} ms")
        _models_loaded = True
        return True
    except Exception as e:
        logger.error(f"[AI] Failed to load YOLO models: {e}")
        _models_loaded = False
        return False


def check_image_quality(image_path: str) -> Dict[str, Any]:
    """
    Cheap pre-inference image check for dimensions, corruption, and extreme blur.
    """
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
                    "reason": "Image dimensions are too small for reliable analysis."
                }
            
            # Convert to grayscale to check variance/blank image
            stat = ImageStat.Stat(img.convert("L"))
            var = stat.var[0] if stat.var else 0.0
            if var < 5.0:  # Extremely flat/blank image
                return {
                    "valid": False,
                    "reason": "Image appears blank or has insufficient contrast for analysis."
                }

        return {"valid": True, "reason": "Image quality passed."}
    except Exception as e:
        return {"valid": False, "reason": f"Corrupted or invalid image file: {e}"}


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance formula in meters."""
    R = 6371000  # Earth radius in meters
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)

    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def recommend_department(issue: str) -> str:
    departments = {
        "Pothole": "Public Works Department (PWD)",
        "Garbage": "Municipal Sanitation Department",
        "Streetlight": "Electrical Wing",
        "Water Leakage": "Water Supply & Sewerage Board",
        "Drainage": "Municipal Corporation"
    }
    return departments.get(issue, "General Municipal Department")


def predict_priority(issue: str, confidence: float, bbox_area_ratio: float = 0.01, detection_count: int = 1) -> str:
    if issue == "Pothole":
        if confidence >= 0.85 or bbox_area_ratio >= 0.05:
            return "High"
        elif confidence >= 0.65 or bbox_area_ratio >= 0.02:
            return "Medium"
        else:
            return "Low"
    elif issue == "Garbage":
        if detection_count >= 2 or bbox_area_ratio >= 0.08 or confidence >= 0.85:
            return "High"
        elif confidence >= 0.65:
            return "Medium"
        else:
            return "Low"
    elif issue == "Streetlight":
        if confidence >= 0.50 or bbox_area_ratio >= 0.01:
            return "High"
        elif confidence >= 0.25:
            return "Medium"
        else:
            return "Low"

    return "Medium"


def run_civora_ai(image_path: str, expected_category: Optional[str] = None) -> Dict[str, Any]:
    """
    Optimized AI prediction pipeline.
    Uses cached YOLO models with fast-path execution if expected_category is specified.
    """
    total_start = time.time()
    logger.info("[AI] REQUEST RECEIVED")
    logger.info(f"[AI] expected_category = {expected_category}")

    # Measure model loading time (0ms if already cached)
    load_start = time.time()
    load_ai_models()
    load_time_ms = (time.time() - load_start) * 1000
    logger.info(f"[AI] model initialization = {load_time_ms:.1f} ms")

    # Image reading & Pre-inference quality check
    prep_start = time.time()
    quality = check_image_quality(image_path)
    prep_time_ms = (time.time() - prep_start) * 1000
    logger.info(f"[AI] image read = {prep_time_ms:.1f} ms")
    logger.info(f"[AI] preprocessing = {prep_time_ms:.1f} ms")

    if not quality["valid"]:
        elapsed = time.time() - total_start
        logger.info(f"[AI] decision = REJECT (Invalid Image: {quality['reason']})")
        logger.info(f"[AI] TOTAL = {(elapsed * 1000):.1f} ms")
        return {
            "is_civic_issue": False,
            "issue": "Not a Civic Issue",
            "category": None,
            "confidence": 0.95,
            "priority": None,
            "department": None,
            "reason": f"Image quality check failed: {quality['reason']}",
            "message": "Image quality is too low for reliable analysis. Please upload a clearer photo.",
            "duplicate_group": None,
            "analysis_time_seconds": round(elapsed, 3)
        }

    # Determine image size for bbox ratio calculations
    image_area = 1.0
    try:
        with Image.open(image_path) as img:
            image_area = float(img.width * img.height)
    except Exception:
        pass

    # Map expected_category to model selection
    normalized_category = (expected_category or "").strip().lower()
    target_models = {}

    if normalized_category in ["road", "pothole"]:
        logger.info("[AI] Expected category: road")
        logger.info("[AI] Running pothole model only")
        if _pothole_model:
            target_models["Pothole"] = _pothole_model
    elif normalized_category in ["garbage", "waste"]:
        logger.info("[AI] Expected category: garbage")
        logger.info("[AI] Running garbage model only")
        if _garbage_model:
            target_models["Garbage"] = _garbage_model
    elif normalized_category in ["streetlight", "light", "electrical"]:
        logger.info("[AI] Expected category: streetlight")
        logger.info("[AI] Running streetlight model only")
        if _streetlight_model:
            target_models["Streetlight"] = _streetlight_model
    elif normalized_category in ["water", "drainage", "public-space", "parks", "other"]:
        # Explicit non-supported category selected by user
        logger.info(f"[AI] Expected category: {normalized_category} (Non-YOLO category)")
        elapsed = time.time() - total_start
        logger.info(f"[AI] decision = REJECT (Non-supported vision category: {normalized_category})")
        logger.info(f"[AI] TOTAL = {(elapsed * 1000):.1f} ms")
        return {
            "is_civic_issue": False,
            "issue": "Not a Civic Issue",
            "category": None,
            "confidence": 0.95,
            "priority": None,
            "department": None,
            "reason": f"The selected category ('{expected_category}') is not directly supported by automated AI vision models.",
            "message": "No supported civic issue detected for the selected category.",
            "duplicate_group": None,
            "analysis_time_seconds": round(elapsed, 3)
        }
    else:
        logger.info("[AI] Expected category: Automatic mode")
        logger.info("[AI] Running all candidate models")
        if _pothole_model:
            target_models["Pothole"] = _pothole_model
        if _garbage_model:
            target_models["Garbage"] = _garbage_model
        if _streetlight_model:
            target_models["Streetlight"] = _streetlight_model

    final_detections = []
    total_inference_start = time.time()

    for issue_name, model in target_models.items():
        m_start = time.time()
        try:
            min_conf = CLASS_THRESHOLDS.get(issue_name, 0.50)
            imgsz = CLASS_IMGSZ.get(issue_name, 416)
            
            # Lower detection conf threshold during predict call so we capture low-confidence streetlights if needed
            predict_conf = 0.10 if issue_name == "Streetlight" else 0.25
            
            results = model.predict(source=image_path, conf=predict_conf, imgsz=imgsz, device="cpu", verbose=False)
            m_time = (time.time() - m_start) * 1000
            logger.info(f"[AI] {issue_name} inference = {m_time:.1f} ms (imgsz={imgsz})")

            for result in results:
                if result.boxes is not None:
                    for box in result.boxes:
                        confidence = float(box.conf[0])
                        x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                        bbox_area = float((x2 - x1) * (y2 - y1))
                        bbox_ratio = bbox_area / image_area if image_area > 0 else 0.001

                        min_ratio = MIN_BBOX_AREA_RATIOS.get(issue_name, 0.0001)

                        if confidence >= min_conf and bbox_ratio >= min_ratio:
                            final_detections.append({
                                "issue": issue_name,
                                "confidence": round(confidence, 3),
                                "bbox": [x1, y1, x2, y2],
                                "bbox_ratio": round(bbox_ratio, 5)
                            })
        except Exception as e:
            logger.error(f"[AI] {issue_name} prediction error: {e}")

    total_inference_time = (time.time() - total_inference_start) * 1000
    logger.info(f"[AI] inference = {total_inference_time:.1f} ms")

    # Decision & Postprocessing Pipeline
    post_start = time.time()

    category_map = {
        "Pothole": "road",
        "Garbage": "garbage",
        "Streetlight": "streetlight"
    }
    reasons = {
        "Pothole": "A road-surface depression consistent with a pothole was detected.",
        "Garbage": "Accumulated waste/debris consistent with a garbage dumping area was detected.",
        "Streetlight": "A non-functional or damaged streetlight was detected."
    }
    messages = {
        "Pothole": "Pothole detected successfully.",
        "Garbage": "Garbage accumulation detected successfully.",
        "Streetlight": "Streetlight issue detected successfully."
    }

    # Deterministic Explicit Category Mode Decision
    if normalized_category and final_detections:
        best_detection = max(final_detections, key=lambda x: x["confidence"])
        best_issue = best_detection["issue"]
        best_conf = best_detection["confidence"]
        best_ratio = best_detection["bbox_ratio"]

        category = category_map.get(best_issue, "road")
        priority = predict_priority(best_issue, best_conf, best_ratio, 1)
        department = recommend_department(best_issue)
        reason = reasons.get(best_issue, f"{best_issue} detected.")
        message = messages.get(best_issue, f"{best_issue} detected.")

        post_time_ms = (time.time() - post_start) * 1000
        elapsed = time.time() - total_start
        logger.info(f"[AI] postprocessing = {post_time_ms:.1f} ms")
        logger.info(f"[AI] decision = ACCEPT explicit category ({best_issue}, conf={best_conf})")
        logger.info(f"[AI] TOTAL = {(elapsed * 1000):.1f} ms")

        return {
            "is_civic_issue": True,
            "issue": best_issue,
            "category": category,
            "confidence": best_conf,
            "priority": priority,
            "department": department,
            "reason": reason,
            "message": message,
            "duplicate_group": None,
            "analysis_time_seconds": round(elapsed, 3)
        }

    # Automatic Multi-Model Decision Mode
    if final_detections:
        issue_counts = {}
        for d in final_detections:
            issue_counts[d["issue"]] = issue_counts.get(d["issue"], 0) + 1

        best_detection = max(final_detections, key=lambda x: x["confidence"])
        best_issue = best_detection["issue"]
        best_conf = best_detection["confidence"]
        best_ratio = best_detection["bbox_ratio"]

        # Check for ambiguity: multiple conflicting classes with near-identical confidence
        unique_classes = set(d["issue"] for d in final_detections)
        if len(unique_classes) > 1:
            sorted_confs = sorted([d["confidence"] for d in final_detections], reverse=True)
            if len(sorted_confs) >= 2 and (sorted_confs[0] - sorted_confs[1]) < 0.20:
                post_time_ms = (time.time() - post_start) * 1000
                elapsed = time.time() - total_start
                logger.info(f"[AI] postprocessing = {post_time_ms:.1f} ms")
                logger.info(f"[AI] decision = REJECT ambiguous conflicting detections")
                logger.info(f"[AI] TOTAL = {(elapsed * 1000):.1f} ms")
                return {
                    "is_civic_issue": False,
                    "issue": "Not a Civic Issue",
                    "category": None,
                    "confidence": 0.95,
                    "priority": None,
                    "department": None,
                    "reason": "The image contains ambiguous visual evidence. Please upload a clearer photo of the issue.",
                    "message": "Unable to classify confidently.",
                    "duplicate_group": None,
                    "analysis_time_seconds": round(elapsed, 3)
                }

        category = category_map.get(best_issue, "road")
        priority = predict_priority(best_issue, best_conf, best_ratio, issue_counts.get(best_issue, 1))
        department = recommend_department(best_issue)
        reason = reasons.get(best_issue, f"{best_issue} detected.")
        message = messages.get(best_issue, f"{best_issue} detected.")

        post_time_ms = (time.time() - post_start) * 1000
        elapsed = time.time() - total_start
        logger.info(f"[AI] postprocessing = {post_time_ms:.1f} ms")
        logger.info(f"[AI] decision = ACCEPT auto detection ({best_issue}, conf={best_conf})")
        logger.info(f"[AI] TOTAL = {(elapsed * 1000):.1f} ms")

        return {
            "is_civic_issue": True,
            "issue": best_issue,
            "category": category,
            "confidence": best_conf,
            "priority": priority,
            "department": department,
            "reason": reason,
            "message": message,
            "duplicate_group": None,
            "analysis_time_seconds": round(elapsed, 3)
        }

    # Non-Civic Rejection Response
    post_time_ms = (time.time() - post_start) * 1000
    elapsed = time.time() - total_start
    logger.info(f"[AI] postprocessing = {post_time_ms:.1f} ms")
    logger.info(f"[AI] decision = REJECT no reliable detections above threshold")
    logger.info(f"[AI] TOTAL = {(elapsed * 1000):.1f} ms")

    return {
        "is_civic_issue": False,
        "issue": "Not a Civic Issue",
        "category": None,
        "confidence": 0.95,
        "priority": None,
        "department": None,
        "reason": "No reliable pothole, garbage accumulation, or streetlight issue was detected.",
        "message": "Image does not appear to contain a supported civic issue.",
        "duplicate_group": None,
        "analysis_time_seconds": round(elapsed, 3)
    }


def find_duplicate(
    new_issue: str,
    new_lat: Optional[float],
    new_lng: Optional[float],
    existing_complaints: List[Dict[str, Any]],
    threshold_meters: float = 100.0
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
                    "distance_meters": round(distance, 2)
                }
        except Exception:
            continue

    return {"is_duplicate": False, "duplicate_of": None, "distance_meters": None}

