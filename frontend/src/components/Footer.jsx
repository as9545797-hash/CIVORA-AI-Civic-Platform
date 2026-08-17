import { Link } from "react-router-dom";

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-brand">
          <div className="footer-logo">CIVORA</div>
          <p>
            Crowdsourced Civic Issue Intelligence & Resolution Platform built for the Government of Jharkhand.
          </p>
          <div className="jharkhand-badge">
            Govt of Jharkhand • SIH 2026 Initiative
          </div>
        </div>

        <div className="footer-links">
          <h4>Navigation</h4>
          <Link to="/">Home</Link>
          <Link to="/explore">Explore Issues</Link>
          <Link to="/report">Report an Issue</Link>
          <Link to="/dashboard">Citizen Dashboard</Link>
        </div>

        <div className="footer-links">
          <h4>Govt Command</h4>
          <Link to="/admin">Admin Command Center</Link>
          <Link to="/ai-insights">AI Insights Hub</Link>
          <Link to="/verify">Resolution Verification</Link>
        </div>

        <div className="footer-contact">
          <h4>Civic Helpline</h4>
          <p>📞 Emergency Toll-Free: 1800-345-6789</p>
          <p>✉️ Support: helpdesk@civora.jharkhand.gov.in</p>
          <p>📍 Municipal Corporation HQ, Ranchi, Jharkhand</p>
        </div>
      </div>

      <div className="footer-bottom">
        <p>© 2026 CIVORA Platform • Government of Jharkhand. All rights reserved.</p>
      </div>
    </footer>
  );
}

export default Footer;
