import { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, Bell, CheckCircle2, CircleAlert, Clock3, CreditCard, Grid2X2, LayoutDashboard, LogOut, Search, ShieldCheck, ShoppingBag, Utensils, UtensilsCrossed, ClipboardList, LockKeyhole, ChefHat, WalletCards, SearchCheck, UsersRound, BookOpenCheck, Timer, ListChecks } from 'lucide-react';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import FoodCard from './components/FoodCard.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import {
  AdminActivityLogsPage,
  AdminCategoriesPage,
  AdminDashboardPage,
  AdminLayout,
  AdminMenuPage,
  AdminOrdersPage,
  AdminPaymentsPage,
  AdminReportsPage,
  AdminSettingsPage,
  AdminUsersPage,
} from './admin/AdminModule.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { useCart } from './context/CartContext.jsx';
import { api, createIdempotencyKey, jsonBody } from './services/api.js';

function Notice({ notice, dismiss }) {
  if (!notice) return null;
  return <div className={`toast ${notice.type}`} role="status">{notice.type === 'error' ? <CircleAlert size={18} /> : <CheckCircle2 size={18} />}{notice.message}<button onClick={dismiss} aria-label="Dismiss">×</button></div>;
}

function Layout({ notify }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const publicLayout = ['/', '/about', '/services', '/contact', '/menu'].includes(pathname);
  const adminArea = pathname === '/admin' || pathname.startsWith('/admin/');
  return <div className={`site-layout ${publicLayout ? 'public-layout' : ''}`}>
    {!(user?.role === 'admin' && adminArea) && <Navbar />}
    <main className={`app-main ${user?.role === 'admin' ? 'admin-app-main' : ''}`}><Outlet context={{ notify }} /></main>
    {publicLayout ? <Footer /> : <footer className="footer"><span>Smart Cafeteria</span><span>Campus meals, made simple. All prices are illustrative ETB amounts.</span></footer>}
  </div>;
}

function StudentLayout() {
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const outletContext = useOutletContext();
  async function signOut() {
    await logout();
    navigate('/');
  }
  const links = [
    { to: '/student/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/student/menu', label: 'Browse Food', icon: Search },
    { to: '/student/categories', label: 'Food Categories', icon: Grid2X2 },
    { to: '/cart', label: 'My Cart', icon: ShoppingBag, count: cart.items?.length },
    { to: '/checkout', label: 'Checkout', icon: ArrowRight },
    { to: '/orders', label: 'My Orders', icon: Utensils },
    { to: '/student/track-order', label: 'Track Order', icon: Clock3 },
    { to: '/payments', label: 'Payment History', icon: CreditCard },
    { to: '/notifications', label: 'Notifications', icon: Bell },
    { to: '/profile', label: 'My Profile', icon: LayoutDashboard },
  ];
  return <div className="student-shell">
    <aside className="student-sidebar">
      <div className="sidebar-user"><span className="user-avatar">{user?.name?.charAt(0).toUpperCase()}</span><span><strong>{user?.name}</strong><small>Student account</small></span></div>
      <p className="sidebar-heading">STUDENT SPACE</p>
      <nav aria-label="Student dashboard">
        {links.map(({ to, label, icon: Icon, count }) => <Link key={to} className={`sidebar-link ${location.pathname === to ? 'selected' : ''}`} to={to} aria-current={location.pathname === to ? 'page' : undefined}><Icon size={17} /><span>{label}</span>{count > 0 && <small className="sidebar-count">{count}</small>}</Link>)}
      </nav>
      <button className="sidebar-link sidebar-logout" onClick={signOut}><LogOut size={17} /><span>Logout</span></button>
    </aside>
    <div className="student-content"><Outlet context={outletContext} /></div>
  </div>;
}

