import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCivic } from "../context/CivicContext";
import { predictAIVision } from "../services/api";

const CATEGORY_OPTIONS = [
  { value: "road", label: "🕳️ Road / Pothole" },
  { value: "garbage", label: "🗑️ Garbage / Waste" },
  { value: "streetlight", label: "💡 Streetlight / Electrical" },
];

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

  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setRawFile(file);
      setImagePreview(URL.createObjectURL(file));
      setResult(null);
      setErrorMessage(null);
    }
  };

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

  const analyzeIssue = async () => {
    if (!imagePreview && !rawFile) {
      alert("Please upload an issue photo first.");
      return;
    }

    if (!backendOnline) {
      setErrorMessage("Backend server is unreachable. AI analysis requires an active connection.");
      return;
    }

    setAnalyzing(true);
    setResult(null);
    setErrorMessage(null);

    try {
      const aiData = await predictAIVision(rawFile);

      if (!aiData.is_civic_issue) {
        setResult({
          isCivicIssue: false,
          issue: aiData.issue || "Not a Civic Issue",
          message:
            aiData.message ||
            "This image does not appear to contain a supported civic issue. Please upload a photo of a pothole, garbage accumulation, or damaged streetlight.",
        });
        return;
      }

      const confidenceFormatted =
        typeof aiData.confidence === "number"
          ? `${Math.round(aiData.confidence * 100)}%`
          : String(aiData.confidence || "0%");

      const detectedCategory = aiData.category || category;
      if (detectedCategory) {
        setCategory(detectedCategory);
      }

      setResult({
        isCivicIssue: true,
        issue: aiData.issue,
        confidence: confidenceFormatted,
        priority: aiData.priority,
        department: aiData.department,
        category: detectedCategory,
      });
    } catch (err) {
      console.warn("AI analysis API failed:", err);
      setErrorMessage(err.message || "AI analysis failed. Please try again with a clearer photo.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmitIssue = async () => {
    if (!result || !result.isCivicIssue) {
      alert("Please analyze a supported civic issue photo first.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("title", result.issue);
      formData.append("description", description || `${result.issue} reported in ${district}.`);
      formData.append("category", result.category || category);
      formData.append("district", district);
      formData.append("ward", "Ward 1");
      formData.append("location", location || `${district}, Jharkhand`);

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
      <div className="report-header">
        <h1>Report a Civic Issue</h1>
        <p>
          Upload a photo of a pothole, garbage accumulation, or damaged streetlight. CIVORA's AI vision engine will verify the issue, determine severity, and route it to the appropriate Jharkhand department.
        </p>
      </div>

      {!backendOnline && (
        <div className="action-banner rejected" style={{ marginBottom: "1.5rem" }}>
          ⚠️ Backend server unreachable. AI analysis and complaint submission require the backend.
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
          <h2>📸 Upload Issue Photo</h2>
          <p className="small-text">Take or choose a clear photo of a pothole, garbage, or streetlight issue.</p>

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

          <div className="form-grid">
            <div className="form-section">
              <label>Expected Issue Type (optional hint)</label>
              <select
                className="category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">AI will detect automatically...</option>
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
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

          <div className="form-section">
            <label>Description & Notes</label>
            <textarea
              placeholder="Provide any extra context (e.g. near landmarks, landmark names, severity)..."
              rows="4"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

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

          <button
            type="button"
            className="analyze-btn"
            onClick={analyzeIssue}
            disabled={analyzing || !rawFile}
          >
            {analyzing ? "🤖 Running AI Vision Model..." : "🤖 Run AI Vision Analysis"}
          </button>

          {result && !result.isCivicIssue && (
            <div className="ai-result rejected-result">
              <div className="ai-result-header">
                <h2>❌ Not a Civic Issue</h2>
              </div>
              <p className="rejection-message">{result.message}</p>
            </div>
          )}

          {result && result.isCivicIssue && (
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
