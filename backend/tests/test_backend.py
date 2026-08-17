import os
import sys
import pytest
from io import BytesIO
from fastapi.testclient import TestClient

# Ensure backend package is in Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app, seed_database
from app.database import Base, engine, SessionLocal

# Setup fresh temporary test database
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)
seed_database()
client = TestClient(app)

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "Online"

def test_1_and_2_auth_citizen_and_admin():
    # Register citizen
    citizen_reg = client.post(
        "/api/auth/register",
        json={
            "email": "test_citizen@civora.in",
            "password": "password123",
            "full_name": "Test Citizen",
            "role": "citizen",
            "district": "Ranchi"
        }
    )
    assert citizen_reg.status_code == 201
    res_data = citizen_reg.json()
    assert "access_token" in res_data
    assert res_data["user"]["role"] == "citizen"

    # Login citizen
    citizen_login = client.post(
        "/api/auth/login",
        json={
            "email": "test_citizen@civora.in",
            "password": "password123"
        }
    )
    assert citizen_login.status_code == 200
    token = citizen_login.json()["access_token"]

    # Profile check with token
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "test_citizen@civora.in"

    # Admin Login (seeded admin)
    admin_login = client.post(
        "/api/auth/login",
        json={
            "email": "admin@civora.gov.in",
            "password": "admin123"
        }
    )
    assert admin_login.status_code == 200
    assert admin_login.json()["user"]["role"] == "admin"


def test_3_4_5_6_submit_complaint_image_upload_ai_predict_store_db():
    # Test Standalone AI Predict Endpoint
    dummy_image = BytesIO(b"fake image data for testing")
    ai_res = client.post(
        "/api/predict",
        files={"file": ("pothole_test.jpg", dummy_image, "image/jpeg")}
    )
    assert ai_res.status_code == 200
    predict_data = ai_res.json()
    assert "issue" in predict_data
    assert "confidence" in predict_data
    assert "priority" in predict_data
    assert "department" in predict_data

    # Submit Complaint with Image Upload
    dummy_image_2 = BytesIO(b"complaint photo data")
    complaint_res = client.post(
        "/api/complaints",
        data={
            "title": "Broken Street Lamp Near Main Gate",
            "description": "Street light flickering and dark at night.",
            "category": "streetlight",
            "district": "Bokaro",
            "ward": "Ward 5",
            "location": "Sector 4, Bokaro"
        },
        files={"image_file": ("lamp.jpg", dummy_image_2, "image/jpeg")}
    )
    assert complaint_res.status_code == 201
    c_data = complaint_res.json()
    assert c_data["id"].startswith("STL-")
    assert c_data["title"] == "Broken Street Lamp Near Main Gate"
    assert c_data["category"] == "streetlight"
    assert c_data["status"] == "Reported"
    assert c_data["beforeImage"].startswith("/uploads/")


def test_7_assign_department():
    # Fetch existing complaint
    all_res = client.get("/api/complaints")
    assert all_res.status_code == 200
    complaints = all_res.json()
    target_id = complaints[0]["id"]

    # Assign Department
    assign_res = client.put(
        f"/api/complaints/{target_id}/assign",
        json={"department": "Public Works Department (PWD)"}
    )
    assert assign_res.status_code == 200
    updated_data = assign_res.json()
    assert updated_data["assignedDepartment"] == "Public Works Department (PWD)"
    assert updated_data["status"] == "In Progress"


def test_8_update_status():
    all_res = client.get("/api/complaints")
    target_id = all_res.json()[0]["id"]

    status_res = client.put(
        f"/api/complaints/{target_id}/status",
        json={"status": "In Progress"}
    )
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "In Progress"


def test_9_10_11_resolution_proof_verification_reopen():
    all_res = client.get("/api/complaints")
    target_id = all_res.json()[0]["id"]

    # 9. Upload Resolution Proof Photo
    proof_img = BytesIO(b"repair proof image content")
    proof_res = client.post(
        f"/api/complaints/{target_id}/resolution-proof",
        files={"proof_image": ("repaired.jpg", proof_img, "image/jpeg")}
    )
    assert proof_res.status_code == 200
    proof_data = proof_res.json()
    assert proof_data["status"] == "Pending Verification"
    assert proof_data["afterImage"].startswith("/uploads/")

    # 11. Reopen Complaint (Citizen Rejection)
    reopen_res = client.post(
        f"/api/complaints/{target_id}/verify",
        json={"approved": False, "rating": 2, "feedback": "Road surface is still uneven."}
    )
    assert reopen_res.status_code == 200
    reopen_data = reopen_res.json()
    assert reopen_data["status"] == "In Progress"
    assert "Re-opened by citizen" in reopen_data["verificationFeedback"]

    # 9b. Re-submit resolution proof
    client.post(
        f"/api/complaints/{target_id}/resolution-proof",
        files={"proof_image": ("repaired_v2.jpg", proof_img, "image/jpeg")}
    )

    # 10. Citizen Verification Approval
    verify_res = client.post(
        f"/api/complaints/{target_id}/verify",
        json={"approved": True, "rating": 5, "feedback": "Great fix! Smooth surface now."}
    )
    assert verify_res.status_code == 200
    verified_data = verify_res.json()
    assert verified_data["status"] == "Resolved"
    assert "Verified and approved" in verified_data["verificationFeedback"]


def test_12_notifications():
    notif_res = client.get("/api/notifications")
    assert notif_res.status_code == 200
    notifs = notif_res.json()
    assert len(notifs) > 0

    target_notif = notifs[0]
    read_res = client.put(f"/api/notifications/{target_notif['id']}/read")
    assert read_res.status_code == 200
    assert read_res.json()["is_read"] is True
