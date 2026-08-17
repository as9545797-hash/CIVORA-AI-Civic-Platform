import { useState } from "react";
import { Link } from "react-router-dom";
import { useCivic } from "../context/CivicContext";
import CivicMap from "../components/CivicMap";

function ExploreIssues() {
  const { issues, upvotedIds, toggleUpvote } = useCivic();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedDistrict, setSelectedDistrict] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [sortBy, setSortBy] = useState("upvotes");
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'map'
  const [activeModalIssue, setActiveModalIssue] = useState(null);

  // Filter issues based on search, category, district, status
  const filteredIssues = issues.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.locationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory =
      selectedCategory === "all" || item.category === selectedCategory;

    const matchesDistrict =
      selectedDistrict === "all" || item.district === selectedDistrict;

    const matchesStatus =
      selectedStatus === "all" || item.status === selectedStatus;

    return matchesSearch && matchesCategory && matchesDistrict && matchesStatus;
  });

  // Sort issues
  const sortedIssues = [...filteredIssues].sort((a, b) => {
    if (sortBy === "upvotes") {
      return b.upvotes - a.upvotes;
    }
    if (sortBy === "newest") {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
    if (sortBy === "priority") {
      const pMap = { Critical: 4, High: 3, Medium: 2, Low: 1 };
      return (pMap[b.priority] || 0) - (pMap[a.priority] || 0);
    }
    return 0;
  });

  return (
    <div className="explore-page">
      {/* HEADER */}
      <div className="explore-header">
        <div>
          <span className="explore-badge">JHARKHAND CIVIC EXPLORER</span>
          <h1>Explore Civic Issues</h1>
          <p>
            Real-time public feed of crowdsourced civic complaints and resolution progress across Jharkhand districts.
          </p>
        </div>

        <Link to="/report" className="primary-btn">
          + Report New Issue
        </Link>
      </div>

      {/* FILTER BAR */}
      <div className="filter-card">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search by issue, location or keyword..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-controls">
          <div className="filter-group">
            <label>Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">All Categories</option>
              <option value="road">🕳️ Roads & Potholes</option>
              <option value="garbage">🗑️ Waste & Sanitation</option>
              <option value="water">🚰 Water Leakage</option>
              <option value="streetlight">💡 Streetlights</option>
              <option value="public-space">🌳 Public Spaces</option>
            </select>
          </div>

          <div className="filter-group">
            <label>District</label>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
            >
              <option value="all">All Districts</option>
              <option value="Ranchi">Ranchi</option>
              <option value="Jamshedpur">Jamshedpur</option>
              <option value="Dhanbad">Dhanbad</option>
              <option value="Bokaro">Bokaro</option>
              <option value="Hazaribagh">Hazaribagh</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="Reported">Reported</option>
              <option value="In Progress">In Progress</option>
              <option value="Pending Verification">Needs Verification</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="upvotes">🔥 Most Upvoted</option>
              <option value="newest">🕒 Newest First</option>
              <option value="priority">🚨 Priority Level</option>
            </select>
          </div>

          <div className="view-toggle">
            <button
              className={viewMode === "grid" ? "active" : ""}
              onClick={() => setViewMode("grid")}
              title="Grid View"
            >
              📱 Grid
            </button>
            <button
              className={viewMode === "map" ? "active" : ""}
              onClick={() => setViewMode("map")}
              title="Map View"
            >
              🗺️ Map
            </button>
          </div>
        </div>
      </div>

      {/* RESULTS COUNT & META */}
      <div className="results-meta">
        <span>
          Showing <strong>{sortedIssues.length}</strong> civic issues
        </span>
        {searchTerm && (
          <button
            className="clear-filter-btn"
            onClick={() => {
              setSearchTerm("");
              setSelectedCategory("all");
              setSelectedDistrict("all");
              setSelectedStatus("all");
            }}
          >
            Clear Filters ×
          </button>
        )}
      </div>

      {/* VIEW: MAP VIEW */}
      {viewMode === "map" ? (
        <div className="explore-map-container">
          <CivicMap />
        </div>
      ) : (
        /* VIEW: GRID VIEW */
        <div className="issues-grid">
          {sortedIssues.length === 0 ? (
            <div className="no-results-card">
              <h3>No civic issues match your filters</h3>
              <p>Try clearing filters or search for another term.</p>
              <button
                className="secondary-btn"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategory("all");
                  setSelectedDistrict("all");
                  setSelectedStatus("all");
                }}
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            sortedIssues.map((issue) => {
              const isUpvoted = upvotedIds.has(issue.id);
              return (
                <div key={issue.id} className="issue-card">
                  <div className="issue-card-image-wrap">
                    <img
                      src={issue.beforeImage}
                      alt={issue.title}
                      className="issue-card-img"
                    />
                    <span className={`priority-tag ${issue.priority.toLowerCase()}`}>
                      {issue.priority} Priority
                    </span>
                    <span className={`status-tag status-${issue.status.toLowerCase().replace(/\s+/g, "-")}`}>
                      {issue.status}
                    </span>
                  </div>

                  <div className="issue-card-body">
                    <div className="issue-card-header">
                      <span className="issue-id">{issue.id}</span>
                      <span className="issue-cat">{issue.categoryLabel}</span>
                    </div>

                    <h3>{issue.title}</h3>
                    <p className="issue-location">📍 {issue.locationName}</p>
                    <p className="issue-desc">{issue.description}</p>

                    <div className="ai-meta-chip">
                      <span>🤖 AI Confidence: <strong>{issue.aiConfidence}</strong></span>
                      <span>👥 Clusters: <strong>{issue.aiClusterCount} reports</strong></span>
                    </div>

                    <div className="issue-card-footer">
                      <button
                        className={`upvote-btn ${isUpvoted ? "upvoted" : ""}`}
                        onClick={() => toggleUpvote(issue.id)}
                      >
                        👍 {isUpvoted ? "Upvoted" : "Support"} ({issue.upvotes})
                      </button>

                      <button
                        className="details-btn"
                        onClick={() => setActiveModalIssue(issue)}
                      >
                        Details & History →
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* DETAIL MODAL */}
      {activeModalIssue && (
        <div className="modal-overlay" onClick={() => setActiveModalIssue(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="issue-id">{activeModalIssue.id}</span>
                <h2>{activeModalIssue.title}</h2>
                <p>📍 {activeModalIssue.locationName}</p>
              </div>
              <button
                className="close-modal-btn"
                onClick={() => setActiveModalIssue(null)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-image-row">
                <div>
                  <h4>Original Reported Photo</h4>
                  <img src={activeModalIssue.beforeImage} alt="Before" className="modal-img" />
                </div>
                {activeModalIssue.afterImage && (
                  <div>
                    <h4>Completed Work Photo</h4>
                    <img src={activeModalIssue.afterImage} alt="After" className="modal-img" />
                  </div>
                )}
              </div>

              <div className="modal-details-grid">
                <div className="detail-box">
                  <span>Category</span>
                  <strong>{activeModalIssue.categoryLabel}</strong>
                </div>
                <div className="detail-box">
                  <span>Assigned Department</span>
                  <strong>{activeModalIssue.assignedDepartment}</strong>
                </div>
                <div className="detail-box">
                  <span>AI Detection Confidence</span>
                  <strong>{activeModalIssue.aiConfidence}</strong>
                </div>
                <div className="detail-box">
                  <span>Community Upvotes</span>
                  <strong>👍 {activeModalIssue.upvotes} Citizens</strong>
                </div>
              </div>

              <div className="modal-section">
                <h3>Resolution Timeline</h3>
                <div className="modal-timeline">
                  {activeModalIssue.timeline.map((t, idx) => (
                    <div
                      key={idx}
                      className={`modal-timeline-step ${t.completed ? "done" : ""}`}
                    >
                      <div className="step-badge">{t.completed ? "✓" : idx + 1}</div>
                      <div>
                        <strong>{t.step}</strong>
                        <p>{t.details}</p>
                        <small>{t.date}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {activeModalIssue.status === "Pending Verification" && (
                <div className="modal-action-banner">
                  <p>This issue has completed repairs and is ready for citizen verification!</p>
                  <Link to="/verify" className="primary-btn">
                    Verify Work Now →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExploreIssues;
