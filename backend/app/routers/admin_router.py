from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..database import get_db
from ..models import User, Complaint
from ..schemas import AdminUserResponse
from ..auth import require_admin

router = APIRouter(prefix="/api/admin", tags=["Admin"])

@router.get("/users", response_model=List[AdminUserResponse])
def get_registered_citizens(
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Get list of registered citizens with safe user profile information and complaint counts.
    Protected: Only users with the 'admin' role can access this endpoint.
    """
    users = db.query(User).filter(User.role == "citizen").order_by(User.created_at.desc()).all()

    result = []
    for u in users:
        # Calculate complaint count dynamically
        count = db.query(func.count(Complaint.id)).filter(
            (Complaint.user_id == u.id) |
            ((Complaint.user_id.is_(None)) & (Complaint.reported_by == u.full_name))
        ).scalar() or 0

        created_at_str = u.created_at.strftime("%Y-%m-%d %H:%M:%S") if u.created_at else "N/A"

        result.append({
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "phone": u.phone,
            "district": u.district or "Ranchi",
            "role": u.role or "citizen",
            "created_at": created_at_str,
            "complaint_count": count
        })

    return result
