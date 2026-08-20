import os
import sys
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.ai_engine import run_civora_ai, load_ai_models

def run_suite():
    load_ai_models()

    sample_dir = os.path.join(os.path.dirname(__file__), "sample_images")

    tests = [
        ("TEST A (Real Pothole AUTO)", os.path.join(sample_dir, "real_pothole.jpg"), None, "Pothole", "road", True),
        ("TEST B (Garbage AUTO)", os.path.join(sample_dir, "garbage.jpg"), None, "Garbage / Waste", "sanitation", True),
        ("TEST C (Streetlight AUTO)", os.path.join(sample_dir, "streetlight.jpg"), None, "Streetlight / Electrical", "electrical", True),
        ("TEST D (Normal Landscape AUTO)", os.path.join(sample_dir, "normal_landscape.jpg"), None, "Not a Civic Issue", None, False),
        ("TEST E (Pothole Explicit)", os.path.join(sample_dir, "real_pothole.jpg"), "road", "Pothole", "road", True),
        ("TEST F (Garbage Explicit)", os.path.join(sample_dir, "garbage.jpg"), "garbage", "Garbage / Waste", "sanitation", True),
        ("TEST G (Streetlight Explicit)", os.path.join(sample_dir, "streetlight.jpg"), "streetlight", "Streetlight / Electrical", "electrical", True),
        ("TEST H (Normal Road Explicit)", os.path.join(sample_dir, "normal_landscape.jpg"), "road", "Not a Civic Issue", None, False),
    ]

    print("==================================================")
    print("     CIVORA AI COMPLETE AUTO & EXPLICIT TEST      ")
    print("==================================================\n")

    all_passed = True
    confidences = []

    for name, img_path, exp_cat, expected_issue, expected_category, expected_civic in tests:
        t0 = time.time()
        res = run_civora_ai(img_path, expected_category=exp_cat)
        tot_sec = time.time() - t0

        passed = (
            res["issue"] == expected_issue
            and res["is_civic_issue"] == expected_civic
            and res.get("category") == expected_category
        )
        if not passed:
            all_passed = False

        confidences.append(res["confidence"])
        status_str = "[PASS]" if passed else "[FAIL]"

        print(f"{name:32s} | Issue: {res['issue']:26s} | Civic: {str(res['is_civic_issue']):5s} | Conf: {res['confidence']:.3f} | Time: {res.get('analysis_time_seconds', round(tot_sec, 3)):.3f}s | {status_str}")
        print(f"{'':32s}   category={res.get('category')} | reason={res.get('reason', '')[:80]}")

    unique_conf = len(set(confidences))
    print(f"\nUnique confidence values across 8 tests: {unique_conf} (values: {confidences})")
    if unique_conf < 2:
        print("WARNING: Confidence values are not varying across images!")
        all_passed = False

    if all_passed:
        print("\nALL 8 TESTS PASSED PERFECTLY!")
        sys.exit(0)
    else:
        print("\nSOME TESTS FAILED!")
        sys.exit(1)

if __name__ == "__main__":
    run_suite()
