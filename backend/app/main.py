import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from .database import engine, Base, SessionLocal
from .models import User, Complaint, TimelineEvent
from .auth import hash_password
from .routers import auth_router, complaints_router, ai_router, notifications_router, admin_router

# Create Database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="CIVORA Civic Infrastructure Backend API",
    description="FastAPI + SQLite + SQLAlchemy backend for CIVORA with YOLO AI prediction model integration.",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://localhost:8000",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file serving for uploads
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Include Routers
app.include_router(auth_router.router)
app.include_router(admin_router.router)
app.include_router(complaints_router.router)
app.include_router(ai_router.router)
app.include_router(notifications_router.router)

@app.get("/")
def root():
    return {
        "title": "CIVORA Civic Infrastructure API",
        "status": "Online",
        "docs_url": "/docs",
        "version": "1.0.0"
    }

def seed_database():
    db = SessionLocal()
    try:
        # Seed Admin User if not exists
        admin = db.query(User).filter(User.email == "admin@civora.gov.in").first()
        if not admin:
            admin_user = User(
                email="admin@civora.gov.in",
                hashed_password=hash_password("admin123"),
                full_name="Jharkhand Municipal Administrator",
                role="admin",
                district="Ranchi"
            )
            db.add(admin_user)

        # Seed Default Citizen if not exists
        citizen = db.query(User).filter(User.email == "citizen@civora.in").first()
        if not citizen:
            citizen_user = User(
                email="citizen@civora.in",
                hashed_password=hash_password("citizen123"),
                full_name="Rajesh Kumar",
                role="citizen",
                district="Ranchi"
            )
            db.add(citizen_user)

        # Seed sample complaints if table is empty
        if db.query(Complaint).count() == 0:
            sample_complaints = [
                {
                    "id": "CIV-108",
                    "title": "Dangerous Pothole on Main Road",
                    "description": "Deep pothole causing vehicle damage near Albert Ekka Chowk.",
                    "category": "road",
                    "district": "Ranchi",
                    "ward": "Ward 4",
                    "location_name": "Albert Ekka Chowk, Main Road, Ranchi",
                    "latitude": 23.3698,
                    "longitude": 85.3256,
                    "priority": "High",
                    "status": "Reported",
                    "upvotes": 42,
                    "reported_by": "Ramesh Sharma",
                    "assigned_department": "Public Works Department (PWD)",
                    "ai_confidence": "94%",
                    "ai_cluster_count": 3,
                    "before_image": "https://images.unsplash.com/photo-1541888946425-d0fbb186a5b7?auto=format&fit=crop&w=800&q=80"
                },
                {
                    "id": "GBG-204",
                    "title": "Uncollected Garbage Dump",
                    "description": "Overflowing waste bin behind Lalpur market area for 3 days.",
                    "category": "garbage",
                    "district": "Ranchi",
                    "ward": "Ward 7",
                    "location_name": "Lalpur Chowk, Ranchi",
                    "latitude": 23.3750,
                    "longitude": 85.3320,
                    "priority": "High",
                    "status": "In Progress",
                    "upvotes": 28,
                    "reported_by": "Anjali Sen",
                    "assigned_department": "Municipal Sanitation Department",
                    "ai_confidence": "96%",
                    "ai_cluster_count": 1,
                    "before_image": "https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=800&q=80"
                },
                {
                    "id": "STL-301",
                    "title": "Non-Functional Streetlight",
                    "description": "Entire lane dark near Sakchi Highway block.",
                    "category": "streetlight",
                    "district": "Jamshedpur",
                    "ward": "Ward 12",
                    "location_name": "Sakchi Highway, Jamshedpur",
                    "latitude": 22.8046,
                    "longitude": 86.2029,
                    "priority": "Medium",
                    "status": "Pending Verification",
                    "upvotes": 15,
                    "reported_by": "Sunil Mahato",
                    "assigned_department": "Electrical Wing",
                    "ai_confidence": "91%",
                    "ai_cluster_count": 1,
                    "before_image": "https://images.unsplash.com/photo-1509114397022-ed747cca3f65?auto=format&fit=crop&w=800&q=80",
                    "after_image": "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80"
                }
            ]

            for sc in sample_complaints:
                c = Complaint(**sc)
                db.add(c)
                timeline_steps = [
                    TimelineEvent(complaint_id=c.id, step="Reported", date="2 days ago", completed=True, details="Submitted by citizen"),
                    TimelineEvent(complaint_id=c.id, step="AI Analyzed", date="2 days ago", completed=True, details=f"AI classified issue with {c.ai_confidence} confidence"),
                    TimelineEvent(complaint_id=c.id, step="Verified", date="1 day ago", completed=True, details="Verified by municipal inspector"),
                    TimelineEvent(complaint_id=c.id, step="Assigned", date="1 day ago", completed=True, details=f"Assigned to {c.assigned_department}"),
                    TimelineEvent(complaint_id=c.id, step="In Progress", date="Yesterday", completed=c.status != "Reported", details="Contractor dispatched"),
                    TimelineEvent(complaint_id=c.id, step="Pending Verification", date="Just now" if c.status == "Pending Verification" else "Pending", completed=c.status == "Pending Verification", details="Work finished"),
                    TimelineEvent(complaint_id=c.id, step="Resolved", date="Pending", completed=False, details="Awaiting sign-off")
                ]
                for ts in timeline_steps:
                    db.add(ts)

        db.commit()
    except Exception as e:
        print(f"Error seeding database: {e}")
    finally:
        db.close()

# Seed database immediately
seed_database()

@app.on_event("startup")
def startup_event():
    seed_database()
