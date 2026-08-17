from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(String, default="citizen") # "citizen" | "admin"
    phone = Column(String, nullable=True)
    district = Column(String, default="Ranchi")
    created_at = Column(DateTime, default=datetime.utcnow)

    complaints = relationship("Complaint", back_populates="reporter")
    notifications = relationship("Notification", back_populates="user")
    upvotes = relationship("Upvote", back_populates="user")


class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(String, primary_key=True, index=True) # e.g. "PTH-9A82B1" or "CIV-108"
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String, nullable=False) # "road", "garbage", "streetlight", "water", "public-space", "other"
    district = Column(String, default="Ranchi")
    ward = Column(String, default="Ward 1")
    location_name = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    priority = Column(String, default="Medium") # "Low", "Medium", "High", "Critical"
    status = Column(String, default="Reported") # "Reported", "In Progress", "Pending Verification", "Resolved", "Reopened"
    upvotes = Column(Integer, default=1)
    reported_by = Column(String, default="Citizen")
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    assigned_department = Column(String, default="General Municipal Department")
    ai_confidence = Column(String, default="95%")
    ai_cluster_count = Column(Integer, default=1)
    duplicate_group = Column(String, nullable=True)
    before_image = Column(String, nullable=True)
    after_image = Column(String, nullable=True)
    verification_feedback = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    reporter = relationship("User", back_populates="complaints")
    timeline = relationship("TimelineEvent", back_populates="complaint", cascade="all, delete-orphan")
    upvote_records = relationship("Upvote", back_populates="complaint", cascade="all, delete-orphan")


class TimelineEvent(Base):
    __tablename__ = "timeline_events"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(String, ForeignKey("complaints.id"), nullable=False)
    step = Column(String, nullable=False) # e.g. "Reported", "AI Analyzed", "Assigned", "In Progress", "Pending Verification", "Resolved"
    date = Column(String, nullable=False)
    completed = Column(Boolean, default=False)
    details = Column(Text, nullable=True)

    complaint = relationship("Complaint", back_populates="timeline")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    role_target = Column(String, nullable=True) # "citizen", "admin", or None
    complaint_id = Column(String, nullable=True)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")


class Upvote(Base):
    __tablename__ = "upvotes"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(String, ForeignKey("complaints.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    complaint = relationship("Complaint", back_populates="upvote_records")
    user = relationship("User", back_populates="upvotes")
