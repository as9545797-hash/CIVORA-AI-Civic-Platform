import os
import sys
import time
from PIL import Image
from io import BytesIO
from fastapi.testclient import TestClient

# Ensure backend directory is in python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.ai_engine import load_ai_models

client = TestClient(app)

def run_verification():
    print("==================================================")
    print("CIVORA AI ENGINE - STEP 10 FINAL PRODUCTION VERIFICATION")
    print("==================================================")

    # Pre-load models to verify single load logic
    t_load_start = time.time()
    loaded = load_ai_models()
    t_load_ms = (time.time() - t_load_start) * 1000
    print(f"[AI SETUP] Models initialized into memory in {t_load_ms:.2f} ms (Loaded={loaded})\n")

    sample_dir = os.path.join(os.path.dirname(__file__), "sample_images")
    pothole_path = os.path.join(sample_dir, "real_pothole.jpg")
    garbage_path = os.path.join(sample_dir, "garbage.jpg")
    streetlight_path = os.path.join(sample_dir, "streetlight.jpg")
    unrelated_path = os.path.join(sample_dir, "normal_landscape.jpg")

    # TEST 1: Pothole + expected_category=road
    print("--------------------------------------------------")
    print("TEST 1: Pothole + expected_category=road")
    print("--------------------------------------------------")
    t0 = time.time()
    with open(pothole_path, "rb") as f:
        res1 = client.post(
            "/predict",
            files={"file": ("pothole.jpg", f, "image/jpeg")},
            data={"expected_category": "road"}
        )
    t1_ms = (time.time() - t0) * 1000
    d1 = res1.json()
    print(f"  expected_category: 'road'")
    print(f"  model executed: Pothole model only")
    print(f"  raw confidence: {d1.get('confidence')}")
    print(f"  final decision: is_civic={d1.get('is_civic_issue')}, issue='{d1.get('issue')}', category='{d1.get('category')}'")
    print(f"  reason: '{d1.get('reason')}'")
    print(f"  total request time: {t1_ms:.2f} ms ({d1.get('analysis_time_seconds')}s)")
    assert res1.status_code == 200
    assert d1.get("is_civic_issue") is True
    assert d1.get("issue") == "Pothole"
    assert d1.get("category") == "road"

    # TEST 2: Garbage + expected_category=garbage
    print("\n--------------------------------------------------")
    print("TEST 2: Garbage + expected_category=garbage")
    print("--------------------------------------------------")
    t0 = time.time()
    with open(garbage_path, "rb") as f:
        res2 = client.post(
            "/predict",
            files={"file": ("garbage.jpg", f, "image/jpeg")},
            data={"expected_category": "garbage"}
        )
    t2_ms = (time.time() - t0) * 1000
    d2 = res2.json()
    print(f"  expected_category: 'garbage'")
    print(f"  model executed: Garbage model only")
    print(f"  raw confidence: {d2.get('confidence')}")
    print(f"  final decision: is_civic={d2.get('is_civic_issue')}, issue='{d2.get('issue')}', category='{d2.get('category')}'")
    print(f"  reason: '{d2.get('reason')}'")
    print(f"  total request time: {t2_ms:.2f} ms ({d2.get('analysis_time_seconds')}s)")
    assert res2.status_code == 200
    assert d2.get("is_civic_issue") is True
    assert d2.get("issue") == "Garbage / Waste"
    assert d2.get("category") == "sanitation"

    # TEST 3: Streetlight + expected_category=streetlight
    print("\n--------------------------------------------------")
    print("TEST 3: Streetlight + expected_category=streetlight")
    print("--------------------------------------------------")
    t0 = time.time()
    with open(streetlight_path, "rb") as f:
        res3 = client.post(
            "/predict",
            files={"file": ("streetlight.jpg", f, "image/jpeg")},
            data={"expected_category": "streetlight"}
        )
    t3_ms = (time.time() - t0) * 1000
    d3 = res3.json()
    print(f"  expected_category: 'streetlight'")
    print(f"  model executed: Streetlight model only")
    print(f"  raw confidence: {d3.get('confidence')}")
    print(f"  final decision: is_civic={d3.get('is_civic_issue')}, issue='{d3.get('issue')}', category='{d3.get('category')}'")
    print(f"  reason: '{d3.get('reason')}'")
    print(f"  total request time: {t3_ms:.2f} ms ({d3.get('analysis_time_seconds')}s)")
    assert res3.status_code == 200
    assert d3.get("is_civic_issue") is True
    assert d3.get("issue") == "Streetlight / Electrical"
    assert d3.get("category") == "electrical"

    # TEST 4: Clearly unrelated image + automatic mode
    print("\n--------------------------------------------------")
    print("TEST 4: Clearly Unrelated Image + Automatic Mode")
    print("--------------------------------------------------")
    t0 = time.time()
    with open(unrelated_path, "rb") as f:
        res4 = client.post(
            "/predict",
            files={"file": ("unrelated.jpg", f, "image/jpeg")}
        )
    t4_ms = (time.time() - t0) * 1000
    d4 = res4.json()
    print(f"  expected_category: '' (Automatic Mode)")
    print(f"  models executed: Candidate models evaluated")
    print(f"  raw confidence: {d4.get('confidence')}")
    print(f"  final decision: is_civic={d4.get('is_civic_issue')}, issue='{d4.get('issue')}', category={d4.get('category')}")
    print(f"  reason: '{d4.get('reason')}'")
    print(f"  total request time: {t4_ms:.2f} ms ({d4.get('analysis_time_seconds')}s)")
    assert res4.status_code == 200
    assert d4.get("is_civic_issue") is False
    assert d4.get("issue") == "Not a Civic Issue"

    print("\n==================================================")
    print("FINAL STEP 10 VERIFICATION SUMMARY")
    print("==================================================")
    print(f"✓ TEST 1 (Pothole): {t1_ms:.2f} ms (is_civic={d1.get('is_civic_issue')}, issue={d1.get('issue')})")
    print(f"✓ TEST 2 (Garbage): {t2_ms:.2f} ms (is_civic={d2.get('is_civic_issue')}, issue={d2.get('issue')})")
    print(f"✓ TEST 3 (Streetlight): {t3_ms:.2f} ms (is_civic={d3.get('is_civic_issue')}, issue={d3.get('issue')})")
    print(f"✓ TEST 4 (Unrelated): {t4_ms:.2f} ms (is_civic={d4.get('is_civic_issue')}, issue={d4.get('issue')})")
    print("==================================================")

if __name__ == "__main__":
    run_verification()
