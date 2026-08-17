from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Notification, User
from ..schemas import NotificationResponse
from ..auth import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])

@router.get("", response_model=List[NotificationResponse])
def get_notifications(
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Notification)

    if current_user:
        query = query.filter(
            (Notification.user_id == current_user.id) |
            (Notification.role_target == current_user.role) |
            (Notification.user_id == None)
        )
    else:
        query = query.filter(Notification.user_id == None)

    notifications = query.order_by(Notification.created_at.desc()).all()
    return notifications


@router.put("/{notification_id}/read", response_model=NotificationResponse)
def mark_as_read(notification_id: int, db: Session = Depends(get_db)):
    notif = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return notif
