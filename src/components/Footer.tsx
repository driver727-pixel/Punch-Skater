import { NavLink } from "react-router-dom";

export function Footer() {
  return (
    <footer className="site-footer">
      <span className="site-footer__copy">
        © {new Date().getFullYear()} SP Digital LLC. All Rights Reserved.
      </span>
      <nav className="site-footer__nav">
        <NavLink to="/privacy" className="site-footer__link">Privacy Policy</NavLink>
        <NavLink to="/terms" className="site-footer__link">Terms &amp; Refunds</NavLink>
        <NavLink to="/credits" className="site-footer__link">Credits</NavLink>
        <a href="mailto:driver727@gmail.com" className="site-footer__link">Support</a>
      </nav>
    </footer>
  );
}
