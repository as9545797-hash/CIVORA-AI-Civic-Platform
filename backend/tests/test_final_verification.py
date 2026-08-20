import os
import sys
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.ai_engine import run_civora_ai, load_ai_models

def run_suite():
    load_ai_models()

    sample_dir = os.path.join(os.path.dirname(__file__), "sample_images")

    tests = [
        ("TEST A (Real Pothole AUTO)", os.path.join(sample_dir, "real_pothole.jpg"), None, "Pothole", True),
        ("TEST B (Garbage AUTO)", os.path.join(sample_dir, "garbage.jpg"), None, "Garbage", True),
        ("TEST C (Streetlight AUTO)", os.path.join(sample_dir, "streetlight.jpg"), None, "Streetlight", True),
        ("TEST D (Normal Landscape AUTO)", os.path.join(sample_dir, "normal_landscape.jpg"), None, "Not a Civic Issue", False),
        ("TEST E (Pothole Explicit)", os.path.join(sample_dir, "real_pothole.jpg"), "road", "Pothole", True),
        ("TEST F (Garbage Explicit)", os.path.join(sample_dir, "garbage.jpg"), "garbage", "Garbage", True),
        ("TEST G (Streetlight Explicit)", os.path.join(sample_dir, "streetlight.jpg"), "streetlight", "Streetlight", True),
        ("TEST H (Normal Road Explicit)", os.path.join(sample_dir, "normal_landscape.jpg"), "road", "Not a Civic Issue", False),
    ]

    print("==================================================")
    print("     CIVORA AI COMPLETE AUTO & EXPLICIT TEST      ")
    print("==================================================\n")

    all_passed = True

    for name, img_path, exp_cat, expected_issue, expected_civic in tests:
        t0 = time.time()
        res = run_civora_ai(img_path, expected_category=exp_cat)
        tot_sec = time.time() - t0

        passed = (res["issue"] == expected_issue and res["is_civic_issue"] == expected_civic)
        if not passed:
            all_passed = False

        issue_val = res["issue"]
        civic_val = res["is_civic_issue"]
        conf_val = res["confidence"]
        time_val = res.get("analysis_time_seconds", round(tot_sec, 3))
        status_str = "[PASS]" if passed else "[FAIL]"

        print(f"{name:32s} | Issue: {issue_val:18s} | Civic: {str(civic_val):5s} | Conf: {conf_val:.3f} | Time: {time_val:.3f}s | {status_str}")

    if all_passed:
        print("\nALL 8 TESTS PASSED PERFECTLY!")
        sys.exit(0)
    else:
        print("\nSOME TESTS FAILED!")
        sys.exit(1)

if __name__ == "__main__":
    run_suite()
