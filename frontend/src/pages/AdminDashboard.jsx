import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useCivic } from "../context/CivicContext";
import CivicMap from "../components/CivicMap";

function AdminDashboard() {
  const {
    issues,
    assignIssue,
    updateIssueStatus,
    uploadResolutionProof,
    backendOnline,
    userRole,
    fetchRegisteredUsers
  } = useCivic();

  const totalCount = issues.length;
  const criticalCount = issues.filter((i) => i.priority === "Critical" || i.priority === "High").length;
  const pendingCount = issues.filter((i) => i.status === "Reported" || i.status === "In Progress").length;
  const resolvedCount = issues.filter((i) => i.status === "Resolved").length;

  const [assigningIssue, setAssigningIssue] = useState(null);
  const [selectedDept, setSelectedDept] = useState("");
  const [proofModalIssue, setProofModalIssue] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [proofUrl, setProofUrl] = useState("");
  const [actionSuccess, setActionSuccess] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Registered Citizens state
  const [citizens, setCitizens] = useState([]);
  const [citizensLoading, setCitizensLoading] = useState(true);
  const [citizensError, setCitizensError] = useState(null);
  const [citizenSearch, setCitizenSearch] = useState("");

  // Load Registered Citizens from Backend API
  const loadCitizens = useCallback(async () => {
    setCitizensLoading(true);
    setCitizensError(null);
    try {
      const data = await fetchRegisteredUsers();
      if (Array.isArray(data)) {
        setCitizens(data);
      } else {
        setCitizens([]);
      }
    } catch (err) {
      console.warn("Failed to fetch registered citizens:", err.message);
      setCitizensError(err.message || "Failed to load registered citizens");
    } finally {
      setCitizensLoading(false);
    }
  }, [fetchRegisteredUsers]);

  useEffect(() => {
    if (userRole === "admin") {
      loadCitizens();
    }
  }, [userRole, loadCitizens]);

  // Filter citizens by search term
  const filteredCitizens = citizens.filter((c) => {
    if (!citizenSearch) return true;
    const q = citizenSearch.toLowerCase();
    return (
      (c.full_name && c.full_name.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.district && c.district.toLowerCase().includes(q)) ||
      (c.phone && c.phone.toLowerCase().includes(q))
    );
  });

  // Security Protection: Restrict view for non-admin users
  if (userRole !== "admin") {
    return (
      <div className="admin-page">
        <div className="admin-header">
          <div>
            <p className="admin-label">CIVORA • RESTRICTED PORTAL</p>
            <h1>Admin Command Center Access Required</h1>
            <p className="admin-subtitle">
              Only authorized Government/Admin users are permitted to view registered citizens and command metrics.
            </p>
          </div>
        </div>

        <div className="action-banner rejected" style={{ marginBottom: "1.5rem" }}>
          🔒 Access Denied: You must be logged in as a Government/Admin officer to view this section.
        </div>

        <Link to="/" className="primary-btn" style={{ display: "inline-block" }}>
          ← Back to Home Page
        </Link>
      </div>
    );
  }

  // Department Assignment Handler
  const handleConfirmAssign = async () => {
    if (!assigningIssue || !selectedDept) return;
    try {
      await assignIssue(assigningIssue.id, selectedDept);
      setActionSuccess(`Department assigned successfully to ${selectedDept}. Work order dispatched.`);
      setAssigningIssue(null);
      setSelectedDept("");
    } catch (err) {
      setActionError("Failed to assign department.");
    }
  };

  // Resolution Proof Upload Handler
  const handleUploadProofSubmit = async (e) => {
    e.preventDefault();
    if (!proofModalIssue) return;
    try {
      await uploadResolutionProof(proofModalIssue.id, proofFile || proofUrl);
      setActionSuccess(`Resolution submitted for citizen verification for Issue ${proofModalIssue.id}.`);
      setProofModalIssue(null);
      setProofFile(null);
      setProofUrl("");
    } catch (err) {
      setActionError("Failed to upload resolution proof.");
    }
  };

  return (
    <div className="admin-page">
      {/* HEADER */}
      <div className="admin-header">
        <div>
          <p className="admin-label">CIVORA • GOVERNMENT COMMAND CENTER</p>
          <h1>Civic Intelligence Dashboard</h1>
          <p className="admin-subtitle">
            Monitor, prioritize, assign departments, and manage registered citizens across Jharkhand districts.
          </p>
        </div>

        <div className="admin-header-actions">
          <Link to="/ai-insights" className="primary-btn">
            🤖 AI Insights Hub
          </Link>
          <Link to="/" className="secondary-btn">
            ← Back to Home
          </Link>
        </div>
      </div>

      {!backendOnline && (
        <div className="action-banner rejected" style={{ marginBottom: "1.5rem" }}>
          ⚠️ Backend server (https://civora-backend-omxf.onrender.com) is offline. Actions will update locally.
        </div>
      )}

      {actionSuccess && (
        <div className="action-banner approved" style={{ marginBottom: "1.5rem" }}>
          ✅ {actionSuccess}
          <button className="close-banner" onClick={() => setActionSuccess(null)}>×</button>
        </div>
      )}

      {actionError && (
        <div className="action-banner rejected" style={{ marginBottom: "1.5rem" }}>
          ❌ {actionError}
          <button className="close-banner" onClick={() => setActionError(null)}>×</button>
        </div>
      )}

      {/* STATISTICS */}
      <div className="admin-stats">
        <div className="admin-stat-card">
          <div className="admin-stat-icon">📋</div>
          <div>
            <span>Total Issues Logged</span>
            <strong>{totalCount}</strong>
            <small>↑ 12% this month</small>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon">🚨</div>
          <div>
            <span>High/Critical Hotspots</span>
            <strong>{criticalCount}</strong>
            <small>Requires immediate dispatch</small>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon">⏳</div>
          <div>
            <span>Active Work Orders</span>
            <strong>{pendingCount}</strong>
            <small>Awaiting resolution</small>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon">✅</div>
          <div>
            <span>Citizen Verified Resolved</span>
            <strong>{resolvedCount}</strong>
            <small>77% resolution rate</small>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon">👥</div>
          <div>
            <span>Registered Citizens</span>
            <strong>{citizens.length}</strong>
            <small>Active user accounts</small>
          </div>
        </div>
      </div>

      {/* REGISTERED CITIZENS SECTION */}
      <div className="admin-panel citizens-panel" style={{ marginBottom: "25px" }}>
        <div className="panel-header" style={{ flexWrap: "wrap", gap: "15px" }}>
          <div>
            <h2>👥 Registered Citizens</h2>
            <p>Complete directory of citizens registered in CIVORA platform.</p>
          </div>

          <div className="citizens-controls" style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              type="text"
              placeholder="🔍 Search name, email, district..."
              className="search-input"
              value={citizenSearch}
              onChange={(e) => setCitizenSearch(e.target.value)}
              style={{
                padding: "8px 14px",
                borderRadius: "10px",
                border: "1px solid #cce3d7",
                fontSize: "14px",
                outline: "none",
                minWidth: "220px"
              }}
            />
            <button
              className="secondary-btn"
              onClick={loadCitizens}
              disabled={citizensLoading}
              style={{ padding: "8px 14px", fontSize: "13px" }}
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {citizensLoading ? (
          <div className="loading-state" style={{ padding: "40px", textAlign: "center", color: "#65756b" }}>
            <p>⏳ Loading registered citizens from database...</p>
          </div>
        ) : citizensError ? (
          <div className="action-banner rejected" style={{ margin: "15px 0" }}>
            ⚠️ {citizensError}
          </div>
        ) : filteredCitizens.length === 0 ? (
          <div className="empty-state" style={{ padding: "40px", textAlign: "center", color: "#65756b" }}>
            <p style={{ fontSize: "18px", fontWeight: "600" }}>No registered citizens found.</p>
          </div>
        ) : (
          <div className="citizens-table-wrapper" style={{ overflowX: "auto" }}>
            <table className="citizens-table">
              <thead>
                <tr>
                  <th>👤 Citizen Name</th>
                  <th>📧 Email</th>
                  <th>📞 Phone</th>
                  <th>📍 District</th>
                  <th>📅 Joined</th>
                  <th>📝 Complaints</th>
                </tr>
              </thead>
              <tbody>
                {filteredCitizens.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.full_name}</strong>
                    </td>
                    <td>{c.email}</td>
                    <td>{c.phone || "Not Provided"}</td>
                    <td>
                      <span className="district-badge">📍 {c.district || "Ranchi"}</span>
                    </td>
                    <td>{c.created_at ? c.created_at.split(" ")[0] : "N/A"}</td>
                    <td>
                      <span className="complaint-count-badge">
                        📝 {c.complaint_count} {c.complaint_count === 1 ? "Complaint" : "Complaints"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PRIORITY QUEUE + BREAKDOWN */}
      <div className="admin-grid">
        {/* PRIORITY QUEUE */}
        <div className="admin-panel priority-panel">
          <div className="panel-header">
            <div>
              <h2>🚨 AI Priority Dispatch Queue</h2>
              <p>Ranked by AI severity confidence & citizen cluster votes</p>
            </div>
            <span className="critical-count">{criticalCount} High/Critical</span>
          </div>

          <div className="priority-queue-list">
            {issues.map((issue) => (
              <div key={issue.id} className="issue-row">
                <div className={`issue-priority ${issue.priority.toLowerCase()}`}>
                  {issue.priority.toUpperCase()}
                </div>

                <div className="issue-info">
                  <strong>{issue.title} ({issue.id})</strong>
                  <span>📍 {issue.district} • {issue.ward}</span>
                  <span>👥 {issue.upvotes} Citizens Supported</span>
                  <div className="dept-tag">Assigned: {issue.assignedDepartment}</div>
                </div>

                <div className="action-col">
                  {issue.status === "Reported" ? (
                    <button
                      className="assign-btn"
                      onClick={() => {
                        setAssigningIssue(issue);
                        setSelectedDept(issue.assignedDepartment);
                      }}
                    >
                      Assign Dept
                    </button>
                  ) : issue.status === "In Progress" ? (
                    <button
                      className="status-step-btn"
                      onClick={() => setProofModalIssue(issue)}
                    >
                      Mark Work Done
                    </button>
                  ) : (
                    <span className="done-badge">{issue.status}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ISSUE BREAKDOWN BY CATEGORY */}
        <div className="admin-panel">
          <div className="panel-header">
            <div>
              <h2>📊 Category Breakdown</h2>
              <p>Civic issues by domain</p>
            </div>
          </div>

          <div className="breakdown-item">
            <div className="breakdown-top">
              <span>🗑️ Waste & Sanitation</span>
              <strong>{issues.filter((i) => i.category === "garbage").length}</strong>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: "82%" }} />
            </div>
          </div>

          <div className="breakdown-item">
            <div className="breakdown-top">
              <span>🕳️ Roads & Potholes</span>
              <strong>{issues.filter((i) => i.category === "road").length}</strong>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: "64%" }} />
            </div>
          </div>

          <div className="breakdown-item">
            <div className="breakdown-top">
              <span>💡 Streetlights</span>
              <strong>{issues.filter((i) => i.category === "streetlight").length}</strong>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: "45%" }} />
            </div>
          </div>

          <div className="breakdown-item">
            <div className="breakdown-top">
              <span>🚰 Water Supply</span>
              <strong>{issues.filter((i) => i.category === "water").length}</strong>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: "38%" }} />
            </div>
          </div>
        </div>
      </div>

      {/* CROWD INTELLIGENCE BANNER */}
      <div className="admin-panel crowd-panel">
        <div className="panel-header">
          <div>
            <h2>👥 Crowd Cluster Intelligence Summary</h2>
            <p>Multiple citizen reports grouped into unique master issues by AI computer vision.</p>
          </div>
          <span className="crowd-badge">AI POWERED</span>
        </div>

        <div className="crowd-highlight">
          <div className="crowd-number">{issues.length}</div>
          <div>
            <strong>Unique Civic Infrastructure Issues</strong>
            <p>Identified and deduplicated from citizen photo uploads.</p>
          </div>
          <Link to="/ai-insights" className="primary-btn">
            View Clustering Analytics →
          </Link>
        </div>
      </div>

      {/* CIVIC ISSUE MAP */}
      <div className="admin-panel map-panel">
        <div className="panel-header">
          <div>
            <h2>🗺️ Jharkhand Live Civic Monitoring Map</h2>
            <p>Geographic view of reported civic complaints across Jharkhand municipalities.</p>
          </div>
          <span className="crowd-badge">LIVE MONITORING</span>
        </div>

        <CivicMap />
      </div>

      {/* ASSIGNMENT MODAL */}
      {assigningIssue && (
        <div className="modal-overlay" onClick={() => setAssigningIssue(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Assign Department to Work Order</h2>
              <button className="close-modal-btn" onClick={() => setAssigningIssue(null)}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <p><strong>Issue:</strong> {assigningIssue.title} ({assigningIssue.id})</p>
              <p><strong>Location:</strong> {assigningIssue.locationName}</p>

              <div className="form-section">
                <label>Select Municipal Department:</label>
                <select
                  className="category-select"
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                >
                  <option value="Public Works Department (PWD)">Public Works Department (PWD)</option>
                  <option value="Municipal Sanitation Department">Municipal Sanitation Department</option>
                  <option value="Electrical Wing">Electrical Wing</option>
                  <option value="Water Supply & Sewerage Board">Water Supply & Sewerage Board</option>
                  <option value="Parks & Horticulture Department">Parks & Horticulture Department</option>
                </select>
              </div>

              <div className="modal-footer">
                <button className="secondary-btn" onClick={() => setAssigningIssue(null)}>
                  Cancel
                </button>
                <button className="primary-btn" onClick={handleConfirmAssign}>
                  Confirm & Dispatch Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RESOLUTION PROOF MODAL */}
      {proofModalIssue && (
        <div className="modal-overlay" onClick={() => setProofModalIssue(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Upload Contractor Resolution Proof</h2>
              <button className="close-modal-btn" onClick={() => setProofModalIssue(null)}>
                ×
              </button>
            </div>

            <form onSubmit={handleUploadProofSubmit} className="modal-body">
              <p><strong>Issue:</strong> {proofModalIssue.title} ({proofModalIssue.id})</p>
              <p><strong>Location:</strong> {proofModalIssue.locationName}</p>

              <div className="form-section">
                <label>Upload Contractor Repair Photo *</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setProofFile(e.target.files[0])}
                />
              </div>

              <div className="form-section">
                <label>Or Image URL (Optional):</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={proofUrl}
                  onChange={(e) => setProofUrl(e.target.value)}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="secondary-btn" onClick={() => setProofModalIssue(null)}>
                  Cancel
                </button>
                <button type="submit" className="primary-btn">
                  Submit Resolution Proof →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;