function MenuPage({ notify }) {
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [availability, setAvailability] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/categories').then((result) => setCategories(result.data.categories)).catch(() => {});
  }, []);
  useEffect(() => {
    setCategory(searchParams.get('category') || '');
  }, [searchParams]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({ page: '1', limit: '24' });
      if (search.trim()) params.set('search', search.trim());
      if (category) params.set('category', category);
      if (availability) params.set('availability', availability);
      try {
        const result = await api(`/foods?${params}`, { signal: controller.signal });
        setItems(result.data.items);
      } catch (requestError) {
        if (requestError.name !== 'AbortError') setError(requestError.message);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, category, availability]);

  return (
    <section id="menu" className="content-page menu-page">
      <div className="section-head">
        <div><p className="eyebrow">THE DAILY MENU</p><h1 className="page-title">Find your next favorite</h1></div>
        <span className="section-subtitle">Choose from today's campus selection</span>
      </div>
        <div className="filters">
          <label className="search-box"><Search size={18} /><input aria-label="Search menu" placeholder="Search meals…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <select aria-label="Filter by category" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All categories</option>
            {categories.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
          </select>
          <select aria-label="Filter by availability" value={availability} onChange={(event) => setAvailability(event.target.value)}>
            <option value="">All availability</option><option value="true">Available</option><option value="false">Unavailable</option>
          </select>
        </div>
        {loading && <p className="page-message">Loading today's menu…</p>}
        {error && <div className="inline-error">{error}</div>}
        {!loading && !error && items.length === 0 && <div className="empty-state"><div className="empty-icon">✳</div><h3>Nothing on the menu just yet</h3><p>Try another search or check back soon.</p></div>}
        <div className="food-grid">{items.map((item) => <FoodCard key={item._id} item={item} notify={notify} />)}</div>
    </section>
  );
}

const featureCards = [
  { icon: SearchCheck, title: 'Browse Food', text: 'Explore the current cafeteria menu and find a meal that suits you.' },
  { icon: ShoppingBag, title: 'Easy Ordering', text: 'Build your cart and review your order before you submit it.' },
  { icon: Timer, title: 'Order Tracking', text: 'Follow order progress as the kitchen updates its status.' },
  { icon: LockKeyhole, title: 'Secure Authentication', text: 'Sign in to access student ordering and your personal order history.' },
  { icon: WalletCards, title: 'Simulated Payments', text: 'Try the academic payment flow without processing real money.' },
  { icon: ClipboardList, title: 'Order History', text: 'Review past orders and their recorded payment and status details.' },
];

function HomePage({ notify }) {
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api('/foods?page=1&limit=3')
      .then((result) => {
        if (active) setFeatured(result.data.items);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return <>
    <section className="public-hero">
      <div className="public-hero-copy">
        <p className="public-eyebrow">FRESH FROM YOUR CAMPUS KITCHEN</p>
        <h1>Smart Cafeteria Ordering System</h1>
        <p>Order your favorite meals quickly, conveniently, and securely.</p>
        <div className="public-hero-actions">
          <Link className="button public-button" to="/menu">Explore Menu <ArrowRight size={17} /></Link>
          <Link className="button public-button-secondary" to="/about">Learn More</Link>
        </div>
      </div>
      <div className="public-hero-art">
        <img src="https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=85" alt="A freshly prepared meal served in a bowl" />
        <span className="public-hero-badge"><UtensilsCrossed size={18} /> Campus meals, made simple</span>
      </div>
    </section>

    <section className="public-section">
      <div className="public-section-heading"><p className="public-eyebrow">A SIMPLER LUNCH BREAK</p><h2>Everything you need to order</h2></div>
      <div className="public-card-grid feature-grid">
        {featureCards.map(({ icon: Icon, title, text }) => <article className="public-info-card" key={title}>
          <span className="public-card-icon"><Icon size={21} /></span><h3>{title}</h3><p>{text}</p>
        </article>)}
      </div>
    </section>

    <section className="public-section featured-section">
      <div className="public-section-heading public-section-row"><div><p className="public-eyebrow">FROM THE LIVE MENU</p><h2>Featured food</h2></div><Link className="public-text-link" to="/menu">View Menu <ArrowRight size={15} /></Link></div>
      {loading && <p className="public-state" role="status">Loading menu items…</p>}
      {!loading && error && <div className="inline-error" role="alert">We couldn't load the menu right now. Please try again later.</div>}
      {!loading && !error && featured.length === 0 && <div className="public-empty"><h3>No menu items are available yet</h3><p>Check back later for the latest cafeteria selection.</p></div>}
      {!loading && !error && featured.length > 0 && <div className="food-grid">{featured.map((item) => <FoodCard key={item._id} item={item} notify={notify} />)}</div>}
    </section>

    <section className="public-cta">
      <div><p className="public-eyebrow">READY WHEN YOU ARE</p><h2>Find something delicious today.</h2><p>Browse the current menu and sign in when you're ready to place an order.</p></div>
      <div className="public-hero-actions"><Link className="button public-button" to="/menu">Explore the menu <ArrowRight size={17} /></Link><Link className="button public-button-secondary" to="/login">Sign in</Link></div>
    </section>
  </>;
}

function AboutPage() {
  const objectives = [
    'Reduce the need to wait in long ordering queues.',
    'Make menu information easier to access.',
    'Help food makers manage incoming orders.',
    'Allow students to track order status.',
    'Help administrators monitor users, menus, orders, and reports.',
  ];
  const roles = [
    { icon: UsersRound, title: 'Student', items: ['Register and log in.', 'Browse and search menu items.', 'Add food to the cart and place orders.', 'View order history and status.'] },
    { icon: ChefHat, title: 'Food Maker', items: ['View incoming orders.', 'Review order details.', 'Update preparation status.', 'Mark orders as ready when appropriate.'] },
    { icon: ShieldCheck, title: 'Administrator', items: ['Manage users, menu items, categories, and orders.', 'Monitor simulated payments.', 'View reports and system activity.'] },
  ];
  return <section className="public-page content-page">
    <header className="public-page-heading"><p className="public-eyebrow">ABOUT SMART CAFETERIA</p><h1>Less waiting. Better organized meals.</h1><p>A web-based application intended to simplify cafeteria food ordering by allowing users to browse available meals, submit orders, and monitor order progress.</p></header>
    <div className="public-about-grid">
      <article className="public-info-card"><span className="public-card-icon"><BookOpenCheck size={21} /></span><h2>Our mission</h2><p>Improve the convenience and organization of cafeteria ordering through an accessible web-based platform.</p></article>
      <article className="public-info-card"><span className="public-card-icon"><ListChecks size={21} /></span><h2>Our objectives</h2><ul>{objectives.map((objective) => <li key={objective}>{objective}</li>)}</ul></article>
    </div>
    <div className="public-section-heading role-heading"><p className="public-eyebrow">BUILT FOR THE CAMPUS TEAM</p><h2>Main user roles</h2></div>
    <div className="public-card-grid role-grid">{roles.map(({ icon: Icon, title, items }) => <article className="public-info-card" key={title}><span className="public-card-icon"><Icon size={21} /></span><h3>{title}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></article>)}</div>
  </section>;
}

const serviceCards = [
  { icon: UtensilsCrossed, title: 'Online Menu', text: 'View available food items, descriptions, prices, and availability from the current menu data.' },
  { icon: SearchCheck, title: 'Food Search', text: 'Find menu items by searching and filtering the existing cafeteria menu.' },
  { icon: ShoppingBag, title: 'Cart and Ordering', text: 'Authenticated students can select food, adjust quantities, review totals, and submit orders.' },
  { icon: Timer, title: 'Order Tracking', text: 'Students can follow supported order states, from pending through preparation and completion.' },
  { icon: ChefHat, title: 'Food Preparation Management', text: 'Authorized food makers can review incoming orders and update preparation progress.' },
  { icon: WalletCards, title: 'Simulated Payment Management', text: 'The academic demonstration supports simulated payments only; it does not process real payments.' },
  { icon: ShieldCheck, title: 'Administration and Reports', text: 'Administrators can manage menu data, users, orders, and system reports using authorized features.' },
];

function ServicesPage() {
  return <section className="public-page content-page">
    <header className="public-page-heading"><p className="public-eyebrow">WHAT THE SYSTEM OFFERS</p><h1>Services for every step of the meal</h1><p>Explore the ordering tools available to students, food makers, and administrators.</p></header>
    <div className="public-card-grid services-grid">{serviceCards.map(({ icon: Icon, title, text }) => <article className="public-info-card" key={title}><span className="public-card-icon"><Icon size={21} /></span><h2>{title}</h2><p>{text}</p></article>)}</div>
  </section>;
}

function ContactPage() {
  const [form, setForm] = useState({ fullName: '', email: '', subject: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSubmitted(false);
    try {
      await api('/contact', { method: 'POST', body: jsonBody(form) });
      setForm({ fullName: '', email: '', subject: '', message: '' });
      setSubmitted(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return <section className="public-page content-page contact-page">
    <header className="public-page-heading"><p className="public-eyebrow">GET IN TOUCH</p><h1>Contact the cafeteria team</h1><p>Send us a message using the form below. Submissions are recorded for the team to review.</p></header>
    <form className="form-card public-contact-form" onSubmit={submit}>
      <h2>Send a message</h2>
      {error && <div className="inline-error" role="alert">{error}</div>}
      {submitted && <div className="success-message" role="status">Your message was received. Thank you for contacting the cafeteria team.</div>}
      <label htmlFor="contact-name">Full Name<input id="contact-name" name="fullName" required minLength="2" maxLength="100" autoComplete="name" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></label>
      <label htmlFor="contact-email">Email Address<input id="contact-email" name="email" required type="email" maxLength="254" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
      <label htmlFor="contact-subject">Subject<input id="contact-subject" name="subject" required minLength="2" maxLength="150" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} /></label>
      <label htmlFor="contact-message">Message<textarea id="contact-message" name="message" required minLength="10" maxLength="3000" rows="6" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /></label>
      <button className="button full-width" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Submit message'}</button>
    </form>
  </section>;
}

function StudentDashboard() {
  const { user } = useAuth();
  const { cart } = useCart();
  const [orders, setOrders] = useState([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => {
    Promise.all([api('/orders/my'), api('/notifications')])
      .then(([orderResponse, notificationResponse]) => {
        setOrders(orderResponse.data.orders);
        setUnread(notificationResponse.data.unreadCount);
      })
      .catch((requestError) => setError(requestError.message));
  }, []);
  const active = orders.filter((order) => !['served', 'cancelled'].includes(order.status));
  return <section className="content-page student-dashboard">
    <p className="eyebrow">YOUR CAMPUS AT A GLANCE</p><h1 className="page-title">Hello, {user?.name?.split(' ')[0]}.</h1><p className="muted">Ready for a good meal? Your campus cafeteria is just a few clicks away.</p>
    {error && <div className="inline-error">{error}</div>}
    <div className="student-stats">
      <Link to="/cart"><span>Cart items</span><strong>{cart.items?.reduce((sum, item) => sum + item.quantity, 0) || 0}</strong><small>Review your selection <ArrowRight size={14} /></small></Link>
      <Link to="/orders"><span>Orders placed</span><strong>{orders.length}</strong><small>View your history <ArrowRight size={14} /></small></Link>
      <Link to="/student/track-order"><span>Active orders</span><strong>{active.length}</strong><small>Track your meal <ArrowRight size={14} /></small></Link>
      <Link to="/notifications"><span>Unread notifications</span><strong>{unread}</strong><small>See latest updates <ArrowRight size={14} /></small></Link>
    </div>
    <section className="student-callout"><div><p className="eyebrow">HUNGRY?</p><h2>Find your next favorite.</h2><p>Browse real menu items and add an available meal to your cart.</p></div><Link className="button" to="/student/menu">Browse food <ArrowRight size={16} /></Link></section>
    <div className="section-head"><div><p className="eyebrow">ORDER ACTIVITY</p><h2>Your active orders</h2></div><Link className="detail-link" to="/orders">All orders</Link></div>
    {active.length ? <div className="order-list">{active.slice(0, 3).map((order) => <article className="order-card" key={order._id}><div className="order-heading"><div><span className="eyebrow">{order.orderNumber}</span><h3>{new Date(order.createdAt).toLocaleString()}</h3></div><span className={`pill status-${order.status}`}>{statusLabel(order.status)}</span></div><p className="muted">{order.items.map((item) => `${item.quantity} × ${item.name}`).join(' · ')}</p><Link className="detail-link" to={`/student/track/${order._id}`}>Track this order</Link></article>)}</div> : <div className="empty-state compact-empty"><h3>No active orders</h3><p>Orders you place will appear here.</p></div>}
  </section>;
}

function FoodCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api('/categories').then((response) => setCategories(response.data.categories))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);
  return <section className="content-page"><p className="eyebrow">EXPLORE THE MENU</p><h1 className="page-title">Food categories</h1>{error && <div className="inline-error">{error}</div>}{loading ? <p className="page-message">Loading food categories…</p> : categories.length ? <div className="category-grid">{categories.map((category) => <Link key={category._id} to={`/student/menu?category=${category._id}`} className="category-card"><span className="category-symbol"><Utensils size={19} /></span><h2>{category.name}</h2><p>{category.description || 'Explore freshly prepared cafeteria choices.'}</p><span className="detail-link">Browse category <ArrowRight size={15} /></span></Link>)}</div> : <div className="empty-state"><h3>No categories are available yet</h3><Link className="button" to="/student/menu">Browse all food</Link></div>}</section>;
}

function FoodDetailsPage({ notify }) {
  const { foodId } = useParams();
  const { addItem } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api(`/foods/${foodId}`).then((response) => setItem(response.data.item))
      .catch((requestError) => setError(requestError.message));
  }, [foodId]);
  async function add() {
    if (!user) {
      navigate('/login', { state: { from: { pathname: `/foods/${foodId}` } } });
      return;
    }
    try { await addItem(item._id, 1); notify(`${item.name} added to your cart.`); }
    catch (requestError) { notify(requestError.message, 'error'); }
  }
  if (error) return <section className="content-page"><div className="inline-error">{error}</div><Link to="/student/menu">Back to menu</Link></section>;
  if (!item) return <p className="page-message">Loading food details…</p>;
  const image = item.imageUrl?.startsWith('/uploads/')
    ? `${import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '') || 'http://localhost:5000'}${item.imageUrl}`
    : item.imageUrl || 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1100&q=80';
  return <section className="content-page"><Link className="detail-link" to="/student/menu">← Back to menu</Link><article className="food-detail"><img src={image} alt={item.name} /><div><p className="eyebrow">{item.category?.name || 'CAFETERIA MENU'}</p><h1 className="page-title">{item.name}</h1><p>{item.description || 'Freshly prepared on campus.'}</p><p className="food-detail-price">{Number(item.price).toFixed(2)} ETB</p><p className={item.isAvailable ? 'availability available' : 'availability unavailable'}>{item.isAvailable ? 'Available to order' : 'Currently unavailable'}</p><p className="muted">Preparation time: {item.preparationTime} minutes</p><button className="button" disabled={!item.isAvailable} onClick={add}><ShoppingBag size={16} /> Add to cart</button></div></article></section>;
}

function TrackOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const refresh = () => api('/orders/my')
      .then((response) => {
        if (!active) return;
        setOrders(response.data.orders);
        setError('');
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  const trackable = orders.filter((order) => !['served', 'cancelled'].includes(order.status));
  return <section className="content-page"><p className="eyebrow">LIVE ORDER PROGRESS</p><h1 className="page-title">Track an order</h1>{error && <div className="inline-error">{error}</div>}{loading ? <p className="page-message">Loading order tracking…</p> : trackable.length ? <div className="order-list">{trackable.map((order) => <article className="order-card" key={order._id}><div className="order-heading"><div><span className="eyebrow">{order.orderNumber}</span><h3>{new Date(order.createdAt).toLocaleString()}</h3></div><span className={`pill status-${order.status}`}>{statusLabel(order.status)}</span></div><p className="muted">{order.items.map((item) => `${item.quantity} × ${item.name}`).join(' · ')}</p><div className="history-track">{order.statusHistory.map((event, index) => <span className={event.status === order.status ? 'current-step' : ''} key={`${event.status}-${index}`}><i />{statusLabel(event.status)}</span>)}</div><Link className="detail-link" to={`/student/track/${order._id}`}>Open tracking timeline <ArrowRight size={14} /></Link></article>)}</div> : <div className="empty-state"><h3>No active orders to track</h3><p>Place an order and its progress will appear here.</p><Link className="button" to="/student/menu">Browse food</Link></div>}</section>;
}

function TrackOrderDetailPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const refresh = () => api(`/orders/${orderId}`)
      .then((response) => {
        if (!active) return;
        setOrder(response.data.order);
        setError('');
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      });
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [orderId]);
  if (error && !order) return <section className="content-page"><div className="inline-error">{error}</div><Link to="/student/track-order">Back to order tracking</Link></section>;
  if (!order) return <p className="page-message">Loading tracking details…</p>;
  const stages = ['pending', 'confirmed', 'preparing', 'ready', 'served'];
  const currentIndex = stages.indexOf(order.status);
  return <section className="content-page narrow-page"><Link className="detail-link" to="/student/track-order">← All active orders</Link><p className="eyebrow">ORDER {order.orderNumber}</p><h1 className="page-title">{statusLabel(order.status)}</h1><p className="muted">Order placed {new Date(order.createdAt).toLocaleString()}</p>{error && <div className="inline-error" role="alert">{error}</div>}<div className="tracking-timeline">{order.status === 'cancelled' ? <div className="tracking-step complete"><i /><div><strong>Cancelled</strong><small>{order.statusHistory.at(-1)?.note || 'This order was cancelled.'}</small></div></div> : stages.map((stage, index) => {
    const achieved = index <= currentIndex || order.statusHistory.some((event) => event.status === stage);
    const event = order.statusHistory.findLast ? order.statusHistory.findLast((entry) => entry.status === stage) : [...order.statusHistory].reverse().find((entry) => entry.status === stage);
    return <div className={`tracking-step ${achieved ? 'complete' : ''} ${stage === order.status ? 'active-step' : ''}`} key={stage}><i /><div><strong>{statusLabel(stage)}</strong><small>{event ? new Date(event.changedAt).toLocaleString() : stage === 'pending' ? 'Order received' : 'Waiting for kitchen update'}</small></div></div>;
  })}</div><div className="summary-card tracking-summary"><div className="summary-row"><span>Payment</span><strong>{order.paymentStatus}</strong></div><div className="summary-row"><span>Fulfillment</span><strong>{order.pickupType === 'self-pickup' ? 'Self pickup' : 'Campus delivery'}</strong></div><div className="summary-row"><span>Total</span><strong>{Number(order.totalAmount).toFixed(2)} ETB</strong></div></div></section>;
}

function statusLabel(status) {
  return status === 'served' ? 'Completed' : status.charAt(0).toUpperCase() + status.slice(1);
}

function AuthPage({ mode }) {
  const { login, register, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : user.role === 'foodmaker' ? '/kitchen' : '/student/dashboard'} replace />;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const account = mode === 'register'
        ? await register(form.name, form.email, form.password)
        : await login(form.email, form.password);
      navigate(location.state?.from?.pathname || (account.role === 'admin' ? '/admin' : account.role === 'foodmaker' ? '/kitchen' : '/student/dashboard'), { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-wrap">
      <div className="auth-aside"><span className="brand-icon"><Utensils size={22} /></span><p className="eyebrow">SMART CAFETERIA</p><h1>{mode === 'register' ? 'A better lunch starts here.' : 'Welcome back.'}</h1><p>Good food, less waiting. Find campus favorites and have your order ready when you are.</p></div>
      <form className="form-card" onSubmit={submit}>
        <p className="eyebrow">{mode === 'register' ? 'CREATE YOUR ACCOUNT' : 'YOUR CAMPUS ACCOUNT'}</p>
        <h2>{mode === 'register' ? 'Join the table' : 'Sign in'}</h2>
        {error && <div className="inline-error">{error}</div>}
        {mode === 'register' && <label>Full name<input required minLength="2" maxLength="100" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>}
        <label>Email address<input required type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label>Password<input required type="password" minLength="8" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        <button className="button full-width" disabled={busy}>{busy ? 'Please wait…' : mode === 'register' ? 'Create student account' : 'Sign in'}</button>
        <p className="form-foot">{mode === 'register' ? 'Already registered?' : 'New to the cafeteria?'} <Link to={mode === 'register' ? '/login' : '/register'}>{mode === 'register' ? 'Sign in' : 'Create an account'}</Link></p>
      </form>
    </section>
  );
}

function CartPage({ notify }) {
  const { cart, refreshCart, updateItem, removeItem } = useCart();
  const [error, setError] = useState('');
  useEffect(() => { refreshCart().catch((e) => setError(e.message)); }, [refreshCart]);
  async function change(item, quantity) {
    try {
      if (quantity < 1) await removeItem(item.menuItem._id);
      else await updateItem(item.menuItem._id, quantity);
    } catch (e) { notify(e.message, 'error'); }
  }
  async function remove(menuItemId) {
    try { await removeItem(menuItemId); }
    catch (e) { notify(e.message, 'error'); }
  }
  return (
    <section className="content-page">
      <p className="eyebrow">YOUR SELECTION</p><h1 className="page-title">Shopping cart</h1>
      {error && <div className="inline-error">{error}</div>}
      {cart.items?.length ? <div className="cart-layout">
        <div className="cart-lines">{cart.items.map((entry) => <article className="cart-line" key={entry.menuItem._id}>
          <img src={entry.menuItem.imageUrl || 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=250&q=80'} alt="" />
          <div className="cart-line-info"><h3>{entry.menuItem.name}</h3><span>{Number(entry.price).toFixed(2)} ETB each</span><div className="quantity-control"><button aria-label="Decrease quantity" onClick={() => change(entry, entry.quantity - 1)}>−</button><span>{entry.quantity}</span><button aria-label="Increase quantity" disabled={entry.quantity >= 20} onClick={() => change(entry, entry.quantity + 1)}>+</button></div></div>
          <div className="cart-line-end"><strong>{Number(entry.subtotal).toFixed(2)} ETB</strong><button className="link-button" onClick={() => remove(entry.menuItem._id)}>Remove</button></div>
        </article>)}</div>
        <aside className="summary-card"><p className="eyebrow">ORDER SUMMARY</p><div className="summary-row"><span>Subtotal</span><strong>{Number(cart.total).toFixed(2)} ETB</strong></div><div className="summary-row"><span>Campus delivery</span><span>Selected at checkout</span></div><hr /><div className="summary-row total"><span>Total</span><strong>{Number(cart.total).toFixed(2)} ETB</strong></div><Link className="button full-width" to="/checkout">Continue to checkout <ArrowRight size={17} /></Link></aside>
      </div> : <div className="empty-state"><div className="empty-icon">＋</div><h3>Your cart is waiting for something tasty</h3><Link className="button" to="/">Browse menu</Link></div>}
    </section>
  );
}

function CheckoutPage({ notify }) {
  const { cart, refreshCart } = useCart();
  const navigate = useNavigate();
  const [pickupType, setPickupType] = useState('self-pickup');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { refreshCart().catch((e) => setError(e.message)); }, [refreshCart]);
  async function placeOrder(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = { pickupType, deliveryLocation, notes };
      const fingerprint = JSON.stringify(payload);
      let pendingCheckout;
      try {
        pendingCheckout = JSON.parse(sessionStorage.getItem('pendingCafeteriaCheckout') || 'null');
      } catch {
        pendingCheckout = null;
      }
      const idempotencyKey = pendingCheckout?.fingerprint === fingerprint
        ? pendingCheckout.key
        : createIdempotencyKey();
      sessionStorage.setItem('pendingCafeteriaCheckout', JSON.stringify({
        fingerprint,
        key: idempotencyKey,
      }));
      const result = await api('/orders', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: jsonBody(payload),
      });
      sessionStorage.removeItem('pendingCafeteriaCheckout');
      refreshCart().catch((refreshError) => notify(refreshError.message, 'error'));
      navigate(`/order-confirmation/${result.data.order._id}`);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  if (!cart.items?.length) return <section className="content-page"><h1 className="page-title">Checkout</h1><div className="empty-state"><h3>Your cart is empty</h3><Link className="button" to="/">Browse menu</Link></div></section>;
  return <section className="content-page checkout-page">
    <p className="eyebrow">ONE MORE STEP</p><h1 className="page-title">Checkout</h1>
    <form className="form-card checkout-card" onSubmit={placeOrder}>
      {error && <div className="inline-error">{error}</div>}
      <fieldset><legend>How would you like to receive your order?</legend><label className="radio-row"><input type="radio" name="pickup" checked={pickupType === 'self-pickup'} onChange={() => setPickupType('self-pickup')} /> Self pickup</label><label className="radio-row"><input type="radio" name="pickup" checked={pickupType === 'campus-delivery'} onChange={() => setPickupType('campus-delivery')} /> Campus delivery (location selection only)</label></fieldset>
      {pickupType === 'campus-delivery' && <label>Campus delivery location<input required maxLength="300" value={deliveryLocation} onChange={(e) => setDeliveryLocation(e.target.value)} placeholder="Building, room or campus landmark" /></label>}
      <label>Order notes (optional)<textarea maxLength="500" value={notes} onChange={(e) => setNotes(e.target.value)} rows="3" /></label>
      <div className="summary-row total"><span>Server-calculated total</span><strong>{Number(cart.total).toFixed(2)} ETB</strong></div>
      <p className="muted">The final total is recalculated from current menu prices when the order is placed.</p>
      <button className="button full-width" disabled={busy}>{busy ? 'Placing order…' : 'Place order and continue to payment'}</button>
    </form>
  </section>;
}

function OrderConfirmationPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api(`/orders/${orderId}`).then((response) => setOrder(response.data.order))
      .catch((requestError) => setError(requestError.message));
  }, [orderId]);
  if (error) return <section className="content-page narrow-page"><div className="inline-error">{error}</div><Link to="/orders">View my orders</Link></section>;
  if (!order) return <p className="page-message">Loading order confirmation…</p>;
  return <section className="content-page narrow-page"><div className="receipt-icon good"><CheckCircle2 size={30} /></div><p className="eyebrow">ORDER RECEIVED</p><h1 className="page-title">Thanks, your order is in.</h1><p className="muted">Your order is saved. Payment below is an academic simulation only.</p><div className="summary-card receipt-details"><div className="summary-row"><span>Order number</span><strong>{order.orderNumber}</strong></div>{order.items.map((item, index) => <div className="summary-row" key={`${item.name}-${index}`}><span>{item.quantity} × {item.name}</span><strong>{(item.price * item.quantity).toFixed(2)} ETB</strong></div>)}<div className="summary-row"><span>Order status</span><strong>{statusLabel(order.status)}</strong></div><div className="summary-row total"><span>Total</span><strong>{Number(order.totalAmount).toFixed(2)} ETB</strong></div></div><Link className="button full-width" to={`/checkout/${order._id}/payment`}>Continue to simulated payment</Link><Link className="detail-link confirmation-orders" to="/orders">Do this later · view order history</Link></section>;
}

function PaymentPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [method, setMethod] = useState('telebirr');
  const [outcome, setOutcome] = useState('success');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api('/payments/simulate', { method: 'POST', body: jsonBody({ orderId, method, simulatedResponse: outcome }) });
      navigate(`/receipt/${result.data.payment._id}`, { state: { payment: result.data.payment, order: result.data.order } });
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <section className="content-page narrow-page"><p className="eyebrow">ACADEMIC DEMONSTRATION</p><h1 className="page-title">Simulated payment</h1><div className="simulation-banner"><ShieldCheck size={20} /><span>No real money moves. Never enter payment PINs, passwords or OTPs.</span></div>
    <form className="form-card" onSubmit={submit}>
      {error && <div className="inline-error">{error}</div>}
      <label>Payment method<select value={method} onChange={(e) => setMethod(e.target.value)}><option value="telebirr">TeleBirr (simulated)</option><option value="cbe-birr">CBE Birr (simulated)</option><option value="mobile-banking">Mobile Banking (simulated)</option></select></label>
      <label>Simulation result<select value={outcome} onChange={(e) => setOutcome(e.target.value)}><option value="success">Simulate success</option><option value="failure">Simulate failure</option></select></label>
      <button className="button full-width" disabled={busy}>{busy ? 'Processing simulation…' : 'Run payment simulation'}</button>
      <p className="muted">This is a classroom simulation only. It does not connect to a bank or payment provider.</p>
    </form>
  </section>;
}

