import uuid
import os
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Complaint, TimelineEvent, Notification, Upvote, User
from ..schemas import (
    ComplaintCreate,
    ComplaintResponse,
    DepartmentAssign,
    StatusUpdate,
    ResolutionProof,
    CitizenVerification,
    TimelineEventSchema
)
from ..auth import get_current_user
from ..ai_engine import run_civora_ai, find_duplicate

router = APIRouter(prefix="/api/complaints", tags=["Complaints"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

CATEGORY_LABEL_MAP = {
    "road": "🕳️ Road / Pothole",
    "garbage": "🗑️ Garbage / Waste",
    "streetlight": "💡 Streetlight / Electrical",
    "water": "🚰 Water Leakage / Drainage",
    "public-space": "🌳 Public Space / Parks",
    "other": "📌 Other Civic Issue"
}

PREFIX_MAP = {
    "road": "PTH",
    "garbage": "GBG",
    "streetlight": "STL",
    "water": "WTR",
    "public-space": "PRK",
    "other": "CIV"
}

def format_complaint_dict(c: Complaint) -> dict:
    return {
        "id": c.id,
        "title": c.title,
        "description": c.description,
        "category": c.category,
        "categoryLabel": CATEGORY_LABEL_MAP.get(c.category, "📌 Other Civic Issue"),
        "district": c.district,
        "ward": c.ward,
        "locationName": c.location_name or f"{c.district}, Jharkhand",
        "lat": c.latitude or 23.3441,
        "lng": c.longitude or 85.3096,
        "priority": c.priority,
        "status": c.status,
        "upvotes": c.upvotes,
        "reportedBy": c.reported_by,
        "createdAt": c.created_at.strftime("%Y-%m-%d") if c.created_at else "Just now",
        "assignedDepartment": c.assigned_department,
        "aiConfidence": c.ai_confidence,
        "aiClusterCount": c.ai_cluster_count,
        "duplicateGroup": c.duplicate_group,
        "beforeImage": c.before_image,
        "afterImage": c.after_image,
        "verificationFeedback": c.verification_feedback,
        "timeline": [
            {
                "step": t.step,
                "date": t.date,
                "completed": t.completed,
                "details": t.details
            }
            for t in c.timeline
        ]
    }


@router.post("", response_model=ComplaintResponse, status_code=status.HTTP_201_CREATED)
async def create_complaint(
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    category: Optional[str] = Form("other"),
    district: Optional[str] = Form("Ranchi"),
    ward: Optional[str] = Form("Ward 1"),
    location: Optional[str] = Form("Ranchi, Jharkhand"),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    image_file: Optional[UploadFile] = File(None),
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    # 1. Save photo if uploaded
    image_url = None
    saved_file_path = None
    if image_file:
        file_ext = os.path.splitext(image_file.filename)[1] or ".jpg"
        filename = f"complaint_{uuid.uuid4().hex[:10]}{file_ext}"
        saved_file_path = os.path.join(UPLOAD_DIR, filename)
        with open(saved_file_path, "wb") as f:
            f.write(await image_file.read())
        image_url = f"/uploads/{filename}"
    else:
        image_url = "https://images.unsplash.com/photo-1541888946425-d0fbb186a5b7?auto=format&fit=crop&w=800&q=80"

    # 2. Run AI Prediction Engine
    ai_result = {"issue": None, "confidence": 0.95, "priority": "Medium", "department": "General Municipal Department"}
    if saved_file_path and os.path.exists(saved_file_path):
        ai_result = run_civora_ai(saved_file_path)

    detected_issue = ai_result.get("issue") or category
    final_title = title or (f"{detected_issue} Reported" if detected_issue else "Civic Issue Reported")
    final_priority = ai_result.get("priority") or "Medium"
    final_dept = ai_result.get("department") or "General Municipal Department"
    confidence_str = f"{int(ai_result.get('confidence', 0.95) * 100)}%" if isinstance(ai_result.get('confidence'), float) else str(ai_result.get('confidence', '95%'))

    # 3. Check duplicate detection against existing complaints
    existing_all = db.query(Complaint).all()
    dup_res = find_duplicate(
        new_issue=category,
        new_lat=latitude or 23.3441,
        new_lng=longitude or 85.3096,
        existing_complaints=[{"id": c.id, "category": c.category, "lat": c.latitude, "lng": c.longitude} for c in existing_all]
    )

    duplicate_group_id = dup_res.get("duplicate_of") if dup_res.get("is_duplicate") else None

    # 4. Generate complaint ID
    prefix = PREFIX_MAP.get(category, "CIV")
    complaint_id = f"{prefix}-{uuid.uuid4().hex[:6].upper()}"

    reporter_name = current_user.full_name if current_user else "You (Citizen)"

    # 5. Create Complaint DB object
    db_complaint = Complaint(
        id=complaint_id,
        title=final_title,
        description=description or f"{final_title} reported in {district}.",
        category=category,
        district=district,
        ward=ward,
        location_name=location or f"{district}, Jharkhand",
        latitude=latitude or (23.3441 + (hash(complaint_id) % 100) * 0.0001),
        longitude=longitude or (85.3096 + (hash(complaint_id) % 100) * 0.0001),
        priority=final_priority,
        status="Reported",
        upvotes=1,
        reported_by=reporter_name,
        user_id=current_user.id if current_user else None,
        assigned_department=final_dept,
        ai_confidence=confidence_str,
        ai_cluster_count=2 if duplicate_group_id else 1,
        duplicate_group=duplicate_group_id,
        before_image=image_url,
        after_image=None,
        created_at=datetime.utcnow()
    )

    db.add(db_complaint)
    db.commit()

    # 6. Create initial Timeline Events
    timeline_steps = [
        TimelineEvent(complaint_id=complaint_id, step="Reported", date="Just now", completed=True, details="Submitted by citizen"),
        TimelineEvent(complaint_id=complaint_id, step="AI Analyzed", date="Just now", completed=True, details=f"AI classified issue with {confidence_str} confidence"),
        TimelineEvent(complaint_id=complaint_id, step="Verified", date="Pending", completed=False, details="Awaiting municipal inspector"),
        TimelineEvent(complaint_id=complaint_id, step="Assigned", date="Pending", completed=False, details=f"Default department: {final_dept}"),
        TimelineEvent(complaint_id=complaint_id, step="In Progress", date="Pending", completed=False, details="Work queued"),
        TimelineEvent(complaint_id=complaint_id, step="Pending Verification", date="Pending", completed=False, details="Completion photo pending"),
        TimelineEvent(complaint_id=complaint_id, step="Resolved", date="Pending", completed=False, details="Awaiting citizen verification")
    ]
    for ts in timeline_steps:
        db.add(ts)

    # 7. Create Notification
    notif = Notification(
        user_id=current_user.id if current_user else None,
        role_target="admin",
        complaint_id=complaint_id,
        title="New Civic Issue Reported",
        message=f"New issue {complaint_id} ({final_title}) reported in {district} ({final_priority} priority)."
    )
    db.add(notif)

    db.commit()
    db.refresh(db_complaint)

    return format_complaint_dict(db_complaint)


@router.get("", response_model=List[ComplaintResponse])
def list_complaints(
    category: Optional[str] = None,
    district: Optional[str] = None,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Complaint)

    if category and category != "all":
        query = query.filter(Complaint.category == category)
    if district and district != "all":
        query = query.filter(Complaint.district == district)
    if status_filter and status_filter != "all":
        query = query.filter(Complaint.status == status_filter)
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (Complaint.title.ilike(search_pattern)) |
            (Complaint.description.ilike(search_pattern)) |
            (Complaint.id.ilike(search_pattern))
        )

    complaints = query.order_by(Complaint.created_at.desc()).all()
    return [format_complaint_dict(c) for c in complaints]


@router.get("/{complaint_id}", response_model=ComplaintResponse)
def get_complaint(complaint_id: str, db: Session = Depends(get_db)):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return format_complaint_dict(complaint)


@router.post("/{complaint_id}/upvote")
def toggle_upvote(
    complaint_id: str,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    user_id = current_user.id if current_user else 1

    existing_upvote = db.query(Upvote).filter(
        Upvote.complaint_id == complaint_id,
        Upvote.user_id == user_id
    ).first()

    if existing_upvote:
        db.delete(existing_upvote)
        complaint.upvotes = max(0, complaint.upvotes - 1)
        is_upvoted = False
    else:
        new_upvote = Upvote(complaint_id=complaint_id, user_id=user_id)
        db.add(new_upvote)
        complaint.upvotes += 1
        is_upvoted = True

    db.commit()
    db.refresh(complaint)
    return {"complaint_id": complaint_id, "upvotes": complaint.upvotes, "is_upvoted": is_upvoted}


@router.put("/{complaint_id}/assign", response_model=ComplaintResponse)
def assign_department(
    complaint_id: str,
    body: DepartmentAssign,
    db: Session = Depends(get_db)
):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    complaint.assigned_department = body.department
    complaint.status = "In Progress"

    # Update Timeline
    for t in complaint.timeline:
        if t.step in ["Verified", "Assigned"]:
            t.completed = True
            t.date = "Just now"
        if t.step == "In Progress":
            t.completed = True
            t.date = "Just now"
            t.details = f"Assigned to {body.department}"

    # Create Notification
    notif = Notification(
        user_id=complaint.user_id,
        role_target="citizen",
        complaint_id=complaint_id,
        title="Department Assigned",
        message=f"Your complaint {complaint_id} has been assigned to {body.department}."
    )
    db.add(notif)

    db.commit()
    db.refresh(complaint)
    return format_complaint_dict(complaint)


@router.put("/{complaint_id}/status", response_model=ComplaintResponse)
def update_status(
    complaint_id: str,
    body: StatusUpdate,
    db: Session = Depends(get_db)
):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    complaint.status = body.status

    db.commit()
    db.refresh(complaint)
    return format_complaint_dict(complaint)


@router.post("/{complaint_id}/resolution-proof", response_model=ComplaintResponse)
async def upload_resolution_proof(
    complaint_id: str,
    proof_image: Optional[UploadFile] = File(None),
    proof_url: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    after_image_path = None
    if proof_image:
        file_ext = os.path.splitext(proof_image.filename)[1] or ".jpg"
        filename = f"resolution_{uuid.uuid4().hex[:10]}{file_ext}"
        saved_file_path = os.path.join(UPLOAD_DIR, filename)
        with open(saved_file_path, "wb") as f:
            f.write(await proof_image.read())
        after_image_path = f"/uploads/{filename}"
    elif proof_url:
        after_image_path = proof_url
    else:
        after_image_path = "https://images.unsplash.com/photo-1584467735871-8e85353a8413?auto=format&fit=crop&w=800&q=80"

    complaint.after_image = after_image_path
    complaint.status = "Pending Verification"

    # Update timeline
    for t in complaint.timeline:
        if t.step in ["Reported", "AI Analyzed", "Verified", "Assigned", "In Progress", "Pending Verification"]:
            t.completed = True
            t.date = "Just now"

    # Notification to citizen
    notif = Notification(
        user_id=complaint.user_id,
        role_target="citizen",
        complaint_id=complaint_id,
        title="Repair Completed - Verification Needed",
        message=f"Contractor has submitted proof of work for {complaint_id}. Please review and approve."
    )
    db.add(notif)

    db.commit()
    db.refresh(complaint)
    return format_complaint_dict(complaint)


@router.post("/{complaint_id}/verify", response_model=ComplaintResponse)
def citizen_verify(
    complaint_id: str,
    body: CitizenVerification,
    db: Session = Depends(get_db)
):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    if body.approved:
        complaint.status = "Resolved"
        fb_text = body.feedback.strip() if body.feedback else ""
        complaint.verification_feedback = f"Verified and approved by citizen. Rating: {body.rating}/5. {fb_text}".strip()
        for t in complaint.timeline:
            t.completed = True
            if t.step == "Resolved":
                t.date = "Just now"
                t.details = "Verified & closed by citizen."

        # Notification for Admin
        notif = Notification(
            role_target="admin",
            complaint_id=complaint_id,
            title="Complaint Verified & Resolved",
            message=f"Citizen verified resolution for {complaint_id} with rating {body.rating}/5."
        )
        db.add(notif)
    else:
        # Reopen complaint back to In Progress
        complaint.status = "In Progress"
        complaint.verification_feedback = f"Re-opened by citizen: {body.feedback}"
        for t in complaint.timeline:
            if t.step in ["Pending Verification", "Resolved"]:
                t.completed = False

        # Notification for Admin & Department
        notif = Notification(
            role_target="admin",
            complaint_id=complaint_id,
            title="Complaint Re-opened by Citizen",
            message=f"Citizen rejected work for {complaint_id}. Reason: {body.feedback}"
        )
        db.add(notif)

    db.commit()
    db.refresh(complaint)
    return format_complaint_dict(complaint)
