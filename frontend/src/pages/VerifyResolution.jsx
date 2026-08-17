import { useState } from "react";
import { Link } from "react-router-dom";
import { useCivic } from "../context/CivicContext";

function VerifyResolution() {
  const { issues, verifyIssueResolution, backendOnline } = useCivic();

  // Find issues that are in 'Pending Verification' or recently acted on
  const pendingIssues = issues.filter(
    (item) => item.status === "Pending Verification" || item.status === "Resolved" || item.status === "In Progress"
  );

  const [selectedIssueId, setSelectedIssueId] = useState(
    pendingIssues[0]?.id || issues[0]?.id || ""
  );

  const activeIssue = issues.find((item) => item.id === selectedIssueId) || issues[0];

  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");
  const [actionSuccess, setActionSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleApprove = async () => {
    if (!activeIssue) return;
    setSubmitting(true);
    try {
      await verifyIssueResolution(activeIssue.id, true, rating, feedback);
      setActionSuccess({
        type: "approved",
        title: "Resolution Approved & Verified!",
        message: `Issue ${activeIssue.id} has been marked as officially Resolved. Thank you for empowering your community!`
      });
      setFeedback("");
    } catch (err) {
      alert("Failed to verify resolution.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!activeIssue) return;
    if (!feedback.trim()) {
      alert("Please enter a short reason for rejecting the repair work.");
      return;
    }
    setSubmitting(true);
    try {
      await verifyIssueResolution(activeIssue.id, false, rating, feedback);
      setActionSuccess({
        type: "rejected",
        title: "Re-work Requested (Re-opened)",
        message: `Issue ${activeIssue.id} has been re-opened and sent back to the department for correction.`
      });
      setFeedback("");
    } catch (err) {
      alert("Failed to reject resolution.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="verify-page">
      {/* HEADER */}
      <div className="verify-header">
        <div>
          <span className="verify-badge">CITIZEN PROOF OF WORK VERIFICATION</span>
          <h1>Verify Issue Resolution</h1>
          <p>
            You are the final authority. Inspect before and after repair photos uploaded by municipal contractors and approve or reject completed works.
          </p>
        </div>

        <Link to="/dashboard" className="secondary-btn">
          ← Back to My Dashboard
        </Link>
      </div>

      {!backendOnline && (
        <div className="action-banner rejected" style={{ marginBottom: "1.5rem" }}>
          ⚠️ Backend server (https://civora-backend-omxf.onrender.com) is offline. Verification will update locally.
        </div>
      )}

      {actionSuccess && (
        <div className={`action-banner ${actionSuccess.type}`}>
          <div className="banner-icon">
            {actionSuccess.type === "approved" ? "🎉" : "🔄"}
          </div>
          <div>
            <h3>{actionSuccess.title}</h3>
            <p>{actionSuccess.message}</p>
          </div>
          <button
            className="close-banner"
            onClick={() => setActionSuccess(null)}
          >
            ×
          </button>
        </div>
      )}

      <div className="verify-grid">
        {/* SIDEBAR: PENDING ISSUE LIST */}
        <div className="verify-sidebar">
          <h3>Complaints Needing Verification</h3>
          <p className="small-text">Select an issue to review completed work:</p>

          <div className="pending-list">
            {pendingIssues.map((issue) => (
              <div
                key={issue.id}
                className={`pending-card ${
                  issue.id === activeIssue?.id ? "active" : ""
                }`}
                onClick={() => {
                  setSelectedIssueId(issue.id);
                  setActionSuccess(null);
                }}
              >
                <div className="pending-card-header">
                  <span className="issue-id">{issue.id}</span>
                  <span
                    className={`status-pill status-${issue.status
                      .toLowerCase()
                      .replace(/\s+/g, "-")}`}
                  >
                    {issue.status}
                  </span>
                </div>
                <h4>{issue.title}</h4>
                <p>📍 {issue.locationName}</p>
                <small>Department: {issue.assignedDepartment}</small>
              </div>
            ))}
          </div>
        </div>

        {/* MAIN PANEL: BEFORE / AFTER & RATING FORM */}
        {activeIssue ? (
          <div className="verify-main-panel">
            <div className="panel-header-row">
              <div>
                <span className="issue-id-large">{activeIssue.id}</span>
                <h2>{activeIssue.title}</h2>
                <p>📍 {activeIssue.locationName} • {activeIssue.assignedDepartment}</p>
              </div>
              <span className={`priority-tag ${activeIssue.priority.toLowerCase()}`}>
                {activeIssue.priority} Priority
              </span>
            </div>

            {/* BEFORE / AFTER PHOTO COMPARISON */}
            <div className="comparison-container">
              <div className="photo-box">
                <div className="photo-badge before-badge">📷 Original Issue Photo</div>
                <img
                  src={activeIssue.beforeImage}
                  alt="Original reported issue"
                  className="comparison-img"
                />
                <div className="photo-caption">
                  Reported by {activeIssue.reportedBy} on {activeIssue.createdAt}
                </div>
              </div>

              <div className="photo-box">
                <div className="photo-badge after-badge">✅ Contractor Repair Photo</div>
                <img
                  src={
                    activeIssue.afterImage ||
                    "https://images.unsplash.com/photo-1584467735871-8e85353a8413?auto=format&fit=crop&w=800&q=80"
                  }
                  alt="Completed work photo"
                  className="comparison-img"
                />
                <div className="photo-caption">
                  Uploaded by Contractor • Waiting for your sign-off
                </div>
              </div>
            </div>

            {/* VERIFICATION FORM */}
            <div className="verification-form-card">
              <h3>Citizen Sign-Off & Review</h3>
              <p className="form-sub">
                Is the repair satisfactory and completely resolved?
              </p>

              {activeIssue.verificationFeedback && (
                <div className="action-banner rejected" style={{ marginBottom: "1rem" }}>
                  💬 <strong>Current Feedback / Reopen Log:</strong> {activeIssue.verificationFeedback}
                </div>
              )}

              {/* STAR RATING */}
              <div className="rating-group">
                <label>Quality Rating:</label>
                <div className="star-rating">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={`star-btn ${star <= rating ? "filled" : ""}`}
                      onClick={() => setRating(star)}
                    >
                      ★
                    </button>
                  ))}
                  <span className="rating-label">
                    {rating === 5
                      ? "5/5 (Excellent Work)"
                      : rating === 4
                      ? "4/5 (Good)"
                      : rating === 3
                      ? "3/5 (Acceptable)"
                      : rating === 2
                      ? "2/5 (Subpar)"
                      : "1/5 (Unsatisfactory)"}
                  </span>
                </div>
              </div>

              {/* COMMENTS */}
              <div className="form-section">
                <label>Verification Comments & Feedback (Required if rejecting):</label>
                <textarea
                  placeholder="Share feedback for the municipal team (e.g. 'Road surface is smooth' or 'Debris left behind')..."
                  rows="3"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                />
              </div>

              {/* BUTTON ACTIONS */}
              <div className="action-buttons-row">
                <button
                  type="button"
                  className="approve-btn"
                  onClick={handleApprove}
                  disabled={submitting}
                >
                  ✓ Accept & Mark Resolved
                </button>

                <button
                  type="button"
                  className="reject-btn"
                  onClick={handleReject}
                  disabled={submitting}
                >
                  ❌ Reject & Request Re-Work
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="verify-main-panel empty">
            <h3>No pending verification items found</h3>
            <p>Check back when municipal contractors submit completed repair photos.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default VerifyResolution;
