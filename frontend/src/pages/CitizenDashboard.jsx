import { useState } from "react";
import { Link } from "react-router-dom";
import { useCivic } from "../context/CivicContext";

function CitizenDashboard() {
  const { issues, loading, backendOnline } = useCivic();

  const totalCount = issues.length;
  const inProgressCount = issues.filter((i) => i.status === "In Progress").length;
  const resolvedCount = issues.filter((i) => i.status === "Resolved").length;
  const pendingVerifyCount = issues.filter((i) => i.status === "Pending Verification").length;

  const [selectedIssueId, setSelectedIssueId] = useState(issues[0]?.id || "");
  const activeIssue = issues.find((i) => i.id === selectedIssueId) || issues[0];

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <p className="welcome-text">Welcome back, Citizen 👋</p>
          <h1>My Civic Issue Dashboard</h1>
          <p className="dashboard-subtitle">
            Track your reported civic complaints, monitor work progress, and verify contractor resolution photos.
          </p>
        </div>

        <div className="dashboard-actions">
          <Link to="/verify" className="secondary-btn">
            ✓ Verify Work ({pendingVerifyCount})
          </Link>
          <Link to="/report" className="primary-btn">
            + Report New Issue
          </Link>
        </div>
      </div>

      {!backendOnline && (
        <div className="action-banner rejected" style={{ marginBottom: "1.5rem" }}>
          ⚠️ Backend server (https://civora-backend-omxf.onrender.com) is offline. Showing cached local complaints.
        </div>
      )}

      {loading && (
        <div className="action-banner info" style={{ marginBottom: "1.5rem" }}>
          ⏳ Connecting to CIVORA server...
        </div>
      )}

      {/* STATISTICS */}
      <div className="dashboard-stats">
        <div className="dashboard-stat">
          <span>📋</span>
          <div>
            <strong>{totalCount}</strong>
            <p>Total Complaints</p>
          </div>
        </div>

        <div className="dashboard-stat">
          <span>⏳</span>
          <div>
            <strong>{inProgressCount}</strong>
            <p>In Progress</p>
          </div>
        </div>

        <div className="dashboard-stat">
          <span>🔄</span>
          <div>
            <strong>{pendingVerifyCount}</strong>
            <p>Needs Verification</p>
          </div>
        </div>

        <div className="dashboard-stat">
          <span>✅</span>
          <div>
            <strong>{resolvedCount}</strong>
            <p>Resolved</p>
          </div>
        </div>
      </div>

      {/* RECENT ISSUES TABS / LIST */}
      <div className="dashboard-grid">
        <div className="dashboard-panel issue-selector-panel">
          <h3>Your Reported Complaints</h3>
          <p className="small-text">Select an issue to inspect its resolution timeline:</p>

          <div className="citizen-issue-list">
            {issues.map((issue) => (
              <div
                key={issue.id}
                className={`citizen-issue-card ${
                  issue.id === activeIssue?.id ? "active" : ""
                }`}
                onClick={() => setSelectedIssueId(issue.id)}
              >
                <div className="citizen-issue-header">
                  <span className="issue-id">{issue.id}</span>
                  <span
                    className={`status-badge status-${issue.status
                      .toLowerCase()
                      .replace(/\s+/g, "-")}`}
                  >
                    {issue.status}
                  </span>
                </div>
                <h4>{issue.title}</h4>
                <p>📍 {issue.locationName}</p>
                <small>Reported on: {issue.createdAt}</small>
              </div>
            ))}
          </div>
        </div>

        {/* ACTIVE ISSUE DETAILED WORKFLOW TIMELINE */}
        {activeIssue && (
          <div className="dashboard-panel current-issue">
            <div className="issue-heading">
              <div>
                <span className="issue-label">ISSUE #{activeIssue.id} • {activeIssue.categoryLabel}</span>
                <h2>{activeIssue.title}</h2>
                <p>📍 {activeIssue.locationName}</p>
                <p className="issue-dept-info">Assigned Department: <strong>{activeIssue.assignedDepartment}</strong></p>
              </div>

              <span
                className={`status-badge status-${activeIssue.status
                  .toLowerCase()
                  .replace(/\s+/g, "-")}`}
              >
                {activeIssue.status}
              </span>
            </div>

            {activeIssue.verificationFeedback && (
              <div className="action-banner rejected" style={{ marginTop: "1rem" }}>
                💬 <strong>Citizen Verification Log:</strong> {activeIssue.verificationFeedback}
              </div>
            )}

            {/* TIMELINE */}
            <div className="timeline-container">
              <h3>Resolution Workflow</h3>

              <div className="timeline">
                {activeIssue.timeline.map((item, index) => (
                  <div
                    key={index}
                    className={`timeline-item ${
                      item.completed
                        ? "completed"
                        : item.step === activeIssue.status
                        ? "active"
                        : ""
                    }`}
                  >
                    <div className="timeline-dot">
                      {item.completed ? "✓" : index + 1}
                    </div>

                    <div className="timeline-content">
                      <strong>{item.step}</strong>
                      <p>{item.details}</p>
                      <small className="timeline-date">{item.date}</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {activeIssue.status === "Pending Verification" && (
              <div className="timeline-cta-box">
                <div className="cta-info">
                  <h4>Work Completed by Contractor!</h4>
                  <p>Inspect the repair photo and confirm if the work meets your satisfaction.</p>
                </div>
                <Link to="/verify" className="primary-btn">
                  Inspect & Verify Repair →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CitizenDashboard;