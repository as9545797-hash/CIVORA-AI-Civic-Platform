import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCivic } from "../context/CivicContext";
import { predictAIVision } from "../services/api";
import { JHARKHAND_DISTRICTS } from "../constants/districts";

function ReportIssue() {
  const navigate = useNavigate();
  const { addIssue, backendOnline } = useCivic();

  const [rawFile, setRawFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState("");
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
        setLocation(`Main Road, ${district}, Jharkhand (Default)`);
        alert(`Unable to detect precise GPS. Set default location for ${district}.`);
      }
    );
  };

  // AI ANALYSIS (Calls Backend /api/predict)
  const analyzeIssue = async () => {
    if (analyzing) return;
    if (!imagePreview && !rawFile) {
      alert("Please upload an issue photo first.");
      return;
    }

    if (!backendOnline) {
      setErrorMessage("Backend server is offline. AI vision analysis requires a running backend.");
      return;
    }

    setAnalyzing(true);
    setResult(null);
    setErrorMessage(null);

    console.log("[AI] Starting analysis request");
    setAnalysisStage("Uploading image...");

    try {
      setAnalysisStage("Checking image quality...");
      await new Promise((resolve) => setTimeout(resolve, 100));

      setAnalysisStage("Running AI vision...");
      console.log("[AI] Request sent, expected_category:", category || "(auto-detect)");
      const aiData = await predictAIVision(rawFile, category);
      console.log("[AI] Response received", aiData);

      setAnalysisStage("Evaluating civic issue...");
      await new Promise((resolve) => setTimeout(resolve, 100));

      const confVal = typeof aiData.confidence === "number" ? aiData.confidence : 0;
      const confidenceFormatted = `${Math.round(confVal * 100)}%`;

      setResult({
        is_civic_issue: aiData.is_civic_issue === true,
        issue: aiData.issue || "Not a Civic Issue",
        category: aiData.category || null,
        confidence: confidenceFormatted,
        priority: aiData.priority || null,
        department: aiData.department || null,
        reason: aiData.reason || aiData.message || "AI analysis completed.",
        message: aiData.message || "Analysis complete.",
        analysis_time_seconds: aiData.analysis_time_seconds ?? null
      });
    } catch (err) {
      console.error("AI analysis API failed:", err);
      setErrorMessage(err.message || "AI analysis failed. Please ensure the backend is running and try again.");
      setResult(null);
    } finally {
      setAnalyzing(false);
      setAnalysisStage("");
    }
  };

  // FINAL SUBMISSION TO BACKEND
  const handleSubmitIssue = async () => {
    if (!result || !result.is_civic_issue) {
      alert("Only valid civic issues can be submitted.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("title", result.issue);
      formData.append("description", description || `${result.issue} reported in ${district}.`);
      const categoryForDb = (() => {
        const aiCat = result.category;
        if (category) return category;
        if (aiCat === "sanitation") return "garbage";
        if (aiCat === "electrical") return "streetlight";
        if (aiCat === "road") return "road";
        return "road";
      })();

      formData.append("category", categoryForDb);
      formData.append("district", district);
      formData.append("ward", "Ward 1");
      formData.append("location", location || `${district}, Jharkhand`);
      formData.append("priority", result.priority || "Medium");
      formData.append("department", result.department || "General Municipal Department");
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
              <label>Expected Issue Type (Optional / Auto-detect)</label>
              <select
                className="category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">🤖 AI Detects Automatically</option>
                <option value="road">🕳️ Road / Pothole</option>
                <option value="garbage">🗑️ Garbage / Waste</option>
                <option value="streetlight">💡 Streetlight / Electrical</option>
              </select>
            </div>

            <div className="form-section">
              <label>Jharkhand District *</label>
              <select
                className="category-select"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
              >
                {JHARKHAND_DISTRICTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
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
            {analyzing ? `🤖 ${analysisStage}` : "🤖 Run AI Vision Analysis"}
          </button>

          {/* AI RESULT CARD */}
          {result && (
            <div className={`ai-result ${result.is_civic_issue ? "civic-approved" : "civic-rejected"}`}>
              <div className="ai-result-header">
                <h2>{result.is_civic_issue ? "🤖 AI Analysis Complete" : "⚠️ AI Analysis — Not a Civic Issue"}</h2>
                <span>{result.is_civic_issue ? "✓" : "✕"}</span>
              </div>

              {result.analysis_time_seconds !== undefined && (
                <p className="analysis-time-badge">
                  ⚡ Analysis time: <strong>{result.analysis_time_seconds} seconds</strong>
                </p>
              )}

              {result.is_civic_issue ? (
                <>
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
                      <strong className={`priority-${(result.priority || "medium").toLowerCase()}`}>
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

                  {result.reason && (
                    <div className="ai-reason-box" style={{ marginTop: "1rem", padding: "0.8rem", background: "rgba(34, 197, 94, 0.08)", borderRadius: "8px", fontSize: "0.9rem" }}>
                      <strong>Reason:</strong> {result.reason}
                    </div>
                  )}

                  <button
                    type="button"
                    className="submit-report-btn"
                    onClick={handleSubmitIssue}
                    disabled={submitting}
                    style={{ marginTop: "1.2rem" }}
                  >
                    {submitting ? "Submitting to Backend..." : "🚀 Confirm & Register Complaint"}
                  </button>
                </>
              ) : (
                <div className="rejection-box" style={{ marginTop: "1rem", padding: "1rem", background: "rgba(239, 68, 68, 0.1)", borderRadius: "8px" }}>
                  <h3 style={{ color: "#ef4444", marginBottom: "0.5rem" }}>Not a Civic Issue</h3>
                  <p style={{ fontSize: "0.95rem", color: "#374151" }}>
                    <strong>Reason:</strong> {result.reason}
                  </p>
                  <p style={{ marginTop: "0.75rem", fontSize: "0.85rem", color: "#6b7280" }}>
                    ℹ️ Only photos of potholes, garbage accumulation, or damaged streetlights can be registered as civic complaints.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ReportIssue;