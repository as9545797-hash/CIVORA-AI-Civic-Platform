import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useCivic } from "../context/CivicContext";

function Navbar() {
  const location = useLocation();
  const {
    userRole,
    setUserRole,
    currentUser,
    login,
    register,
    logout,
    notifications,
    markNotificationRead,
    backendOnline
  } = useCivic();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState("login"); // "login" | "register"
  const [authRole, setAuthRole] = useState("citizen"); // "citizen" | "admin"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [district, setDistrict] = useState("Ranchi");
  const [authError, setAuthError] = useState(null);
  const [authSuccess, setAuthSuccess] = useState(null);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  const unreadNotifs = notifications.filter((n) => !n.is_read);

  const isActive = (path) => location.pathname === path;

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    try {
      if (authMode === "login") {
        await login(email, password);
        setAuthSuccess("Successfully logged in!");
      } else {
        await register({
          email,
          password,
          full_name: fullName,
          role: authRole,
          district
        });
        setAuthSuccess("Account created successfully!");
      }
      setTimeout(() => {
        setShowAuthModal(false);
        setEmail("");
        setPassword("");
        setFullName("");
        setAuthError(null);
        setAuthSuccess(null);
      }, 1000);
    } catch (err) {
      setAuthError(err.message || "Authentication error");
    }
  };

  return (
    <nav className="navbar">
      <div className="nav-brand-group">
        <Link to="/" className="logo-link">
          <span className="logo">CIVORA</span>
          <span className="gov-tag">JHARKHAND</span>
        </Link>
        {!backendOnline && (
          <span className="backend-offline-badge" title="Backend server disconnected. Using fallback data.">
            ⚠️ Offline Mode
          </span>
        )}
      </div>

      <div className={`nav-links ${mobileMenuOpen ? "open" : ""}`}>
        <Link to="/" className={isActive("/") ? "active" : ""}>
          Home
        </Link>
        <Link to="/explore" className={isActive("/explore") ? "active" : ""}>
          Explore Issues
        </Link>
        <Link to="/report" className={isActive("/report") ? "active" : ""}>
          Report Issue
        </Link>
        <Link to="/dashboard" className={isActive("/dashboard") ? "active" : ""}>
          My Dashboard
        </Link>
        <Link to="/ai-insights" className={isActive("/ai-insights") ? "active" : ""}>
          🤖 AI Insights
        </Link>
        <Link to="/verify" className={isActive("/verify") ? "active" : ""}>
          ✓ Verify Work
        </Link>
        <Link to="/admin" className={isActive("/admin") ? "active admin-nav-link" : "admin-nav-link"}>
          🏛️ Admin
        </Link>
      </div>

      <div className="nav-actions">
        {/* NOTIFICATION BELL */}
        <div className="notif-wrapper">
          <button
            type="button"
            className="notif-btn"
            onClick={() => setShowNotifDropdown(!showNotifDropdown)}
            title="Notifications"
          >
            🔔
            {unreadNotifs.length > 0 && (
              <span className="notif-badge">{unreadNotifs.length}</span>
            )}
          </button>

          {showNotifDropdown && (
            <div className="notif-dropdown">
              <div className="notif-dropdown-header">
                <strong>Notifications</strong>
                <span>{unreadNotifs.length} unread</span>
              </div>
              <div className="notif-list">
                {notifications.length === 0 ? (
                  <p className="empty-notif">No new notifications</p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`notif-item ${n.is_read ? "read" : "unread"}`}
                      onClick={() => markNotificationRead(n.id)}
                    >
                      <strong>{n.title}</strong>
                      <p>{n.message}</p>
                      <small>{new Date(n.created_at || Date.now()).toLocaleTimeString()}</small>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* ROLE TOGGLE */}
        <button
          className={`role-toggle-btn ${userRole === "admin" ? "admin-mode" : ""}`}
          onClick={() => setUserRole(userRole === "citizen" ? "admin" : "citizen")}
          title="Switch view mode between Citizen and Government Official"
        >
          {userRole === "admin" ? "🏛️ Admin Mode" : "👤 Citizen Mode"}
        </button>

        {/* AUTH BUTTONS / USER CHIP */}
        {currentUser ? (
          <div className="user-profile-chip">
            <span className="user-name">👤 {currentUser.full_name} ({currentUser.role})</span>
            <button type="button" className="logout-btn" onClick={logout} title="Logout">
              Logout
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="login-nav-btn"
            onClick={() => {
              setAuthMode("login");
              setShowAuthModal(true);
            }}
          >
            Login / Register
          </button>
        )}

        <button
          className="mobile-hamburger"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle Navigation Menu"
        >
          ☰
        </button>
      </div>

      {/* AUTHENTICATION MODAL */}
      {showAuthModal && (
        <div className="modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="modal-content auth-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{authMode === "login" ? "CIVORA Login" : "Create CIVORA Account"}</h2>
              <button className="close-modal-btn" onClick={() => setShowAuthModal(false)}>
                ×
              </button>
            </div>

            <div className="modal-body">
              {authError && <div className="action-banner rejected">⚠️ {authError}</div>}
              {authSuccess && <div className="action-banner approved">🎉 {authSuccess}</div>}

              <div className="auth-tab-row">
                <button
                  type="button"
                  className={authMode === "login" ? "active" : ""}
                  onClick={() => setAuthMode("login")}
                >
                  Login
                </button>
                <button
                  type="button"
                  className={authMode === "register" ? "active" : ""}
                  onClick={() => setAuthMode("register")}
                >
                  Register
                </button>
              </div>

              <form onSubmit={handleAuthSubmit} className="auth-form">
                {authMode === "register" && (
                  <>
                    <div className="form-section">
                      <label>Account Role</label>
                      <select value={authRole} onChange={(e) => setAuthRole(e.target.value)}>
                        <option value="citizen">Citizen</option>
                        <option value="admin">Government Official / Admin</option>
                      </select>
                    </div>

                    <div className="form-section">
                      <label>Full Name</label>
                      <input
                        type="text"
                        placeholder="Enter full name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-section">
                      <label>District</label>
                      <select value={district} onChange={(e) => setDistrict(e.target.value)}>
                        <option value="Ranchi">Ranchi</option>
                        <option value="Jamshedpur">Jamshedpur</option>
                        <option value="Dhanbad">Dhanbad</option>
                        <option value="Bokaro">Bokaro</option>
                        <option value="Hazaribagh">Hazaribagh</option>
                      </select>
                    </div>
                  </>
                )}

                <div className="form-section">
                  <label>Email Address</label>
                  <input
                    type="email"
                    placeholder="name@civora.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="form-section">
                  <label>Password</label>
                  <input
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="primary-btn submit-auth-btn">
                  {authMode === "login" ? "Sign In to CIVORA" : "Register Account"}
                </button>

                <p className="auth-hint">
                  {authMode === "login" ? (
                    <>Test Admin Credentials: <code>admin@civora.gov.in</code> / <code>admin123</code></>
                  ) : (
                    "Join Jharkhand's AI civic infrastructure portal."
                  )}
                </p>
              </form>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
