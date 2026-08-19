# ============================================================
# CIVORA 3 - AI ENGINE
# ============================================================

import os
import math
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger("civora.ai")


# ============================================================
# SUPPORTED CIVIC ISSUES
# IMPORTANT: SUPPORTED_ISSUES MUST BE A DICTIONARY
# because complaints_router.py uses SUPPORTED_ISSUES.get(...)
# ============================================================

SUPPORTED_ISSUES = {
    "Pothole": "PWD",
    "Garbage": "Municipal Sanitation Department",
    "Streetlight": "Electrical Wing",
}

ISSUE_TO_CATEGORY = {
    "Pothole": "road",
    "Garbage": "garbage",
    "Streetlight": "streetlight",
}

SUPPORTED_CATEGORIES = {
    "road",
    "garbage",
    "streetlight",
}


# ============================================================
# MODEL PATHS
# ============================================================

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(BASE_DIR, "trained_model")

GARBAGE_MODEL_PATH = os.path.join(
    MODEL_DIR, "garbage_best.pt"
)

POTHOLE_MODEL_PATH = os.path.join(
    MODEL_DIR, "pothole_best.pt"
)

STREETLIGHT_MODEL_PATH = os.path.join(
    MODEL_DIR, "streetlight_best.pt"
)


# ============================================================
# GLOBAL MODELS
# ============================================================

_models_loaded = False

_garbage_model = None
_pothole_model = None
_streetlight_model = None


# ============================================================
# AI SETTINGS
# ============================================================

# Lower than the previous 0.68 so genuine civic images
# are less likely to be rejected.
YOLO_CONFIDENCE = 0.55

# Final confidence required for accepting a prediction.
ACCEPTANCE_THRESHOLD = 0.60

# Very small detections are usually noise.
MIN_BBOX_AREA_RATIO = 0.005

# Reject detections covering almost the entire image.
MAX_BBOX_AREA_RATIO = 0.95


# ============================================================
# LOAD YOLO MODELS
# ============================================================

def load_ai_models():
    global _models_loaded
    global _garbage_model
    global _pothole_model
    global _streetlight_model

    if _models_loaded:
        return

    try:
        from ultralytics import YOLO

        if os.path.exists(GARBAGE_MODEL_PATH):
            _garbage_model = YOLO(GARBAGE_MODEL_PATH)
            logger.info("Garbage YOLO model loaded.")

        if os.path.exists(POTHOLE_MODEL_PATH):
            _pothole_model = YOLO(POTHOLE_MODEL_PATH)
            logger.info("Pothole YOLO model loaded.")

        if os.path.exists(STREETLIGHT_MODEL_PATH):
            _streetlight_model = YOLO(STREETLIGHT_MODEL_PATH)
            logger.info("Streetlight YOLO model loaded.")

        _models_loaded = True

    except Exception as e:
        logger.error("Could not load YOLO models: %s", e)
        _models_loaded = False


# ============================================================
# DISTANCE CALCULATION
# ============================================================

def calculate_distance(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float
) -> float:

    R = 6371000

    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)

    a = (
        math.sin(dlat / 2) ** 2
        +
        math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )

    c = 2 * math.atan2(
        math.sqrt(a),
        math.sqrt(1 - a)
    )

    return R * c


# ============================================================
# DEPARTMENT
# ============================================================

def recommend_department(issue: str) -> str:
    return SUPPORTED_ISSUES.get(
        issue,
        "General Municipal Department"
    )


# ============================================================
# PRIORITY
# ============================================================

def predict_priority(
    issue: str,
    confidence: float,
    detection_count: int = 1
) -> str:

    if issue == "Pothole":
        if confidence >= 0.85:
            return "High"
        elif confidence >= 0.65:
            return "Medium"
        return "Low"

    if issue == "Garbage":
        if detection_count >= 3:
            return "High"
        elif detection_count >= 1:
            return "Medium"
        return "Low"

    if issue == "Streetlight":
        if confidence >= 0.85:
            return "High"
        elif confidence >= 0.65:
            return "Medium"
        return "Low"

    return "Medium"


# ============================================================
# IMAGE SIZE / BBOX VALIDATION
# ============================================================

def validate_bbox(
    bbox: List[int],
    image_width: int,
    image_height: int
) -> bool:

    try:
        x1, y1, x2, y2 = bbox

        box_width = max(0, x2 - x1)
        box_height = max(0, y2 - y1)

        box_area = box_width * box_height
        image_area = image_width * image_height

        if image_area <= 0:
            return False

        ratio = box_area / image_area

        if ratio < MIN_BBOX_AREA_RATIO:
            return False

        if ratio > MAX_BBOX_AREA_RATIO:
            return False

        return True

    except Exception:
        return False


# ============================================================
# CLASS NAME VALIDATION
# ============================================================

def normalize_class_name(name: str) -> Optional[str]:

    name = str(name).lower().strip()

    if name == "garbage":
        return "Garbage"

    if name == "pothole":
        return "Pothole"

    if name.startswith("street_light"):
        return "Streetlight"

    if name.startswith("streetlight"):
        return "Streetlight"

    return None


# ============================================================
# AI PREDICTION
# ============================================================

