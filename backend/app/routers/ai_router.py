import os
import uuid
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from ..schemas import AIPredictResponse
from ..ai_engine import run_civora_ai

router = APIRouter(tags=["AI Vision Engine"])

TEMP_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads", "temp")
os.makedirs(TEMP_DIR, exist_ok=True)

@router.post("/predict", response_model=AIPredictResponse)
@router.post("/api/predict", response_model=AIPredictResponse)
async def predict_issue(
    file: UploadFile = File(...),
    expected_category: Optional[str] = Form(None)
):
    """
    CIVORA AI Prediction Endpoint:
    Accepts multipart/form-data with field 'file' and optional 'expected_category'.
    Returns structured CIVORA AI vision decision schema.
    """
    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded")

    file_ext = os.path.splitext(file.filename)[1] or ".jpg"
    temp_filename = os.path.join(TEMP_DIR, f"temp_{uuid.uuid4().hex}{file_ext}")

    try:
        with open(temp_filename, "wb") as buffer:
            buffer.write(await file.read())

        # Run CIVORA AI Vision Pipeline
        result = run_civora_ai(temp_filename, expected_category=expected_category)

        # Explicit server-side endpoint logging
        import logging
        logger = logging.getLogger("civora.ai")
        logger.info("=== SERVER /predict RECEIVED ===")
        logger.info(f"Received filename: {file.filename}")
        logger.info(f"Received expected_category: {expected_category}")
        logger.info(f"Final issue: {result.get('issue')}")
        logger.info(f"Is civic issue: {result.get('is_civic_issue')}")
        logger.info(f"Raw confidence: {result.get('confidence')}")
        logger.info(f"Analysis time: {result.get('analysis_time_seconds')}s")

        return result
    finally:
        if os.path.exists(temp_filename):
            try:
                os.remove(temp_filename)
            except Exception:
                pass
