import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import "./App.css";
import { CivicProvider } from "./context/CivicContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ReportIssue from "./pages/ReportIssue";
import CitizenDashboard from "./pages/CitizenDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ExploreIssues from "./pages/ExploreIssues";
import AIInsightsHub from "./pages/AIInsightsHub";
import VerifyResolution from "./pages/VerifyResolution";

function Home() {
  return (
    <div className="app">
      <section className="hero">
        <div className="hero-content">
          <span className="hero-gov-badge">STATE OF JHARKHAND CIVIC PLATFORM</span>
          <h1>
            Smarter Cities.
            <br />
            <span>Stronger Communities.</span>
          </h1>

          <p>
            CIVORA transforms citizen reports into actionable civic intelligence using AI-powered analysis, smart prioritization, crowdsourced duplicate detection, and citizen proof-of-work verification.
          </p>

          <div className="buttons">
            <Link to="/report" className="primary-btn">
              Report an Issue
            </Link>

            <Link to="/explore" className="secondary-btn">
              Explore Issues
            </Link>
          </div>
        </div>

        <div className="hero-card">
          <h3>Live Civic Impact</h3>

          <div className="stat">
            <strong>2,481</strong>
            Issues Reported
          </div>

          <div className="stat">
            <strong>1,920</strong>
            Issues Resolved
          </div>

          <div className="stat">
            <strong>47</strong>
            Critical Issues
          </div>
        </div>
      </section>

      <section className="features">
        <h2>AI-Powered Civic Intelligence Platform</h2>

        <div className="feature-grid">
          <div className="feature-card">
            <h3>🤖 AI Computer Vision</h3>
            <p>
              Automatically identify civic issues, categories, and damage severity from citizen-uploaded images with high confidence.
            </p>
          </div>

          <div className="feature-card">
            <h3>🚨 Smart Priority Routing</h3>
            <p>
              Help Jharkhand municipal authorities prioritize critical water, road, electrical, and sanitation issues dynamically.
            </p>
          </div>

          <div className="feature-card">
            <h3>👥 Crowd Cluster Intelligence</h3>
            <p>
              Automatically group duplicate citizen reports in the same ward to reveal major civic infrastructure problems.
            </p>
          </div>

          <div className="feature-card">
            <h3>✓ Citizen Proof of Work</h3>
            <p>
              Citizens inspect contractor repair photos and verify resolution before an issue is officially closed.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Login() {
  return (
    <div className="simple-page">
      <h1>CIVORA Governance Login</h1>
      <p>Authorized access portal for citizens and Jharkhand Municipal Officers.</p>

      <div className="login-role-cards">
        <div className="login-card">
          <h3>👤 Citizen Access</h3>
          <p>Log in with Mobile / Aadhaar to report civic issues and verify repairs.</p>
          <Link to="/dashboard" className="primary-btn">
            Continue as Citizen
          </Link>
        </div>

        <div className="login-card">
          <h3>🏛️ Government Officer Access</h3>
          <p>Log in with Municipal Credentials to assign departments & view AI analytics.</p>
          <Link to="/admin" className="secondary-btn">
            Continue to Admin Command
          </Link>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <CivicProvider>
      <BrowserRouter>
        <div className="layout-wrapper">
          <Navbar />

          <main className="main-content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/report" element={<ReportIssue />} />
              <Route path="/explore" element={<ExploreIssues />} />
              <Route path="/dashboard" element={<CitizenDashboard />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/ai-insights" element={<AIInsightsHub />} />
              <Route path="/verify" element={<VerifyResolution />} />
              <Route path="/login" element={<Login />} />
            </Routes>
          </main>

          <Footer />
        </div>
      </BrowserRouter>
    </CivicProvider>
  );
}

export default App;