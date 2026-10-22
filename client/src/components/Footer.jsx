import { Link } from 'react-router-dom';
import { UtensilsCrossed } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-content">
        <div className="footer-brand">
          <Link className="footer-logo" to="/"><UtensilsCrossed size={20} /> Smart Cafeteria</Link>
          <p>A simpler way to browse campus meals, place an order, and follow its progress.</p>
        </div>
        <nav className="footer-link-group" aria-label="Quick links">
          <h2>Quick links</h2>
          <Link to="/">Home</Link><Link to="/about">About</Link><Link to="/services">Services</Link><Link to="/contact">Contact</Link>
        </nav>
        <nav className="footer-link-group" aria-label="Useful links">
          <h2>Get started</h2>
          <Link to="/menu">Menu</Link><Link to="/login">Login</Link><Link to="/register">Register</Link>
        </nav>
      </div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} Smart Cafeteria</span><span>Payments in this system are simulations for demonstration purposes.</span></div>
    </footer>
  );
}