function ReceiptPage() {
  const { paymentId } = useParams();
  const location = useLocation();
  const [receipt, setReceipt] = useState(location.state || null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (receipt) return;
    api(`/payments/${paymentId}`).then((response) => setReceipt(response.data))
      .catch((requestError) => setError(requestError.message));
  }, [paymentId, receipt]);
  if (error) return <section className="content-page narrow-page"><div className="inline-error">{error}</div><Link to="/payments">Payment history</Link></section>;
  if (!receipt) return <p className="page-message">Loading payment receipt…</p>;
  const state = receipt;
  const success = state.payment.status === 'successful';
  return <section className="content-page narrow-page">
    <div className={`receipt-icon ${success ? 'good' : 'bad'}`}>{success ? <CheckCircle2 size={30} /> : <CircleAlert size={30} />}</div>
    <p className="eyebrow">PAYMENT SIMULATION RECEIPT</p><h1 className="page-title">{success ? 'Simulation successful' : 'Simulation failed'}</h1>
    <p className="muted">No real payment was made. Save this demonstration receipt for your records.</p>
    <div className="summary-card receipt-details"><div className="summary-row"><span>Order number</span><strong>{state.order.orderNumber}</strong></div><div className="summary-row"><span>Amount</span><strong>{Number(state.payment.amount).toFixed(2)} ETB</strong></div><div className="summary-row"><span>Method</span><strong>{state.payment.method}</strong></div><div className="summary-row"><span>Transaction reference</span><strong>{state.payment.transactionId}</strong></div><div className="summary-row"><span>Result</span><strong>{state.payment.status}</strong></div></div>
    <Link className="button full-width" to="/orders">View my orders</Link>
  </section>;
}

