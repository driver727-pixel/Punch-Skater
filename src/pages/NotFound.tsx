import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="page not-found-page">
      <div className="not-found-card">
        <div className="not-found-code">404</div>
        <h1 className="page-title">Route lost in the neon</h1>
        <p className="page-sub">
          That page does not exist. Head back to the forge, rebuild your route, and keep the Crew moving.
        </p>
        <div className="not-found-actions">
          <Link className="btn-primary" to="/forge">Back to Card Forge</Link>
          <Link className="btn-outline" to="/collection">Open Collection</Link>
        </div>
      </div>
    </div>
  );
}
