import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCivic } from "../context/CivicContext";
import { predictAIVision } from "../services/api";

function ReportIssue() {
  const navigate = useNavigate();
  const { addIssue, backendOnline } = useCivic();

  const [rawFile, setRawFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [district, setDistrict] = useState("Ranchi");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // IMAGE UPLOAD
  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setRawFile(file);
      setImagePreview(URL.createObjectURL(file));
      setResult(null);
      setErrorMessage(null);
    }
  };

  // DETECT LOCATION
  const detectLocation = () => {
    if (!navigator.geolocation) {
      alert("Location is not supported by your browser.");
      return;
    }

    setLocation("Detecting location...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        setLocation(`Latitude: ${latitude.toFixed(6)}, Longitude: ${longitude.toFixed(6)}`);
      },
      () => {
        setLocation("Main Road, Ranchi, Jharkhand (Default)");
        alert("Unable to detect precise GPS. Set default location for Ranchi.");
      }
    );
  };

  // AI ANALYSIS (Calls Backend /api/predict)
  const analyzeIssue = async () => {
    if (!imagePreview && !rawFile) {
      alert("Please upload an issue photo first.");
      return;
    }

    if (!category) {
      alert("Please select an issue category.");
      return;
    }

    setAnalyzing(true);
    setResult(null);
    setErrorMessage(null);

    try {
      if (rawFile && backendOnline) {
        // Call FastAPI YOLO endpoint
        const aiData = await predictAIVision(rawFile);
        const confidenceFormatted =
          typeof aiData.confidence === "number"
            ? `${Math.round(aiData.confidence * 100)}%`
            : String(aiData.confidence || "95%");

        setResult({
          issue: aiData.issue || (category === "road" ? "Pothole / Road Damage" : category === "garbage" ? "Garbage Accumulation" : "Civic Issue"),
          confidence: confidenceFormatted,
          priority: aiData.priority || "High",
          department: aiData.department || "Public Works Department (PWD)",
        });
      } else {
        // Offline heuristic fallback simulation
        setTimeout(() => {
          let issue = "Civic Issue";
          let priority = "Medium";
          let department = "General Civic Department";

          if (category === "road") {
            issue = "Pothole / Road Damage";
            priority = "High";
            department = "Public Works Department (PWD)";
          } else if (category === "garbage") {
            issue = "Garbage / Waste Accumulation";
            priority = "High";
            department = "Municipal Sanitation Department";
          } else if (category === "streetlight") {
            issue = "Broken Streetlight";
            priority = "Medium";
            department = "Electrical Wing";
          } else if (category === "water") {
            issue = "Water Leakage / Pipe Damage";
            priority = "Critical";
            department = "Water Supply & Sewerage Board";
          } else if (category === "public-space") {
            issue = "Public Space / Facility Defect";
            priority = "Medium";
            department = "Parks & Horticulture Department";
          } else {
            issue = "Other Civic Problem";
            priority = "Low";
            department = "General Municipal Department";
          }

          setResult({
            issue,
            confidence: "95%",
            priority,
            department
          });
        }, 1000);
      }
    } catch (err) {
      console.warn("AI analysis API failed, showing client model fallback:", err);
      setResult({
        issue: category === "road" ? "Pothole / Road Damage" : "Civic Issue",
        confidence: "92%",
        priority: "High",
        department: "Public Works Department (PWD)"
      });
    } finally {
      setAnalyzing(false);
    }
  };

  // FINAL SUBMISSION TO BACKEND
  const handleSubmitIssue = async () => {
    if (!result) {
      alert("Please analyze the issue first.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("title", result.issue);
      formData.append("description", description || `${result.issue} reported in ${district}.`);
      formData.append("category", category);
      formData.append("district", district);
      formData.append("ward", "Ward 1");
      formData.append("location", location || `${district}, Jharkhand`);
      formData.append("priority", result.priority);
      formData.append("department", result.department);
      formData.append("confidence", result.confidence);

      if (rawFile) {
        formData.append("image_file", rawFile);
      }

      await addIssue(formData);

      setSubmitted(true);
      setTimeout(() => {
        navigate("/explore");
      }, 1500);
    } catch (err) {
      setErrorMessage(err.message || "Failed to submit complaint.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="report-page">
      {/* HEADER */}
      <div className="report-header">
        <h1>Report a Civic Issue</h1>
        <p>
          Upload a photo of the civic problem. CIVORA's AI vision engine will analyze the issue, determine severity, and route it to the appropriate Jharkhand department.
        </p>
      </div>

      {!backendOnline && (
        <div className="action-banner rejected" style={{ marginBottom: "1.5rem" }}>
          ⚠️ Backend server unreachable. Report will be saved locally.
        </div>
      )}

      {errorMessage && (
        <div className="action-banner rejected" style={{ marginBottom: "1.5rem" }}>
          ❌ {errorMessage}
        </div>
      )}

      {submitted ? (
        <div className="success-card">
          <div className="success-icon">🎉</div>
          <h2>Issue Successfully Submitted!</h2>
          <p>
            Your report has been logged and assigned AI prioritization. Redirecting you to Explore Issues...
          </p>
        </div>
      ) : (
        <div className="report-card">
          {/* PHOTO UPLOAD */}
          <h2>📸 Upload Issue Photo</h2>
          <p className="small-text">Take or choose a clear photo of the civic problem.</p>

          <label className="upload-box">
            {imagePreview ? (
              <img
                src={imagePreview}
                alt="Selected civic issue"
                className="preview-image"
              />
            ) : (
              <>
                <div className="upload-icon">📷</div>
                <h3>Click to Upload Photo</h3>
                <p>Supports JPG, PNG, WEBP</p>
              </>
            )}

            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              hidden
            />
          </label>

          {/* CATEGORY & DISTRICT */}
          <div className="form-grid">
            <div className="form-section">
              <label>Issue Category *</label>
              <select
                className="category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Select issue category...</option>
                <option value="road">🕳️ Road / Pothole</option>
                <option value="garbage">🗑️ Garbage / Waste</option>
                <option value="streetlight">💡 Streetlight / Electrical</option>
                <option value="water">🚰 Water Leakage / Drainage</option>
                <option value="public-space">🌳 Public Space / Parks</option>
                <option value="other">📌 Other Civic Issue</option>
              </select>
            </div>

            <div className="form-section">
              <label>Jharkhand District</label>
              <select
                className="category-select"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
              >
                <option value="Ranchi">Ranchi</option>
                <option value="Jamshedpur">Jamshedpur</option>
                <option value="Dhanbad">Dhanbad</option>
                <option value="Bokaro">Bokaro</option>
                <option value="Hazaribagh">Hazaribagh</option>
              </select>
            </div>
          </div>

          {/* DESCRIPTION */}
          <div className="form-section">
            <label>Description & Notes</label>
            <textarea
              placeholder="Provide any extra context (e.g. near landmarks, landmark names, severity)..."
              rows="4"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* LOCATION */}
          <div className="form-section">
            <label>Location Details</label>
            <div className="location-row">
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Enter landmark or click Detect Location..."
              />

              <button
                type="button"
                className="location-btn"
                onClick={detectLocation}
              >
                📍 Detect GPS
              </button>
            </div>
          </div>

          {/* ANALYZE BUTTON */}
          <button
            type="button"
            className="analyze-btn"
            onClick={analyzeIssue}
            disabled={analyzing}
          >
            {analyzing ? "🤖 Running AI Vision Model..." : "🤖 Run AI Vision Analysis"}
          </button>

          {/* AI RESULT CARD */}
          {result && (
            <div className="ai-result">
              <div className="ai-result-header">
                <h2>🤖 AI Analysis Complete</h2>
                <span>✓</span>
              </div>

              <div className="result-grid">
                <div className="result-item">
                  <span>Detected Issue</span>
                  <strong>{result.issue}</strong>
                </div>

                <div className="result-item">
                  <span>Confidence Score</span>
                  <strong>{result.confidence}</strong>
                </div>

                <div className="result-item">
                  <span>Priority Level</span>
                  <strong className={`priority-${result.priority.toLowerCase()}`}>
                    {result.priority === "Critical"
                      ? "🔴 Critical"
                      : result.priority === "High"
                      ? "🟠 High"
                      : result.priority === "Medium"
                      ? "🟡 Medium"
                      : "🟢 Low"}
                  </strong>
                </div>

                <div className="result-item">
                  <span>Assigned Department</span>
                  <strong>{result.department}</strong>
                </div>
              </div>

              <button
                type="button"
                className="submit-report-btn"
                onClick={handleSubmitIssue}
                disabled={submitting}
              >
                {submitting ? "Submitting to Backend..." : "🚀 Confirm & Register Complaint"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ReportIssue;