function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => { api('/orders/my').then((r) => setOrders(r.data.orders)).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, []);
  async function cancel(order) {
    try {
      await api(`/orders/${order._id}/cancel`, { method: 'PATCH', body: jsonBody({ note: 'Cancelled by student' }) });
      const result = await api('/orders/my');
      setOrders(result.data.orders);
    } catch (e) { setError(e.message); }
  }
  return <section className="content-page"><p className="eyebrow">YOUR CAMPUS ORDERS</p><h1 className="page-title">Order history</h1>
    {error && <div className="inline-error">{error}</div>}
    {loading ? <p className="page-message">Loading your orders…</p> : orders.length === 0 ? <div className="empty-state"><h3>No orders yet</h3><p>Your placed orders will show up here.</p><Link className="button" to="/">Browse the menu</Link></div> :
      <div className="order-list">{orders.map((order) => <article className="order-card" key={order._id}>
        <div className="order-heading"><div><span className="eyebrow">{order.orderNumber}</span><h3>{new Date(order.createdAt).toLocaleString()}</h3></div><span className={`pill status-${order.status}`}>{order.status}</span></div>
        <ul>{order.items.map((item, i) => <li key={`${item.name}-${i}`}>{item.quantity} × {item.name}<span>{(item.price * item.quantity).toFixed(2)} ETB</span></li>)}</ul>
        <div className="order-bottom"><span>{order.paymentStatus} payment</span><strong>{Number(order.totalAmount).toFixed(2)} ETB</strong>{['pending', 'confirmed', 'preparing'].includes(order.status) && order.paymentStatus !== 'paid' && <button className="link-button" onClick={() => cancel(order)}>Cancel order</button>}<Link className="link-button" to={`/student/track/${order._id}`}>Track order</Link></div>
        <div className="history-track">{order.statusHistory.map((history, index) => <span key={`${history.status}-${index}`}><i />{statusLabel(history.status)}</span>)}</div>
      </article>)}</div>}
  </section>;
}

