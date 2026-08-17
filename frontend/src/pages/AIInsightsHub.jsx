import { useState } from "react";
import { Link } from "react-router-dom";
import { useCivic } from "../context/CivicContext";

function AIInsightsHub() {
  const { issues } = useCivic();
  const [selectedClusterFilter, setSelectedClusterFilter] = useState("all");

  const totalClusters = issues.reduce((acc, curr) => acc + (curr.aiClusterCount || 1), 0);

  return (
    <div className="ai-hub-page">
      {/* HEADER */}
      <div className="ai-hub-header">
        <div>
          <span className="ai-badge">🤖 CIVORA INTELLIGENCE ENGINE</span>
          <h1>AI Insights Hub</h1>
          <p>
            Automated duplicate detection, crowdsourced report clustering, and predictive civic infrastructure analytics for Jharkhand Municipalities.
          </p>
        </div>

        <Link to="/admin" className="secondary-btn">
          ← Back to Admin Command
        </Link>
      </div>

      {/* METRICS ROW */}
      <div className="ai-metrics-grid">
        <div className="ai-metric-card">
          <div className="ai-icon">🎯</div>
          <div>
            <span>AI Classification Accuracy</span>
            <strong>97.4%</strong>
            <small>Trained on 15,000+ civic images</small>
          </div>
        </div>

        <div className="ai-metric-card">
          <div className="ai-icon">👥</div>
          <div>
            <span>Crowd Reports Clustered</span>
            <strong>{totalClusters} Reports</strong>
            <small>Grouped into {issues.length} Master Issues</small>
          </div>
        </div>

        <div className="ai-metric-card">
          <div className="ai-icon">⚡</div>
          <div>
            <span>Auto-Dispatched Orders</span>
            <strong>1,420 Work Orders</strong>
            <small>Auto-routed to departments</small>
          </div>
        </div>

        <div className="ai-metric-card">
          <div className="ai-icon">🚨</div>
          <div>
            <span>Critical Anomaly Alerts</span>
            <strong>3 Active Hotspots</strong>
            <small>Preventative intervention queued</small>
          </div>
        </div>
      </div>

      {/* SECTION 1: CROWD INTELLIGENCE CLUSTER ENGINE */}
      <div className="ai-section-panel">
        <div className="panel-title-bar">
          <div>
            <h2>👥 Crowdsourced Duplicate & Cluster Engine</h2>
            <p>
              AI computer vision automatically identifies duplicate photos submitted by different citizens in the same neighborhood and merges them into single prioritized master complaints.
            </p>
          </div>

          <div className="cluster-filters">
            <button
              className={selectedClusterFilter === "all" ? "active" : ""}
              onClick={() => setSelectedClusterFilter("all")}
            >
              All Clusters
            </button>
            <button
              className={selectedClusterFilter === "critical" ? "active" : ""}
              onClick={() => setSelectedClusterFilter("critical")}
            >
              Critical Merges
            </button>
          </div>
        </div>

        <div className="cluster-cards-grid">
          {issues.map((issue) => (
            <div key={issue.id} className="cluster-card">
              <div className="cluster-card-top">
                <span className="cluster-tag">
                  ⚡ {issue.aiClusterCount} Reports Merged by AI
                </span>
                <span className={`priority-tag ${issue.priority.toLowerCase()}`}>
                  {issue.priority}
                </span>
              </div>

              <div className="cluster-content">
                <h3>{issue.title}</h3>
                <p className="cluster-loc">📍 {issue.locationName}</p>
                <p className="cluster-desc">{issue.description}</p>

                <div className="ai-analysis-bar">
                  <div className="ai-confidence-indicator">
                    <span>Similarity Index</span>
                    <div className="confidence-meter">
                      <div
                        className="meter-fill"
                        style={{ width: issue.aiConfidence }}
                      />
                    </div>
                    <strong>{issue.aiConfidence} Match</strong>
                  </div>
                </div>

                <div className="cluster-footer">
                  <span>Assigned: {issue.assignedDepartment}</span>
                  <Link to="/explore" className="text-link">
                    View Master Issue →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: ANOMALY & CRISIS PREDICTION ALERTS */}
      <div className="ai-grid-two">
        <div className="ai-section-panel">
          <h2>🚨 Preventive Anomaly Alerts</h2>
          <p className="panel-sub">
            Real-time automated alert system detecting civic hazard clusters.
          </p>

          <div className="alert-feed">
            <div className="alert-item alert-danger">
              <span className="alert-icon">⚠️</span>
              <div>
                <strong>Water Pipeline Burst Hazard • Harmu, Ranchi</strong>
                <p>
                  18 citizen reports in 2 hours indicate major underground main burst. Risk of local road cave-in.
                </p>
                <small>Recommended Action: Immediate PWD & Water Board joint dispatch.</small>
              </div>
            </div>

            <div className="alert-item alert-warning">
              <span className="alert-icon">⚡</span>
              <div>
                <strong>Blackout Risk Corridor • Bank More, Dhanbad</strong>
                <p>
                  8 adjacent streetlight failure complaints reported within 500 meters. Potential transformer breakdown.
                </p>
                <small>Recommended Action: Deploy Dhanbad Electrical Inspection Van.</small>
              </div>
            </div>

            <div className="alert-item alert-info">
              <span className="alert-icon">📈</span>
              <div>
                <strong>Monsoon Drainage Overflow Spike • Hazaribagh</strong>
                <p>
                  Cluster analytics predict 40% rise in clogged drains post-rainfall in Ward 3.
                </p>
                <small>Recommended Action: Pre-deploy suction jetter crews.</small>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: DEPARTMENT RESOLUTION VELOCITY */}
        <div className="ai-section-panel">
          <h2>📊 Department Efficiency & AI Routing</h2>
          <p className="panel-sub">
            Average resolution speeds per department across Jharkhand.
          </p>

          <div className="dept-speed-list">
            <div className="dept-speed-item">
              <div className="dept-speed-header">
                <span>🚰 Water Supply Board</span>
                <strong>Avg. 18 Hours</strong>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: "88%" }} />
              </div>
            </div>

            <div className="dept-speed-item">
              <div className="dept-speed-header">
                <span>🕳️ Public Works Dept (PWD)</span>
                <strong>Avg. 36 Hours</strong>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: "72%" }} />
              </div>
            </div>

            <div className="dept-speed-item">
              <div className="dept-speed-header">
                <span>🗑️ Municipal Sanitation Wing</span>
                <strong>Avg. 12 Hours</strong>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: "94%" }} />
              </div>
            </div>

            <div className="dept-speed-item">
              <div className="dept-speed-header">
                <span>💡 Electrical Department</span>
                <strong>Avg. 24 Hours</strong>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: "80%" }} />
              </div>
            </div>
          </div>

          <div className="ai-insight-callout">
            <span className="callout-icon">💡</span>
            <p>
              <strong>AI Recommendation:</strong> Reallocating 2 municipal maintenance vans from Jamshedpur to Ranchi Ward 12 will reduce average road issue backlog by 35%.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIInsightsHub;