def run_civora_ai(image_path: str) -> Dict[str, Any]:

    load_ai_models()

    empty_result = {
        "is_civic_issue": False,
        "issue": "Not a Civic Issue",
        "category": None,
        "confidence": 0.0,
        "priority": None,
        "department": None,
        "duplicate_group": None,
        "message": (
            "The image does not appear to contain "
            "a supported civic issue."
        )
    }

    if not image_path or not os.path.exists(image_path):
        return empty_result

    models = {}

    if _garbage_model is not None:
        models["Garbage"] = _garbage_model

    if _pothole_model is not None:
        models["Pothole"] = _pothole_model

    if _streetlight_model is not None:
        models["Streetlight"] = _streetlight_model

    if not models:
        logger.warning("No YOLO models are available.")
        return empty_result

    detections = []

    # --------------------------------------------------------
    # Get image dimensions
    # --------------------------------------------------------

    image_width = 0
    image_height = 0

    try:
        from PIL import Image

        with Image.open(image_path) as img:
            image_width, image_height = img.size

    except Exception as e:
        logger.warning(
            "Could not read image size: %s",
            e
        )

    # --------------------------------------------------------
    # Run every supported model
    # --------------------------------------------------------

    for model_issue, model in models.items():

        try:

            results = model.predict(
                source=image_path,
                conf=YOLO_CONFIDENCE,
                device="cpu",
                verbose=False
            )

            for result in results:

                if result.boxes is None:
                    continue

                names = getattr(
                    result,
                    "names",
                    getattr(model, "names", {})
                )

                for box in result.boxes:

                    try:

                        confidence = float(
                            box.conf[0]
                        )

                        class_id = int(
                            box.cls[0]
                        )

                        class_name = names.get(
                            class_id,
                            ""
                        )

                        issue = normalize_class_name(
                            class_name
                        )

                        # Do not trust a detection if the
                        # class name is not supported.
                        if issue is None:
                            continue

                        if confidence < YOLO_CONFIDENCE:
                            continue

                        bbox = list(
                            map(
                                int,
                                box.xyxy[0].tolist()
                            )
                        )

                        if image_width > 0 and image_height > 0:

                            if not validate_bbox(
                                bbox,
                                image_width,
                                image_height
                            ):
                                continue

                        detections.append({
                            "issue": issue,
                            "confidence": confidence,
                            "bbox": bbox
                        })

                    except Exception as e:
                        logger.warning(
                            "Invalid YOLO detection: %s",
                            e
                        )

        except Exception as e:
            logger.error(
                "YOLO prediction failed for %s: %s",
                model_issue,
                e
            )

    # --------------------------------------------------------
    # Nothing detected
    # --------------------------------------------------------

    if not detections:
        return empty_result

    # --------------------------------------------------------
    # Sort by confidence
    # --------------------------------------------------------

    detections.sort(
        key=lambda x: x["confidence"],
        reverse=True
    )

    best = detections[0]

    best_issue = best["issue"]
    best_confidence = best["confidence"]

    # --------------------------------------------------------
    # False-positive protection
    # --------------------------------------------------------

    if best_confidence < ACCEPTANCE_THRESHOLD:

        return {
            **empty_result,
            "message": (
                "No supported civic issue was detected "
                "with sufficient confidence."
            )
        }

    # --------------------------------------------------------
    # Ambiguous predictions
    # --------------------------------------------------------

    if len(detections) >= 2:

        second = detections[1]

        if (
            second["issue"] != best_issue
            and
            abs(
                best_confidence -
                second["confidence"]
            ) < 0.08
        ):

            logger.warning(
                "Ambiguous AI result: %s %.3f vs %s %.3f",
                best_issue,
                best_confidence,
                second["issue"],
                second["confidence"]
            )

            return {
                **empty_result,
                "message": (
                    "The image is ambiguous. "
                    "Please upload a clearer photo "
                    "of the civic issue."
                )
            }

    # --------------------------------------------------------
    # Accepted civic issue
    # --------------------------------------------------------

    category = ISSUE_TO_CATEGORY.get(
        best_issue
    )

    department = recommend_department(
        best_issue
    )

    priority = predict_priority(
        best_issue,
        best_confidence,
        len(detections)
    )

    return {
        "is_civic_issue": True,
        "issue": best_issue,
        "category": category,
        "confidence": round(
            best_confidence,
            3
        ),
        "priority": priority,
        "department": department,
        "duplicate_group": None,
        "message": (
            f"{best_issue} detected successfully."
        )
    }


# ============================================================
# DUPLICATE COMPLAINT DETECTION
# ============================================================

def find_duplicate(
    new_issue: str,
    new_lat: Optional[float],
    new_lng: Optional[float],
    existing_complaints: List[Dict[str, Any]],
    threshold_meters: float = 100.0
) -> Dict[str, Any]:

    if new_lat is None or new_lng is None:
        return {
            "is_duplicate": False,
            "duplicate_of": None,
            "distance_meters": None
        }

    for old in existing_complaints:

        old_issue = (
            old.get("category")
            or old.get("issue")
        )

        old_lat = (
            old.get("latitude")
            if old.get("latitude") is not None
            else old.get("lat")
        )

        old_lng = (
            old.get("longitude")
            if old.get("longitude") is not None
            else old.get("lng")
        )

        if (
            not old_issue
            or old_lat is None
            or old_lng is None
        ):
            continue

        old_issue_text = str(
            old_issue
        ).lower()

        new_issue_text = str(
            new_issue
        ).lower()

        # Same issue/category required.
        if (
            old_issue_text not in new_issue_text
            and
            new_issue_text not in old_issue_text
        ):
            continue

        try:

            distance = calculate_distance(
                float(new_lat),
                float(new_lng),
                float(old_lat),
                float(old_lng)
            )

            if distance <= threshold_meters:

                return {
                    "is_duplicate": True,
                    "duplicate_of": (
                        old.get("id")
                        or old.get("complaint_id")
                    ),
                    "distance_meters": round(
                        distance,
                        2
                    )
                }

        except Exception as e:
            logger.warning(
                "Duplicate distance calculation failed: %s",
                e
            )

    return {
        "is_duplicate": False,
        "duplicate_of": None,
        "distance_meters": None
    }