function PaymentHistoryPage() {
  const [payments, setPayments] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => { api('/payments/my').then((r) => setPayments(r.data.payments)).catch((e) => setError(e.message)); }, []);
  return <section className="content-page"><p className="eyebrow">SIMULATED TRANSACTIONS</p><h1 className="page-title">Payment history</h1><div className="simulation-banner"><ShieldCheck size={20} /><span>Every record shown is a demonstration only. No real money was transferred.</span></div>{error && <div className="inline-error">{error}</div>}{payments.length ? <div className="order-list">{payments.map((payment) => <article className="order-card" key={payment._id}><div className="order-heading"><div><span className="eyebrow">{payment.transactionId}</span><h3>{payment.order?.orderNumber || 'Cafeteria order'} · {new Date(payment.createdAt).toLocaleString()}</h3></div><span className={`pill status-${payment.status === 'successful' ? 'served' : payment.status === 'failed' ? 'cancelled' : 'pending'}`}>{payment.status}</span></div><div className="order-bottom"><span>{payment.method}</span><strong>{Number(payment.amount).toFixed(2)} ETB</strong></div></article>)}</div> : <div className="empty-state"><h3>No simulated payments</h3><Link className="button" to="/">Browse menu</Link></div>}</section>;
}

function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function save(event) {
    event.preventDefault();
    setMessage('');
    setError('');
    try {
      await api('/users/me', { method: 'PATCH', body: jsonBody({ name, email, phone }) });
      await refreshUser();
      setMessage('Profile updated.');
    } catch (e) { setError(e.message); }
  }
  return <section className="content-page narrow-page"><p className="eyebrow">YOUR ACCOUNT</p><h1 className="page-title">My profile</h1><form className="form-card" onSubmit={save}>{error && <div className="inline-error">{error}</div>}{message && <p className="success-message">{message}</p>}<label>Name<input required minLength="2" maxLength="100" value={name} onChange={(e) => setName(e.target.value)} /></label><label>Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label><label>Phone (optional)<input maxLength="30" value={phone} onChange={(e) => setPhone(e.target.value)} /></label><p className="muted">Role: {user?.role}. Role changes are managed by an administrator.</p><button className="button full-width">Save profile</button></form></section>;
}

const nextStatus = { pending: 'confirmed', confirmed: 'preparing', preparing: 'ready', ready: 'served' };
function KitchenPage() {
  const { pathname } = useLocation();
  const view = pathname.endsWith('/completed')
    ? 'served'
    : pathname.endsWith('/preparing')
      ? 'preparing'
      : pathname.endsWith('/ready')
        ? 'ready'
        : pathname.endsWith('/pending')
          ? 'confirmed'
          : pathname.endsWith('/incoming')
            ? 'pending'
            : '';
  return <KitchenOrdersPage key={view || pathname} initialStatus={view} />;
}

function KitchenLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationError, setNotificationError] = useState('');
  useEffect(() => {
    const refresh = () => api('/notifications')
      .then((response) => {
        setUnreadCount(response.data.unreadCount);
        setNotificationError('');
      })
      .catch((error) => setNotificationError(error.message));
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => clearInterval(timer);
  }, []);
  async function signOut() {
    await logout();
    navigate('/');
  }
  const links = [
    { to: '/kitchen', label: 'Dashboard Overview', icon: LayoutDashboard, exact: true },
    { to: '/kitchen/incoming', label: 'Incoming Orders', icon: Bell },
    { to: '/kitchen/pending', label: 'Pending Orders', icon: Clock3 },
    { to: '/kitchen/preparing', label: 'Preparing Orders', icon: Utensils },
    { to: '/kitchen/ready', label: 'Ready for Pickup', icon: CheckCircle2 },
    { to: '/kitchen/completed', label: 'Completed Orders', icon: Grid2X2 },
    { to: '/kitchen/notifications', label: 'Notifications', icon: Bell, count: unreadCount },
    { to: '/kitchen/profile', label: 'My Profile', icon: LayoutDashboard },
  ];
  return <div className="student-shell kitchen-shell">
    <aside className="student-sidebar kitchen-sidebar">
      <div className="sidebar-user"><span className="user-avatar kitchen-avatar">{user?.name?.charAt(0).toUpperCase()}</span><span><strong>{user?.name}</strong><small>Kitchen staff</small></span></div>
      <p className="sidebar-heading">KITCHEN WORKSPACE</p>
      <nav aria-label="Food maker dashboard">
        {links.map(({ to, label, icon: Icon, count, exact }) => {
          const selected = exact ? location.pathname === to : location.pathname === to || location.pathname.startsWith(`${to}/`);
          return <Link key={to} className={`sidebar-link ${selected ? 'selected' : ''}`} to={to} aria-current={selected ? 'page' : undefined}><Icon size={17} /><span>{label}</span>{count > 0 && <small className="sidebar-count">{count}</small>}</Link>;
        })}
      </nav>
      <button className="sidebar-link sidebar-logout" onClick={signOut}><LogOut size={17} /><span>Logout</span></button>
    </aside>
    <div className="student-content">{notificationError && <div className="inline-error kitchen-notification-error" role="alert">Unable to refresh kitchen notifications: {notificationError}</div>}<Outlet /></div>
  </div>;
}

