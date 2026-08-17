import os
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from ..schemas import AIPredictResponse
from ..ai_engine import run_civora_ai

router = APIRouter(tags=["AI Vision Engine"])

TEMP_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads", "temp")
os.makedirs(TEMP_DIR, exist_ok=True)

@router.post("/predict", response_model=AIPredictResponse)
@router.post("/api/predict", response_model=AIPredictResponse)
async def predict_issue(file: UploadFile = File(...)):
    """
    CIVORA AI Prediction Endpoint matching Member 1 specification:
    Accepts multipart/form-data with field name 'file'.
    Returns detected issue, confidence, priority, department recommendation, and duplicate_group.
    """
    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded")

    file_ext = os.path.splitext(file.filename)[1] or ".jpg"
    temp_filename = os.path.join(TEMP_DIR, f"temp_{uuid.uuid4().hex}{file_ext}")

    try:
        with open(temp_filename, "wb") as buffer:
            buffer.write(await file.read())

        # Run CIVORA AI Vision Pipeline
        result = run_civora_ai(temp_filename)

        return result
    finally:
        if os.path.exists(temp_filename):
            try:
                os.remove(temp_filename)
            except Exception:
                pass
