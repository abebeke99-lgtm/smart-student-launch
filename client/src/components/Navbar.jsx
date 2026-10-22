import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Bell, Menu, ShoppingBag, UtensilsCrossed, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { api } from '../services/api.js';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (user?.role !== 'student') {
      setUnreadCount(0);
      return undefined;
    }
    const refresh = () => api('/notifications').then((response) => setUnreadCount(response.data.unreadCount)).catch(() => {});
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, [user]);

  async function signOut() {
    await logout();
    navigate('/');
  }

  return (
    <header className={`topbar public-topbar ${user?.role === 'student' ? 'student-topbar' : ''} ${user?.role === 'foodmaker' ? 'kitchen-topbar' : ''}`}>
      <Link className="brand" to="/">
        <span className="brand-icon"><UtensilsCrossed size={19} /></span>
        <span>Smart Cafeteria</span>
      </Link>
      <nav id="main-navigation" className={`nav-links ${mobileOpen ? 'mobile-open' : ''}`} aria-label="Main navigation">
        <NavLink to="/" end onClick={() => setMobileOpen(false)}>Home</NavLink>
        <NavLink to="/about" onClick={() => setMobileOpen(false)}>About</NavLink>
        <NavLink to="/services" onClick={() => setMobileOpen(false)}>Services</NavLink>
        <NavLink to="/contact" onClick={() => setMobileOpen(false)}>Contact</NavLink>
        <NavLink to="/menu" onClick={() => setMobileOpen(false)}>Menu</NavLink>
        {user?.role === 'student' && <><NavLink to="/orders" onClick={() => setMobileOpen(false)}>My orders</NavLink><NavLink to="/payments" onClick={() => setMobileOpen(false)}>Payments</NavLink><NavLink to="/profile" onClick={() => setMobileOpen(false)}>Profile</NavLink></>}
        {user?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
      </nav>
      <div className="nav-actions">
        {user?.role === 'student' && (
          <Link className="icon-link notification-link" to="/notifications" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}><Bell size={19} />{unreadCount > 0 && <span>{unreadCount}</span>}</Link>
        )}
        {!user && <Link className="text-link" to="/login">Login</Link>}
        {user?.role === 'student' && (
          <Link className="cart-link" to="/cart"><ShoppingBag size={18} /> <span>{cart.items?.length || 0}</span></Link>
        )}
        {user && user.role !== 'foodmaker' ? <button className="button button-quiet" onClick={signOut}>Sign out</button> : !user ? <Link className="button button-small" to="/register">Register</Link> : null}
        <button className="mobile-menu-toggle" type="button" aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={mobileOpen} aria-controls="main-navigation" onClick={() => setMobileOpen((open) => !open)}>
          {mobileOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </div>
    </header>
  );
}