function KitchenOrdersPage({ initialStatus = '' }) {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(initialStatus);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  async function refresh() {
    const params = new URLSearchParams({ limit: '100' });
    if (status) params.set('status', status);
    if (search.trim()) params.set('search', search.trim());
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    try {
      const response = await api(`/orders?${params}`);
      setOrders(response.data.orders);
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const debounce = setTimeout(() => { refresh(); }, 250);
    const polling = setInterval(refresh, 15000);
    return () => { clearTimeout(debounce); clearInterval(polling); };
  }, [status, search, startDate, endDate]);
  async function progress(order) {
    const next = nextStatus[order.status];
    if (!next) return;
    const question = order.status === 'pending'
      ? `Accept paid order ${order.orderNumber}?`
      : `Move order ${order.orderNumber} to ${next}?`;
    if (!window.confirm(question)) return;
    try {
      await api(`/orders/${order._id}/status`, {
        method: 'PATCH',
        body: jsonBody({ status: next, note: `Updated by kitchen staff to ${next}.` }),
      });
      setNotice(`Order ${order.orderNumber} marked ${next}.`);
      window.setTimeout(() => setNotice(''), 3500);
      await refresh();
    } catch (e) { setError(e.message); }
  }
  const title = initialStatus === 'pending' ? 'Incoming orders'
    : initialStatus === 'confirmed' ? 'Pending orders'
    : initialStatus === 'preparing' ? 'Preparing orders'
      : initialStatus === 'ready' ? 'Ready for pickup'
        : initialStatus === 'served' ? 'Completed orders' : 'Incoming orders';
  return <section className="content-page"><p className="eyebrow">KITCHEN WORKSPACE</p><h1 className="page-title">{title}</h1><div className="filters kitchen-filters">
    <label className="search-box"><Search size={17} /><input aria-label="Search order number" placeholder="Search order number…" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
    <select aria-label="Filter by order status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{['pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled'].map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}</select>
    <label className="date-filter">From<input aria-label="From date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
    <label className="date-filter">To<input aria-label="To date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
    <span className="muted"><Clock3 size={15} /> Updates every 15 seconds</span>
  </div>
    {error && <div className="inline-error">{error}</div>}
    {notice && <p className="success-message kitchen-notice" role="status">{notice}</p>}
    {loading ? <p className="page-message">Loading kitchen orders…</p> : orders.length === 0 ? <div className="empty-state"><h3>No orders in this view</h3><p>New campus orders will appear here automatically.</p></div> : <div className="order-list kitchen-tickets">{orders.map((order) => <article className="order-card kitchen-ticket" key={order._id}>
      <div className="order-heading"><div><span className="eyebrow">{order.orderNumber}</span><h3>{order.user?.name || 'Student'} · {new Date(order.createdAt).toLocaleString()}</h3></div><span className={`pill status-${order.status}`}>{statusLabel(order.status)}</span></div>
      <ul>{order.items.map((item, i) => <li key={`${item.name}-${i}`}><strong>{item.quantity} ×</strong> {item.name}</li>)}</ul>
      {order.notes && <p className="kitchen-notes"><strong>Student notes:</strong> {order.notes}</p>}
      <p className="muted">{order.pickupType === 'campus-delivery' ? `Location: ${order.deliveryLocation}` : 'Self pickup'} · <strong>Payment: {order.paymentStatus}</strong></p>
      <div className="history-track">{order.statusHistory.map((history, index) => <span key={`${history.status}-${index}`} title={history.note || ''}><i />{statusLabel(history.status)}</span>)}</div>
      <div className="kitchen-ticket-actions"><Link className="link-button" to={`/kitchen/orders/${order._id}`}>Order details</Link>
        {nextStatus[order.status] && (order.status !== 'pending' || order.paymentStatus === 'paid')
          ? <button className="button button-small" onClick={() => progress(order)}>{order.status === 'pending' ? 'Accept order' : `Mark ${statusLabel(nextStatus[order.status])}`} <ArrowRight size={15} /></button>
          : order.status === 'pending' ? <span className="payment-waiting">Awaiting successful payment before acceptance</span> : null}
      </div>
    </article>)}</div>}</section>;
}

function KitchenOverview() {
  const [orders, setOrders] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, confirmed: 0, preparing: 0, ready: 0, served: 0 });
  const [error, setError] = useState('');
  async function refresh() {
    try {
      const statuses = ['pending', 'confirmed', 'preparing', 'ready', 'served'];
      const results = await Promise.all(statuses.map((status) => api(`/orders?status=${status}&limit=1`)));
      setCounts(Object.fromEntries(statuses.map((status, index) => [status, results[index].pagination.total])));
      const recent = await api('/orders?limit=8');
      setOrders(recent.data.orders);
      setError('');
    } catch (requestError) { setError(requestError.message); }
  }
  useEffect(() => { refresh(); const timer = setInterval(refresh, 15000); return () => clearInterval(timer); }, []);
  return <section className="content-page"><p className="eyebrow">KITCHEN WORKSPACE</p><h1 className="page-title">Dashboard overview</h1>{error && <div className="inline-error">{error}</div>}<div className="kitchen-stats">{[
    ['New orders', counts.pending, '/kitchen/incoming', 'pending'],
    ['Pending orders', counts.confirmed, '/kitchen/pending', 'confirmed'],
    ['Being prepared', counts.preparing, '/kitchen/preparing', 'preparing'],
    ['Ready for pickup', counts.ready, '/kitchen/ready', 'ready'],
    ['Completed', counts.served, '/kitchen/completed', 'served'],
  ].map(([label, count, href, status]) => <Link className={`kitchen-stat status-${status}`} to={href} key={label}><span>{label}</span><strong>{count}</strong><small>View orders <ArrowRight size={13} /></small></Link>)}</div><div className="section-head"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>Latest orders</h2></div><Link className="detail-link" to="/kitchen/incoming">All incoming orders</Link></div>{orders.length ? <div className="order-list">{orders.map((order) => <article className="order-card kitchen-ticket compact-ticket" key={order._id}><div className="order-heading"><div><span className="eyebrow">{order.orderNumber}</span><h3>{order.user?.name} · {new Date(order.createdAt).toLocaleTimeString()}</h3></div><span className={`pill status-${order.status}`}>{statusLabel(order.status)}</span></div><p className="muted">{order.items.map((item) => `${item.quantity} × ${item.name}`).join(' · ')}</p><Link className="detail-link" to={`/kitchen/orders/${order._id}`}>Open order details <ArrowRight size={14} /></Link></article>)}</div> : <div className="empty-state"><h3>Waiting for student orders</h3></div>}</section>;
}

