from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr

# Auth Schemas
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: Optional[str] = "citizen" # "citizen" or "admin"
    district: Optional[str] = "Ranchi"
    phone: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    district: Optional[str] = None
    phone: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class AdminUserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    phone: Optional[str] = None
    district: Optional[str] = "Ranchi"
    role: str = "citizen"
    created_at: Optional[str] = None
    complaint_count: int = 0

    class Config:
        from_attributes = True

# Timeline Schema
class TimelineEventSchema(BaseModel):
    step: str
    date: str
    completed: bool
    details: Optional[str] = None

    class Config:
        from_attributes = True

# Complaint Schemas
class ComplaintCreate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = "other"
    district: Optional[str] = "Ranchi"
    ward: Optional[str] = "Ward 1"
    location: Optional[str] = "Ranchi, Jharkhand"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    priority: Optional[str] = "Medium"
    department: Optional[str] = "General Municipal Department"
    confidence: Optional[str] = "95%"
    image: Optional[str] = None

class ComplaintResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    category: str
    categoryLabel: Optional[str] = "📌 Other Issue"
    district: str
    ward: str
    locationName: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    priority: str
    status: str
    upvotes: int
    reportedBy: str
    createdAt: str
    assignedDepartment: str
    aiConfidence: str
    aiClusterCount: int
    duplicateGroup: Optional[str] = None
    beforeImage: Optional[str] = None
    afterImage: Optional[str] = None
    verificationFeedback: Optional[str] = None
    timeline: List[TimelineEventSchema] = []

    class Config:
        from_attributes = True

class DepartmentAssign(BaseModel):
    department: str

class StatusUpdate(BaseModel):
    status: str

class ResolutionProof(BaseModel):
    after_image_url: str
    details: Optional[str] = "Repair work completed by contractor."

class CitizenVerification(BaseModel):
    approved: bool
    rating: Optional[int] = 5
    feedback: Optional[str] = ""

# AI Prediction Schema (Matching Member 1's OpenAPI doc)
class AIPredictResponse(BaseModel):
    issue: Optional[str]
    confidence: float
    priority: Optional[str]
    department: Optional[str]
    duplicate_group: Optional[str]

# Notification Schema
class NotificationResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    role_target: Optional[str] = None
    complaint_id: Optional[str] = None
    title: str
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