function KitchenOrderDetails() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function refresh() {
    try { const result = await api(`/orders/${orderId}`); setOrder(result.data.order); setError(''); }
    catch (requestError) { setError(requestError.message); }
  }
  useEffect(() => { refresh(); const timer = setInterval(refresh, 15000); return () => clearInterval(timer); }, [orderId]);
  async function advance() {
    const next = nextStatus[order?.status];
    if (!next || !window.confirm(`${order.status === 'pending' ? 'Accept' : 'Move'} order ${order.orderNumber} to ${statusLabel(next)}?`)) return;
    setBusy(true);
    try {
      await api(`/orders/${order._id}/status`, { method: 'PATCH', body: jsonBody({ status: next }) });
      await refresh();
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }
  if (error && !order) return <section className="content-page"><div className="inline-error">{error}</div><Link to="/kitchen/incoming">Back to incoming orders</Link></section>;
  if (!order) return <p className="page-message">Loading order details…</p>;
  const canAdvance = nextStatus[order.status] && (order.status !== 'pending' || order.paymentStatus === 'paid');
  return <section className="content-page kitchen-detail"><Link className="detail-link" to="/kitchen/incoming">← Back to kitchen orders</Link>{error && <div className="inline-error">{error}</div>}<div className="order-heading kitchen-detail-heading"><div><p className="eyebrow">ORDER DETAILS</p><h1 className="page-title">{order.orderNumber}</h1><p>{order.user?.name || 'Student'} · placed {new Date(order.createdAt).toLocaleString()}</p></div><span className={`pill status-${order.status}`}>{statusLabel(order.status)}</span></div><div className="kitchen-detail-grid"><section className="panel"><p className="eyebrow">ITEMS TO PREPARE</p><h2>Order items</h2><ul className="kitchen-item-list">{order.items.map((item, index) => <li key={`${item.name}-${index}`}><strong>{item.quantity} ×</strong><span>{item.name}</span></li>)}</ul>{order.notes && <div className="kitchen-notes"><strong>Student preparation notes</strong><p>{order.notes}</p></div>}<p className="muted">{order.pickupType === 'campus-delivery' ? `Campus location: ${order.deliveryLocation}` : 'Fulfillment: self pickup'}</p></section><section className="panel"><p className="eyebrow">ORDER STATUS</p><h2>Progress history</h2><div className="detail-history">{order.statusHistory.map((event, index) => <div key={`${event.status}-${index}`}><i /><span><strong>{statusLabel(event.status)}</strong><small>{new Date(event.changedAt).toLocaleString()}</small>{event.note && <small>{event.note}</small>}</span></div>)}</div><hr /><p className="payment-state">Payment status: <strong>{order.paymentStatus}</strong></p><p className="payment-state">Total (read-only): <strong>{Number(order.totalAmount).toFixed(2)} ETB</strong></p>{canAdvance && <button className="button full-width" disabled={busy} onClick={advance}>{busy ? 'Updating…' : order.status === 'pending' ? 'Accept paid order' : `Mark ${statusLabel(nextStatus[order.status])}`} <ArrowRight size={15} /></button>}{order.status === 'pending' && order.paymentStatus !== 'paid' && <p className="payment-waiting">This order can be accepted after a successful student payment.</p>}</section></div></section>;
}

function AdminPage() {
  const [dashboard, setDashboard] = useState(null);
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [itemForm, setItemForm] = useState({ name: '', description: '', price: '', category: '', preparationTime: '10', imageUrl: '' });
  const [error, setError] = useState('');
  const refresh = () => Promise.all([api('/reports/dashboard'), api('/categories'), api('/menu?limit=100')]).then(([stats, cats, menu]) => { setDashboard(stats.data); setCategories(cats.data.categories); setMenuItems(menu.data.items); }).catch((e) => setError(e.message));
  useEffect(() => { refresh(); }, []);
  async function addCategory(event) {
    event.preventDefault();
    try {
      await api('/categories', { method: 'POST', body: jsonBody({ name, description }) });
      setName(''); setDescription(''); await refresh();
    } catch (e) { setError(e.message); }
  }
  async function removeCategory(id) {
    if (!window.confirm('Delete this category? It must not contain menu items.')) return;
    try { await api(`/categories/${id}`, { method: 'DELETE' }); await refresh(); }
    catch (e) { setError(e.message); }
  }
  async function createMenuItem(event) {
    event.preventDefault();
    try {
      const payload = { ...itemForm, price: Number(itemForm.price), preparationTime: Number(itemForm.preparationTime) };
      await api('/menu', { method: 'POST', body: jsonBody(payload) });
      setItemForm({ name: '', description: '', price: '', category: '', preparationTime: '10', imageUrl: '' });
      await refresh();
    } catch (e) { setError(e.message); }
  }
  async function toggleMenuItem(item) {
    try {
      await api(`/menu/${item._id}/availability`, { method: 'PATCH', body: jsonBody({ isAvailable: !item.isAvailable }) });
      await refresh();
    } catch (e) { setError(e.message); }
  }
  async function deleteMenuItem(item) {
    if (!window.confirm(`Delete ${item.name}?`)) return;
    try { await api(`/menu/${item._id}`, { method: 'DELETE' }); await refresh(); }
    catch (e) { setError(e.message); }
  }
  const totals = dashboard?.totals;
  return <section className="content-page"><p className="eyebrow">SYSTEM OVERVIEW</p><h1 className="page-title">Administrator dashboard</h1>
    {error && <div className="inline-error">{error}</div>}
    {!dashboard ? <p className="page-message">Loading live report data…</p> : <>
      <div className="stat-grid">{[['Users', totals.users], ['Menu items', totals.menuItems], ['Categories', totals.categories], ['Orders', totals.orders], ['Pending', totals.pending], ['Served', totals.completed], ['Cancelled', totals.cancelled], ['Daily sales', `${Number(dashboard.sales.daily).toFixed(2)} ETB`], ['Weekly sales', `${Number(dashboard.sales.weekly).toFixed(2)} ETB`], ['Monthly sales', `${Number(dashboard.sales.monthly).toFixed(2)} ETB`]].map(([label, value]) => <article className="stat-card" key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
      <div className="admin-grid"><section className="panel"><p className="eyebrow">CATEGORIES</p><h2>Manage categories</h2><form className="inline-form" onSubmit={addCategory}><input required minLength="2" maxLength="80" placeholder="New category name" value={name} onChange={(e) => setName(e.target.value)} /><input maxLength="500" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} /><button className="button button-small">Add</button></form><div className="simple-list">{categories.map((category) => <div key={category._id}><span><strong>{category.name}</strong><small>{category.description}</small></span><button className="link-button danger-text" onClick={() => removeCategory(category._id)}>Delete</button></div>)}</div></section>
        <section className="panel"><p className="eyebrow">POPULAR FOOD</p><h2>Most ordered</h2>{dashboard.popularFoods.length ? dashboard.popularFoods.map((item) => <div className="bar-row" key={item._id}><span>{item._id}</span><strong>{item.quantity} ordered</strong></div>) : <p className="muted">No order history to report yet.</p>}<h3 className="subhead">Order status distribution</h3>{dashboard.statusDistribution.map((item) => <div className="bar-row" key={item._id}><span>{item._id}</span><strong>{item.count}</strong></div>)}</section></div>
      <section className="panel admin-menu-panel"><p className="eyebrow">MENU MANAGEMENT</p><h2>Add a menu item</h2><form className="menu-admin-form" onSubmit={createMenuItem}>
        <input required minLength="2" maxLength="120" placeholder="Name" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} />
        <input required type="number" min="0" step="0.01" placeholder="Price in ETB" value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} />
        <select required value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}><option value="">Select category</option>{categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select>
        <input required type="number" min="0" step="1" placeholder="Preparation minutes" value={itemForm.preparationTime} onChange={(e) => setItemForm({ ...itemForm, preparationTime: e.target.value })} />
        <input placeholder="Image URL (optional)" value={itemForm.imageUrl} onChange={(e) => setItemForm({ ...itemForm, imageUrl: e.target.value })} />
        <input placeholder="Description" maxLength="1000" value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} />
        <button className="button button-small">Create menu item</button>
      </form><div className="simple-list">{menuItems.map((item) => <div key={item._id}><span><strong>{item.name} · {Number(item.price).toFixed(2)} ETB</strong><small>{item.category?.name} · {item.isAvailable ? 'Available' : 'Unavailable'}</small></span><span className="admin-item-actions"><button className="link-button" onClick={() => toggleMenuItem(item)}>{item.isAvailable ? 'Unpublish' : 'Publish'}</button><button className="link-button danger-text" onClick={() => deleteMenuItem(item)}>Delete</button></span></div>)}</div></section>
      <AdminManagement />
      <p className="muted">Sales totals count orders with successful simulated payments only.</p>
    </>}
  </section>;
}

function AdminManagement() {
  const [users, setUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const refresh = async () => {
    try {
      const [userResponse, paymentResponse, logResponse] = await Promise.all([
        api('/users'),
        api('/payments'),
        api('/activity-logs?limit=20'),
      ]);
      setUsers(userResponse.data.users);
      setPayments(paymentResponse.data.payments);
      setLogs(logResponse.data.logs);
    } catch (e) { setError(e.message); }
  };
  useEffect(() => { refresh(); }, []);
  async function changeRole(user, role) {
    try { await api(`/users/${user.id}/role`, { method: 'PATCH', body: jsonBody({ role }) }); await refresh(); }
    catch (e) { setError(e.message); }
  }
  async function toggleUser(user) {
    try { await api(`/users/${user.id}/status`, { method: 'PATCH', body: jsonBody({ isActive: !user.isActive }) }); await refresh(); }
    catch (e) { setError(e.message); }
  }
  async function deleteUser(user) {
    if (!window.confirm(`Permanently delete account ${user.email}?`)) return;
    try { await api(`/users/${user.id}`, { method: 'DELETE' }); await refresh(); }
    catch (e) { setError(e.message); }
  }
  return <div className="admin-grid admin-management">
    <section className="panel"><p className="eyebrow">ACCOUNT ACCESS</p><h2>Manage users</h2>{error && <div className="inline-error">{error}</div>}{users.length ? <div className="table-scroll"><table><thead><tr><th>User</th><th>Role</th><th>Active</th><th>Actions</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><strong>{user.name}</strong><small>{user.email}</small></td><td><select aria-label={`Role for ${user.email}`} value={user.role} onChange={(e) => changeRole(user, e.target.value)}><option value="student">student</option><option value="foodmaker">foodmaker</option><option value="admin">admin</option></select></td><td>{user.isActive ? 'Yes' : 'No'}</td><td><button className="link-button" onClick={() => toggleUser(user)}>{user.isActive ? 'Deactivate' : 'Activate'}</button><button className="link-button danger-text" onClick={() => deleteUser(user)}>Delete</button></td></tr>)}</tbody></table></div> : <p className="muted">No accounts found.</p>}</section>
    <section className="panel"><p className="eyebrow">TRANSACTIONS</p><h2>Simulated payments</h2>{payments.length ? <div className="table-scroll"><table><thead><tr><th>Reference</th><th>Method</th><th>Amount</th><th>Result</th></tr></thead><tbody>{payments.slice(0, 30).map((payment) => <tr key={payment._id}><td>{payment.transactionId}</td><td>{payment.method}</td><td>{Number(payment.amount).toFixed(2)} ETB</td><td>{payment.status}</td></tr>)}</tbody></table></div> : <p className="muted">No simulated payment records yet.</p>}
      <h3 className="subhead">Recent activity</h3>{logs.slice(0, 10).map((log) => <div className="bar-row" key={log._id}><span>{log.action} · {log.entity}</span><small>{new Date(log.createdAt).toLocaleString()}</small></div>)}</section>
  </div>;
}

function NotificationPage() {
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState('');
  const refresh = () => api('/notifications').then((r) => setNotifications(r.data.notifications)).catch((e) => setError(e.message));
  useEffect(() => { refresh(); const t = setInterval(refresh, 30000); return () => clearInterval(t); }, []);
  async function markRead(id) {
    try { await api(`/notifications/${id}/read`, { method: 'PATCH' }); await refresh(); }
    catch (e) { setError(e.message); }
  }
  async function markAllRead() {
    try { await api('/notifications/read-all', { method: 'PATCH' }); await refresh(); }
    catch (e) { setError(e.message); }
  }
  return <section className="content-page"><p className="eyebrow">UPDATES</p><div className="section-head"><h1 className="page-title">Notifications</h1><button className="link-button" onClick={markAllRead}>Mark all as read</button></div>{error && <div className="inline-error">{error}</div>}{notifications.length ? notifications.map((n) => <article className={`notification-row ${n.isRead ? '' : 'unread'}`} key={n._id}><span className="notification-dot" /><div><strong>{n.title}</strong><p>{n.message}</p><small>{new Date(n.createdAt).toLocaleString()}</small></div>{!n.isRead && <button className="link-button" onClick={() => markRead(n._id)}>Mark read</button>}</article>) : <div className="empty-state"><h3>You're all caught up</h3></div>}</section>;
}

function UnauthorizedPage() {
  return <section className="empty-state full-empty"><div className="empty-icon">403</div><h1>Access denied</h1><p>Your account does not have permission to view this page.</p><Link className="button" to="/">Back to menu</Link></section>;
}

function NotFoundPage() {
  return <section className="empty-state full-empty"><div className="empty-icon">404</div><h1>Page not found</h1><p>That page isn't on today's menu.</p><Link className="button" to="/">Return home</Link></section>;
}

export default function App() {
  const [notice, setNotice] = useState(null);
  const { user } = useAuth();
  const { refreshCart } = useCart();
  useEffect(() => {
    refreshCart().catch(() => {});
  }, [user, refreshCart]);
  const notify = (message, type = 'success') => {
    setNotice({ message, type });
    window.setTimeout(() => setNotice(null), 3800);
  };
  return <>
    <Notice notice={notice} dismiss={() => setNotice(null)} />
    <Routes>
      <Route element={<Layout notify={notify} />}>
        <Route index element={<HomePage notify={notify} />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="menu" element={<MenuPage notify={notify} />} />
        <Route path="foods/:foodId" element={<FoodDetailsPage notify={notify} />} />
        <Route path="login" element={<AuthPage mode="login" />} />
        <Route path="register" element={<AuthPage mode="register" />} />
        <Route path="unauthorized" element={<UnauthorizedPage />} />
        <Route element={<ProtectedRoute roles={['student']} />}>
          <Route element={<StudentLayout />}>
            <Route path="student/dashboard" element={<StudentDashboard />} />
            <Route path="student/menu" element={<MenuPage notify={notify} />} />
            <Route path="student/categories" element={<FoodCategoriesPage />} />
            <Route path="student/track-order" element={<TrackOrdersPage />} />
            <Route path="student/track/:orderId" element={<TrackOrderDetailPage />} />
            <Route path="cart" element={<CartPage notify={notify} />} />
            <Route path="checkout" element={<CheckoutPage notify={notify} />} />
            <Route path="order-confirmation/:orderId" element={<OrderConfirmationPage />} />
            <Route path="checkout/:orderId/payment" element={<PaymentPage />} />
            <Route path="receipt/:paymentId" element={<ReceiptPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="payments" element={<PaymentHistoryPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="notifications" element={<NotificationPage />} />
          </Route>
        </Route>
        <Route element={<ProtectedRoute roles={['foodmaker']} />}>
          <Route path="kitchen" element={<KitchenLayout />}>
            <Route index element={<KitchenOverview />} />
            <Route path="incoming" element={<KitchenPage />} />
            <Route path="pending" element={<KitchenPage />} />
            <Route path="preparing" element={<KitchenPage />} />
            <Route path="ready" element={<KitchenPage />} />
            <Route path="completed" element={<KitchenPage />} />
            <Route path="orders/:orderId" element={<KitchenOrderDetails />} />
            <Route path="notifications" element={<NotificationPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
        <Route element={<ProtectedRoute roles={['admin']} />}>
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="categories" element={<AdminCategoriesPage />} />
            <Route path="menu" element={<AdminMenuPage />} />
            <Route path="orders" element={<AdminOrdersPage />} />
            <Route path="payments" element={<AdminPaymentsPage />} />
            <Route path="reports" element={<AdminReportsPage />} />
            <Route path="activity-logs" element={<AdminActivityLogsPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  </>;
}
