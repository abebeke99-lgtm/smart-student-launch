import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, BarChart3, CheckCircle2, ChevronLeft, ChevronRight, CircleDollarSign,
  ClipboardList, LayoutDashboard, LogOut, Search, Settings, Shield, Tags, Users, Utensils,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Link, Outlet, useLocation, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api, jsonBody } from '../services/api.js';

const STATUS_OPTIONS = ['pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled'];
const PAGE_SIZE = 20;

function useAdminNotice() {
  return useOutletContext();
}

function usePageData(loader, dependencies = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    setData(null);
    try {
      const result = await loader();
      setData(result);
      setError('');
      return result;
    } catch (requestError) {
      setError(requestError.message);
      return null;
    } finally {
      setLoading(false);
    }
  // Loader is recreated by callers; dependencies are the intended refresh keys.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
  useEffect(() => { refresh(); }, [refresh]);
  return { data, setData, error, setError, loading, refresh };
}

function query(values) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') params.set(key, value);
  });
  return params.toString();
}

function dateText(value) {
  return value ? new Date(value).toLocaleString() : '—';
}

function money(value) {
  return `${Number(value || 0).toFixed(2)} ETB`;
}

function statusText(status) {
  return status === 'served' ? 'Completed' : status?.[0]?.toUpperCase() + status?.slice(1);
}

function PageHeading({ eyebrow, title, description, action }) {
  return <div className="admin-page-heading"><div><p className="eyebrow">{eyebrow}</p><h1 className="page-title">{title}</h1>{description && <p className="muted">{description}</p>}</div>{action}</div>;
}

function AdminTable({ columns, rows, rowKey, empty = 'No records match these filters.', loading }) {
  if (loading) return <p className="page-message">Loading records…</p>;
  if (!rows?.length) return <div className="empty-state admin-empty"><h3>No results</h3><p>{empty}</p></div>;
  return <div className="table-scroll admin-table-scroll"><table className="admin-table"><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
    <tbody>{rows.map((row, index) => <tr key={rowKey ? rowKey(row) : row._id || row.id || index}>{columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : row[column.key] ?? '—'}</td>)}</tr>)}</tbody>
  </table></div>;
}

function Pagination({ page, totalPages, total, onChange }) {
  if (totalPages < 2) return <p className="admin-pagination-summary">{total} record{total === 1 ? '' : 's'}</p>;
  return <div className="admin-pagination"><span>Page {page} of {totalPages} · {total} records</span><div><button className="button button-small button-outline" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft size={15} /> Previous</button><button className="button button-small button-outline" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next <ChevronRight size={15} /></button></div></div>;
}

function FilterBar({ children, onSubmit }) {
  return <form className="admin-filter-bar" onSubmit={(event) => { event.preventDefault(); onSubmit?.(); }}>{children}</form>;
}

function DataError({ error }) {
  return error ? <div className="inline-error" role="alert">{error}</div> : null;
}

export function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [toast, setToast] = useState('');
  const notify = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3500);
  }, []);
  async function signOut() {
    await logout();
    navigate('/');
  }
  const links = [
    ['/admin', 'Dashboard', LayoutDashboard, true],
    ['/admin/users', 'Users', Users],
    ['/admin/categories', 'Food Categories', Tags],
    ['/admin/menu', 'Food Menu', Utensils],
    ['/admin/orders', 'Orders', ClipboardList],
    ['/admin/payments', 'Payment Monitoring', CircleDollarSign],
    ['/admin/reports', 'Reports & Analytics', BarChart3],
    ['/admin/activity-logs', 'Activity Logs', Activity],
    ['/admin/settings', 'System Settings', Settings],
  ];
  return <div className="admin-root">
    <header className="admin-header"><Link className="admin-brand" to="/admin"><span className="admin-brand-icon"><Shield size={18} /></span> Smart Cafeteria <small>ADMIN</small></Link>
      <div className="admin-account"><span><strong>{user?.name}</strong><small>Administrator</small></span><button className="button button-small button-outline" onClick={signOut}><LogOut size={15} /> Logout</button></div>
    </header>
    <div className="admin-shell">
      <aside className="admin-sidebar"><p className="sidebar-heading">ADMIN WORKSPACE</p><nav aria-label="Administrator dashboard">
        {links.map(([to, label, Icon, exact]) => {
          const active = exact ? location.pathname === to : location.pathname === to || location.pathname.startsWith(`${to}/`);
          return <Link key={to} to={to} className={`sidebar-link ${active ? 'selected' : ''}`} aria-current={active ? 'page' : undefined}><Icon size={17} /><span>{label}</span></Link>;
        })}
      </nav><button className="sidebar-link sidebar-logout" onClick={signOut}><LogOut size={17} /><span>Logout</span></button></aside>
      <main className="admin-main"><Outlet context={{ notify }} /></main>
    </div>
    {toast && <div className="admin-toast" role="status"><CheckCircle2 size={17} />{toast}</div>}
  </div>;
}

export function AdminDashboardPage() {
  const { data, error, loading } = usePageData(async () => {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - 29);
    const range = query({ startDate: start.toISOString().slice(0, 10), endDate: new Date().toISOString().slice(0, 10), limit: 8 });
    const [dashboard, sales, popular, recent] = await Promise.all([
      api('/reports/dashboard'), api(`/reports/sales?${range}`),
      api(`/reports/popular-foods?${range}&limit=5`), api(`/reports/orders?${range}`),
    ]);
    return { ...dashboard.data, salesSeries: sales.data.sales, popular: popular.data.items, recent: recent.data.orders.slice(0, 8) };
  }, []);
  const totals = data?.totals || {};
  const stats = [
    ['Registered users', totals.users], ['Food items', totals.menuItems], ['Categories', totals.categories],
    ['Total orders', totals.orders], ['Pending', totals.pending], ['Preparing', totals.preparing],
    ['Completed', totals.completed], ['Cancelled', totals.cancelled],
    ['Daily sales', money(data?.sales?.daily)], ['Weekly sales', money(data?.sales?.weekly)], ['Monthly sales', money(data?.sales?.monthly)],
  ];
  const statusData = useMemo(() => (data?.statusDistribution || []).map((item) => ({ status: statusText(item._id), count: item.count })), [data]);
  return <section className="admin-page">
    <PageHeading eyebrow="SYSTEM OVERVIEW" title="Administrator dashboard" description="Live totals and reports calculated from the shared cafeteria database." />
    <DataError error={error} />
    {loading && !data ? <p className="page-message">Loading dashboard data…</p> : data && <>
      <div className="admin-stat-grid">{stats.map(([label, value]) => <article className="admin-stat-card" key={label}><span>{label}</span><strong>{value ?? 0}</strong></article>)}</div>
      <div className="admin-chart-grid">
        <section className="admin-panel"><div className="admin-panel-heading"><div><p className="eyebrow">ORDER HEALTH</p><h2>Order status</h2></div></div>
          {statusData.length ? <div className="admin-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={statusData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="status" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="#397b66" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div> : <p className="muted">No order status data yet.</p>}
        </section>
        <section className="admin-panel"><div className="admin-panel-heading"><div><p className="eyebrow">PAID ORDERS</p><h2>Sales · ETB</h2></div></div>
          {data.salesSeries?.length ? <div className="admin-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.salesSeries}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="_id" tick={{ fontSize: 10 }} minTickGap={18} /><YAxis /><Tooltip formatter={(value) => money(value)} /><Line type="monotone" dataKey="sales" stroke="#527c52" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer></div> : <p className="muted">No successfully paid orders in this period.</p>}
          <small className="muted">Successful simulated payments only, grouped by UTC order date.</small>
        </section>
      </div>
      <div className="admin-chart-grid">
        <section className="admin-panel"><div className="admin-panel-heading"><div><p className="eyebrow">MENU PERFORMANCE</p><h2>Popular food</h2></div><Link className="detail-link" to="/admin/reports?report=popular">Full report</Link></div>
          {data.popular?.length ? <div className="admin-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.popular} layout="vertical" margin={{ left: 10 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="_id" width={100} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="quantity" fill="#9aaa66" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></div> : <p className="muted">No orders to rank yet.</p>}
        </section>
        <section className="admin-panel"><div className="admin-panel-heading"><div><p className="eyebrow">LATEST ACTIVITY</p><h2>Recent orders</h2></div><Link className="detail-link" to="/admin/orders">All orders</Link></div>
          {data.recent?.length ? <div className="admin-recent-list">{data.recent.map((order) => <div className="admin-recent-row" key={order._id}><span><strong>{order.orderNumber}</strong><small>{order.user?.name || 'Customer'} · {dateText(order.createdAt)}</small></span><span className={`pill status-${order.status}`}>{statusText(order.status)}</span></div>)}</div> : <div className="empty-state admin-empty"><h3>No orders yet</h3></div>}
        </section>
      </div>
      <p className="admin-definition">Sales include order totals with payment status <strong>paid</strong>, excluding cancelled orders. Sales report dates are based on order creation time in UTC.</p>
    </>}
  </section>;
}

export function AdminUsersPage() {
  const { notify } = useAdminNotice();
  const [filters, setFilters] = useState({ search: '', role: '', isActive: '' });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const request = usePageData(async () => {
    const result = await api(`/users?${query({ ...applied, page, limit: PAGE_SIZE })}`);
    return result;
  }, [applied, page]);
  async function action(path, options, message) {
    try { await api(path, options); notify(message); await request.refresh(); }
    catch (error) { request.setError(error.message); }
  }
  async function showUser(user) {
    try { const result = await api(`/users/${user.id}`); setSelected(result.data.user); }
    catch (error) { request.setError(error.message); }
  }
  async function removeUser(user) {
    if (!window.confirm(`Delete ${user.name} (${user.email})? Accounts with orders/payment history cannot be deleted.`)) return;
    await action(`/users/${user.id}`, { method: 'DELETE' }, 'Account deleted.');
  }
  const columns = [
    { key: 'identity', label: 'Account', render: (user) => <><strong>{user.name}</strong><small className="table-subline">{user.email}</small></> },
    { key: 'role', label: 'Role', render: (user) => <select aria-label={`Role for ${user.email}`} value={user.role} onChange={(event) => action(`/users/${user.id}/role`, { method: 'PATCH', body: jsonBody({ role: event.target.value }) }, 'User role updated.')}>{['student', 'foodmaker', 'admin'].map((role) => <option key={role}>{role}</option>)}</select> },
    { key: 'active', label: 'Account status', render: (user) => <span className={`admin-status ${user.isActive ? 'active' : 'inactive'}`}>{user.isActive ? 'Active' : 'Inactive'}</span> },
    { key: 'createdAt', label: 'Joined', render: (user) => dateText(user.createdAt) },
    { key: 'actions', label: 'Actions', render: (user) => <div className="table-actions"><button className="link-button" onClick={() => showUser(user)}>Details</button><button className="link-button" onClick={() => action(`/users/${user.id}/status`, { method: 'PATCH', body: jsonBody({ isActive: !user.isActive }) }, `Account ${user.isActive ? 'deactivated' : 'activated'}.`)}>{user.isActive ? 'Deactivate' : 'Activate'}</button><button className="link-button danger-text" onClick={() => removeUser(user)}>Delete</button></div> },
  ];
  return <section className="admin-page"><PageHeading eyebrow="ACCESS CONTROL" title="User management" description="Search accounts, manage role assignments and account access." />
    <DataError error={request.error} />
    <FilterBar onSubmit={() => { setPage(1); setApplied(filters); }}><label className="admin-search"><Search size={17} /><input placeholder="Search name or email" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></label><select aria-label="Filter user role" value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value })}><option value="">All roles</option><option value="student">Student</option><option value="foodmaker">Food maker</option><option value="admin">Admin</option></select><select aria-label="Filter account status" value={filters.isActive} onChange={(e) => setFilters({ ...filters, isActive: e.target.value })}><option value="">All account states</option><option value="true">Active</option><option value="false">Inactive</option></select><button className="button button-small">Apply filters</button></FilterBar>
    <AdminTable columns={columns} rows={request.data?.data.users} loading={request.loading} />
    <Pagination page={request.data?.pagination.page || page} totalPages={request.data?.pagination.totalPages || 1} total={request.data?.pagination.total || 0} onChange={setPage} />
    {selected && <div className="admin-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelected(null); }}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="user-detail-title"><button className="modal-close" onClick={() => setSelected(null)} aria-label="Close">×</button><p className="eyebrow">ACCOUNT DETAIL</p><h2 id="user-detail-title">{selected.name}</h2><dl className="admin-detail-list"><dt>Email</dt><dd>{selected.email}</dd><dt>Phone</dt><dd>{selected.phone || 'Not provided'}</dd><dt>Role</dt><dd>{selected.role}</dd><dt>Status</dt><dd>{selected.isActive ? 'Active' : 'Inactive'}</dd><dt>Created</dt><dd>{dateText(selected.createdAt)}</dd></dl><p className="muted">Password credentials are never returned by the API.</p><button className="button" onClick={() => setSelected(null)}>Close</button></section></div>}
  </section>;
}

export function AdminCategoriesPage() {
  const { notify } = useAdminNotice();
  const [form, setForm] = useState({ name: '', description: '' });
  const [editing, setEditing] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const request = usePageData(async () => (await api('/categories/admin')).data.categories, []);
  async function save(event) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      await api(editing ? `/categories/${editing}` : '/categories', {
        method: editing ? 'PATCH' : 'POST', body: jsonBody(form),
      });
      setForm({ name: '', description: '' }); setEditing('');
      notify(editing ? 'Category updated.' : 'Category created.');
      await request.refresh();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function toggle(category) {
    try {
      await api(`/categories/${category._id}`, { method: 'PATCH', body: jsonBody({ isActive: !category.isActive }) });
      notify(`Category ${category.isActive ? 'deactivated' : 'activated'}.`);
      await request.refresh();
    } catch (e) { request.setError(e.message); }
  }
  async function remove(category) {
    if (!window.confirm(`Delete “${category.name}”? Categories containing food items cannot be deleted.`)) return;
    try {
      await api(`/categories/${category._id}`, { method: 'DELETE' });
      notify('Category deleted.'); await request.refresh();
    } catch (e) { request.setError(e.message); }
  }
  const columns = [
    { key: 'name', label: 'Category', render: (row) => <strong>{row.name}</strong> },
    { key: 'description', label: 'Description' },
    { key: 'status', label: 'Visibility', render: (row) => <span className={`admin-status ${row.isActive ? 'active' : 'inactive'}`}>{row.isActive ? 'Active' : 'Inactive'}</span> },
    { key: 'actions', label: 'Actions', render: (row) => <div className="table-actions"><button className="link-button" onClick={() => { setEditing(row._id); setForm({ name: row.name, description: row.description || '' }); }}>{'Edit'}</button><button className="link-button" onClick={() => toggle(row)}>{row.isActive ? 'Deactivate' : 'Activate'}</button><button className="link-button danger-text" onClick={() => remove(row)}>Delete</button></div> },
  ];
  return <section className="admin-page"><PageHeading eyebrow="MENU ORGANIZATION" title="Food categories" description="Inactive categories are hidden from the student menu; categories with menu items cannot be deleted." />
    <DataError error={request.error || error} />
    <form className="admin-editor" onSubmit={save}><h2>{editing ? 'Edit category' : 'Add a category'}</h2><div className="admin-form-grid"><label>Category name<input required minLength="2" maxLength="80" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>Description<input maxLength="500" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label></div><div className="admin-form-actions"><button className="button" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create category'}</button>{editing && <button className="button button-outline" type="button" onClick={() => { setEditing(''); setForm({ name: '', description: '' }); }}>Cancel</button>}</div></form>
    <section className="admin-panel"><div className="admin-panel-heading"><h2>All categories</h2><span className="muted">{request.data?.length || 0} total</span></div><AdminTable columns={columns} rows={request.data} loading={request.loading} empty="Create a food category to organize the cafeteria menu." /></section>
  </section>;
}

const EMPTY_FOOD = { name: '', description: '', price: '', category: '', preparationTime: '10', imageUrl: '', isAvailable: true, isPublished: true };

export function AdminMenuPage() {
  const { notify } = useAdminNotice();
  const [filters, setFilters] = useState({ search: '', category: '', isAvailable: '' });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(EMPTY_FOOD);
  const [image, setImage] = useState(null);
  const [editing, setEditing] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api('/categories/admin').then((r) => setCategories(r.data.categories)).catch((e) => setError(e.message)); }, []);
  const request = usePageData(async () => api(`/foods/admin?${query({ ...applied, page, limit: PAGE_SIZE })}`), [applied, page]);
  function edit(item) {
    setEditing(item._id); setImage(null);
    setForm({ name: item.name, description: item.description || '', price: item.price, category: item.category?._id || item.category, preparationTime: item.preparationTime, imageUrl: item.imageUrl || '', isAvailable: item.isAvailable, isPublished: item.isPublished !== false });
    setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function startCreate() { setEditing(''); setForm({ ...EMPTY_FOOD }); setImage(null); setShowForm(true); }
  async function save(event) {
    event.preventDefault(); setBusy(true); setError('');
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (key === 'imageUrl' && image) return;
      body.append(key, String(value));
    });
    if (image) body.append('image', image);
    try {
      await api(editing ? `/foods/${editing}` : '/foods', { method: editing ? 'PATCH' : 'POST', body });
      setShowForm(false); setEditing(''); setForm({ ...EMPTY_FOOD }); setImage(null);
      notify(editing ? 'Food item updated.' : 'Food item created.');
      await request.refresh();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function changeItem(item, changes, message) {
    try { await api(`/foods/${item._id}`, { method: 'PATCH', body: jsonBody(changes) }); notify(message); await request.refresh(); }
    catch (e) { request.setError(e.message); }
  }
  async function remove(item) {
    if (!window.confirm(`Delete “${item.name}”? Historical orders retain their saved item and price snapshots.`)) return;
    try { await api(`/foods/${item._id}`, { method: 'DELETE' }); notify('Food item deleted.'); await request.refresh(); }
    catch (e) { request.setError(e.message); }
  }
  const columns = [
    { key: 'food', label: 'Food item', render: (item) => <div className="admin-food-cell">{item.imageUrl ? <img src={item.imageUrl.startsWith('/uploads/') ? `${import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '') || 'http://localhost:5000'}${item.imageUrl}` : item.imageUrl} alt="" /> : <span className="admin-food-placeholder"><Utensils size={17} /></span>}<span><strong>{item.name}</strong><small className="table-subline">{item.category?.name || 'No category'}</small></span></div> },
    { key: 'price', label: 'Price', render: (item) => money(item.price) },
    { key: 'isAvailable', label: 'Availability', render: (item) => <button className={`admin-status-button ${item.isAvailable ? 'active' : 'inactive'}`} onClick={() => changeItem(item, { isAvailable: !item.isAvailable }, 'Availability updated.')}>{item.isAvailable ? 'Available' : 'Unavailable'}</button> },
    { key: 'isPublished', label: 'Publication', render: (item) => <button className={`admin-status-button ${item.isPublished !== false ? 'active' : 'inactive'}`} onClick={() => changeItem(item, { isPublished: item.isPublished === false }, 'Publication status updated.')}>{item.isPublished !== false ? 'Published' : 'Unpublished'}</button> },
    { key: 'actions', label: 'Actions', render: (item) => <div className="table-actions"><button className="link-button" onClick={() => edit(item)}>Edit</button><button className="link-button danger-text" onClick={() => remove(item)}>Delete</button></div> },
  ];
  return <section className="admin-page"><PageHeading eyebrow="CAFETERIA MENU" title="Food menu" description="Manage item descriptions, ETB prices, images, availability, categories, and publication." action={<button className="button" onClick={startCreate}>Add food item</button>} />
    <DataError error={request.error || error} />
    {showForm && <form className="admin-editor" onSubmit={save}><h2>{editing ? 'Edit food item' : 'Create food item'}</h2><div className="admin-form-grid"><label>Name<input required minLength="2" maxLength="120" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>Price (ETB)<input required type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label><label>Category<select required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option value="">Select category</option>{categories.map((c) => <option value={c._id} key={c._id}>{c.name}{c.isActive ? '' : ' (inactive)'}</option>)}</select></label><label>Preparation time (minutes)<input required type="number" min="0" step="1" value={form.preparationTime} onChange={(e) => setForm({ ...form, preparationTime: e.target.value })} /></label><label className="wide-field">Description<textarea maxLength="1000" rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label><label>Image URL<input type="text" placeholder="https://… or current /uploads path" value={form.imageUrl} disabled={Boolean(image)} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} /></label><label>Upload image<input type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={(e) => { setImage(e.target.files?.[0] || null); if (e.target.files?.[0]) setForm({ ...form, imageUrl: '' }); }} /><small className="muted">JPEG, PNG, GIF, WebP · maximum 5 MB</small></label></div><div className="admin-checks"><label><input type="checkbox" checked={form.isAvailable} onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })} /> Available to order</label><label><input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} /> Published on student menu</label></div><div className="admin-form-actions"><button className="button" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save item' : 'Create item'}</button><button type="button" className="button button-outline" onClick={() => setShowForm(false)}>Cancel</button></div></form>}
    <FilterBar onSubmit={() => { setPage(1); setApplied(filters); }}><label className="admin-search"><Search size={17} /><input placeholder="Search food name" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></label><select aria-label="Filter category" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}><option value="">All categories</option>{categories.map((c) => <option value={c._id} key={c._id}>{c.name}</option>)}</select><select aria-label="Filter availability" value={filters.isAvailable} onChange={(e) => setFilters({ ...filters, isAvailable: e.target.value })}><option value="">All availability</option><option value="true">Available</option><option value="false">Unavailable</option></select><button className="button button-small">Filter</button></FilterBar>
    <AdminTable columns={columns} rows={request.data?.data.items} loading={request.loading} empty="No food items match the current filters." /><Pagination page={request.data?.pagination.page || page} totalPages={request.data?.pagination.totalPages || 1} total={request.data?.pagination.totalItems || 0} onChange={setPage} />
  </section>;
}

export function AdminOrdersPage() {
  const [filters, setFilters] = useState({ search: '', status: '', customerSearch: '', startDate: '', endDate: '' });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const { notify } = useAdminNotice();
  const request = usePageData(async () => api(`/orders?${query({ ...applied, page, limit: PAGE_SIZE })}`), [applied, page]);
  async function show(order) {
    try { const result = await api(`/orders/${order._id}`); setSelected(result.data.order); }
    catch (e) { setError(e.message); }
  }
  async function updateStatus(order, status) {
    if (!window.confirm(`Change ${order.orderNumber} to ${statusText(status)}?`)) return;
    try {
      await api(`/orders/${order._id}/status`, { method: 'PATCH', body: jsonBody({ status, note: 'Status updated by an administrator.' }) });
      notify('Order status updated.'); setSelected(null); await request.refresh();
    } catch (e) { setError(e.message); }
  }
  const columns = [
    { key: 'orderNumber', label: 'Order', render: (o) => <strong>{o.orderNumber}</strong> },
    { key: 'customer', label: 'Customer', render: (o) => o.user?.name || 'Customer' },
    { key: 'createdAt', label: 'Placed', render: (o) => dateText(o.createdAt) },
    { key: 'status', label: 'Status', render: (o) => <span className={`pill status-${o.status}`}>{statusText(o.status)}</span> },
    { key: 'paymentStatus', label: 'Payment', render: (o) => <span className={`pill status-${o.paymentStatus === 'paid' ? 'served' : o.paymentStatus === 'failed' ? 'cancelled' : 'pending'}`}>{o.paymentStatus}</span> },
    { key: 'totalAmount', label: 'Total', render: (o) => money(o.totalAmount) },
    { key: 'actions', label: 'Details', render: (o) => <button className="link-button" onClick={() => show(o)}>View order</button> },
  ];
  return <section className="admin-page"><PageHeading eyebrow="FULFILLMENT" title="Order management" description="Search and review customer orders; historical item prices are stored as immutable order snapshots." /><DataError error={request.error || error} />
    <FilterBar onSubmit={() => { setPage(1); setApplied(filters); }}><label className="admin-search"><Search size={17} /><input placeholder="Order number" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></label><input placeholder="Customer name or email" aria-label="Customer name or email" value={filters.customerSearch} onChange={(e) => setFilters({ ...filters, customerSearch: e.target.value })} /><select aria-label="Order status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All statuses</option>{STATUS_OPTIONS.map((s) => <option value={s} key={s}>{statusText(s)}</option>)}</select><label className="admin-date-label">From<input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} /></label><label className="admin-date-label">To<input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} /></label><button className="button button-small">Apply</button></FilterBar>
    <AdminTable columns={columns} rows={request.data?.data.orders} loading={request.loading} /><Pagination page={request.data?.pagination.page || page} totalPages={request.data?.pagination.totalPages || 1} total={request.data?.pagination.total || 0} onChange={setPage} />
    {selected && <div className="admin-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelected(null); }}><section className="admin-modal admin-order-modal" role="dialog" aria-modal="true" aria-labelledby="order-modal-title"><button className="modal-close" onClick={() => setSelected(null)} aria-label="Close">×</button><p className="eyebrow">ORDER DETAIL · {dateText(selected.createdAt)}</p><h2 id="order-modal-title">{selected.orderNumber}</h2><p>Customer: <strong>{selected.user?.name || 'Customer'}</strong> · Payment: <strong>{selected.paymentStatus}</strong></p><ul className="admin-order-items">{selected.items.map((item, index) => <li key={`${item.name}-${index}`}><span>{item.quantity} × {item.name}</span><strong>{money(item.price * item.quantity)}</strong></li>)}</ul><p className="admin-order-total">Total snapshot <strong>{money(selected.totalAmount)}</strong></p><h3>Status history</h3><div className="admin-status-history">{selected.statusHistory.map((entry, index) => <div key={`${entry.status}-${index}`}><span className={`pill status-${entry.status}`}>{statusText(entry.status)}</span><small>{dateText(entry.changedAt)}{entry.note && ` · ${entry.note}`}</small></div>)}</div><div className="admin-form-actions"><label>Authorized next status<select value="" onChange={(e) => { if (e.target.value) updateStatus(selected, e.target.value); }}><option value="">Choose valid transition</option>{(selected.status === 'pending' ? ['confirmed', 'cancelled'] : selected.status === 'confirmed' ? ['preparing', 'cancelled'] : selected.status === 'preparing' ? ['ready', 'cancelled'] : selected.status === 'ready' ? ['served'] : []).map((s) => <option value={s} key={s}>{statusText(s)}</option>)}</select></label><button className="button button-outline" onClick={() => setSelected(null)}>Close</button></div></section></div>}
  </section>;
}

export function AdminPaymentsPage() {
  const [filters, setFilters] = useState({ search: '', status: '', method: '', startDate: '', endDate: '' });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const request = usePageData(async () => api(`/payments?${query({ ...applied, page, limit: PAGE_SIZE })}`), [applied, page]);
  const columns = [
    { key: 'reference', label: 'Transaction reference', render: (p) => <strong>{p.transactionId || '—'}</strong> },
    { key: 'order', label: 'Order', render: (p) => p.order?.orderNumber || '—' },
    { key: 'customer', label: 'Customer', render: (p) => p.user?.name || '—' },
    { key: 'method', label: 'Method', render: (p) => p.method },
    { key: 'amount', label: 'Amount', render: (p) => money(p.amount) },
    { key: 'status', label: 'Result', render: (p) => <span className={`pill status-${p.status === 'successful' ? 'served' : p.status === 'failed' ? 'cancelled' : 'pending'}`}>{p.status}</span> },
    { key: 'createdAt', label: 'Recorded', render: (p) => dateText(p.createdAt) },
  ];
  return <section className="admin-page"><PageHeading eyebrow="SIMULATION MONITOR" title="Payment monitoring" description="Read-only simulated payment records. No real financial transaction is processed." /><div className="simulation-banner"><Shield size={18} /> Academic simulation records only · payment history cannot be edited here.</div><DataError error={request.error} />
    <FilterBar onSubmit={() => { setPage(1); setApplied(filters); }}><label className="admin-search"><Search size={17} /><input placeholder="Transaction reference" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></label><select aria-label="Payment result" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All results</option>{['pending', 'successful', 'failed'].map((s) => <option value={s} key={s}>{s}</option>)}</select><select aria-label="Payment method" value={filters.method} onChange={(e) => setFilters({ ...filters, method: e.target.value })}><option value="">All methods</option><option value="cbe-birr">CBE Birr</option><option value="telebirr">TeleBirr</option><option value="mobile-banking">Mobile banking</option></select><label className="admin-date-label">From<input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} /></label><label className="admin-date-label">To<input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} /></label><button className="button button-small">Filter</button></FilterBar>
    <AdminTable columns={columns} rows={request.data?.data.payments} loading={request.loading} empty="No simulated payments match the selected filters." /><Pagination page={request.data?.pagination.page || page} totalPages={request.data?.pagination.totalPages || 1} total={request.data?.pagination.total || 0} onChange={setPage} />
  </section>;
}

const REPORT_TYPES = [
  ['daily', 'Daily Order Report'],
  ['sales', 'Sales Report'],
  ['popular', 'Popular Food Report'],
  ['customers', 'Customer Order Report'],
  ['payments', 'Payment Report'],
];

export function AdminReportsPage() {
  const [searchParams] = useSearchParams();
  const initialReport = searchParams.get('report') === 'popular' ? 'popular' : 'daily';
  const initialRange = useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 29);
    return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
  }, []);
  const todayRange = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return { startDate: today, endDate: today };
  }, []);
  const [report, setReport] = useState(initialReport);
  const initialFilters = initialReport === 'daily' ? todayRange : initialRange;
  const [filters, setFilters] = useState(() => ({ ...initialFilters, status: '', customerSearch: '', search: '', method: '' }));
  const [applied, setApplied] = useState(() => ({ ...initialFilters, status: '', customerSearch: '', search: '', method: '' }));
  const [page, setPage] = useState(1);
  const request = usePageData(async () => {
    const params = query({ startDate: applied.startDate, endDate: applied.endDate, page, limit: PAGE_SIZE, status: applied.status });
    if (report === 'sales') return { type: report, response: await api(`/reports/sales?${params}`) };
    if (report === 'popular') return { type: report, response: await api(`/reports/popular-foods?${params}`) };
    if (report === 'payments') return { type: report, response: await api(`/reports/payments?${query({ ...applied, page, limit: PAGE_SIZE })}`) };
    const customerSearch = report === 'customers' ? applied.customerSearch : undefined;
    return { type: report, response: await api(`/reports/orders?${query({ ...applied, customerSearch, page, limit: PAGE_SIZE })}`) };
  }, [report, applied, page]);
  const reportData = request.data?.response;
  const rows = report === 'popular' ? reportData?.data.items
    : report === 'payments' ? reportData?.data.payments
      : ['daily', 'customers'].includes(report) ? reportData?.data.orders : [];
  const pagination = reportData?.pagination;
  const columns = report === 'popular' ? [
    { key: 'name', label: 'Food item', render: (r) => r._id }, { key: 'quantity', label: 'Quantity ordered' }, { key: 'revenue', label: 'Order snapshot value', render: (r) => money(r.revenue) },
  ] : report === 'payments' ? [
    { key: 'transactionId', label: 'Reference' }, { key: 'order', label: 'Order', render: (r) => r.order?.orderNumber || '—' }, { key: 'method', label: 'Method' }, { key: 'amount', label: 'Amount', render: (r) => money(r.amount) }, { key: 'status', label: 'Status' }, { key: 'createdAt', label: 'Date', render: (r) => dateText(r.createdAt) },
  ] : [
    { key: 'orderNumber', label: 'Order', render: (r) => <strong>{r.orderNumber}</strong> }, { key: 'customer', label: 'Customer', render: (r) => r.user?.name || 'Customer' }, { key: 'createdAt', label: 'Order date', render: (r) => dateText(r.createdAt) }, { key: 'status', label: 'Status', render: (r) => statusText(r.status) }, { key: 'paymentStatus', label: 'Payment' }, { key: 'totalAmount', label: 'Total', render: (r) => money(r.totalAmount) },
  ];
  return <section className="admin-page"><PageHeading eyebrow="DATABASE REPORTS" title="Reports & analytics" description="Filter operational reports by UTC date range; empty results are shown explicitly." /><DataError error={request.error} />
    <div className="admin-report-tabs" role="tablist" aria-label="Report types">{REPORT_TYPES.map(([key, label]) => <button key={key} role="tab" aria-selected={report === key} className={report === key ? 'selected' : ''} onClick={() => { const range = key === 'daily' ? todayRange : initialRange; setReport(key); setPage(1); setFilters((current) => ({ ...current, ...range })); setApplied((current) => ({ ...current, ...range })); }}>{label}</button>)}</div>
    <FilterBar onSubmit={() => { setPage(1); setApplied(filters); }}><label className="admin-date-label">From<input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} /></label><label className="admin-date-label">To<input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} /></label>
      {['daily', 'customers'].includes(report) && <><select aria-label="Report status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All order statuses</option>{STATUS_OPTIONS.map((s) => <option value={s} key={s}>{statusText(s)}</option>)}</select>{report === 'customers' && <input aria-label="Filter by customer" placeholder="Customer name or email" value={filters.customerSearch} onChange={(e) => setFilters({ ...filters, customerSearch: e.target.value })} />}</>}
      {report === 'payments' && <><input aria-label="Transaction reference" placeholder="Transaction reference" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /><select aria-label="Payment method" value={filters.method} onChange={(e) => setFilters({ ...filters, method: e.target.value })}><option value="">All methods</option><option value="telebirr">TeleBirr</option><option value="cbe-birr">CBE Birr</option><option value="mobile-banking">Mobile Banking</option></select></>}
      <button className="button button-small">Run report</button>
    </FilterBar>
    {report === 'sales' ? <section className="admin-panel"><div className="admin-panel-heading"><div><p className="eyebrow">SUCCESSFUL SIMULATED PAYMENTS</p><h2>Sales by UTC order date</h2></div></div><p className="admin-definition">{reportData?.definition || 'Sales sum successfully paid, non-cancelled order totals using order creation date.'}</p>{reportData?.data.sales?.length ? <div className="admin-chart admin-chart-tall"><ResponsiveContainer width="100%" height="100%"><LineChart data={reportData.data.sales}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="_id" tick={{ fontSize: 11 }} minTickGap={18} /><YAxis /><Tooltip formatter={(v) => money(v)} /><Line type="monotone" dataKey="sales" stroke="#397b66" strokeWidth={3} /></LineChart></ResponsiveContainer></div> : <div className="empty-state admin-empty"><h3>No successful paid orders for this date range</h3></div>}</section> :
      <><section className="admin-panel"><div className="admin-panel-heading"><h2>{REPORT_TYPES.find(([key]) => key === report)?.[1]}</h2>{reportData?.definition && <span className="muted">{reportData.definition}</span>}</div><AdminTable columns={columns} rows={rows} loading={request.loading} empty="No records were found for this report and date range." /></section><Pagination page={pagination?.page || page} totalPages={pagination?.totalPages || 1} total={pagination?.total || 0} onChange={setPage} /></>}
  </section>;
}

export function AdminActivityLogsPage() {
  const [filters, setFilters] = useState({ search: '', entity: '', action: '', startDate: '', endDate: '' });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const request = usePageData(async () => api(`/activity-logs?${query({ ...applied, page, limit: PAGE_SIZE })}`), [applied, page]);
  const columns = [
    { key: 'createdAt', label: 'Time', render: (log) => dateText(log.createdAt) },
    { key: 'actor', label: 'Actor', render: (log) => log.user ? `${log.user.name} (${log.user.role})` : 'System / deleted account' },
    { key: 'action', label: 'Action', render: (log) => <strong>{log.action}</strong> },
    { key: 'entity', label: 'Entity' },
    { key: 'entityId', label: 'Entity ID', render: (log) => log.entityId?.toString?.() || '—' },
    { key: 'description', label: 'Details', render: (log) => <span className="admin-log-details">{log.description || JSON.stringify(log.metadata || {})}</span> },
  ];
  return <section className="admin-page"><PageHeading eyebrow="AUDIT TRAIL" title="Activity logs" description="Append-only audit events for administrative, menu, order and payment activity." /><DataError error={request.error} />
    <FilterBar onSubmit={() => { setPage(1); setApplied(filters); }}><label className="admin-search"><Search size={17} /><input placeholder="Search events" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></label><input aria-label="Filter entity type" placeholder="Entity (User, Order…)" value={filters.entity} onChange={(e) => setFilters({ ...filters, entity: e.target.value })} /><input aria-label="Filter action" placeholder="Action name" value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })} /><label className="admin-date-label">From<input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} /></label><label className="admin-date-label">To<input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} /></label><button className="button button-small">Filter logs</button></FilterBar>
    <AdminTable columns={columns} rows={request.data?.data.logs} loading={request.loading} empty="No activity logs match the current filters." /><Pagination page={request.data?.pagination.page || page} totalPages={Math.ceil((request.data?.pagination.total || 0) / PAGE_SIZE) || 1} total={request.data?.pagination.total || 0} onChange={setPage} />
  </section>;
}

export function AdminSettingsPage() {
  const request = usePageData(async () => (await api('/settings')).data, []);
  return <section className="admin-page"><PageHeading eyebrow="SYSTEM CONFIGURATION" title="System settings" description="Safe, effective configuration values. Secrets and database credentials are never sent to the browser." /><DataError error={request.error} />
    {request.loading ? <p className="page-message">Loading configuration…</p> : request.data && <div className="admin-settings-grid">
      <section className="admin-panel"><p className="eyebrow">RUNTIME</p><h2>Application environment</h2><dl className="admin-detail-list"><dt>Environment</dt><dd>{request.data.environment}</dd><dt>Reporting timezone</dt><dd>{request.data.timezone}</dd><dt>Currency</dt><dd>{request.data.currency}</dd></dl></section>
      <section className="admin-panel"><p className="eyebrow">PAYMENT SAFETY</p><h2>Payment configuration</h2><dl className="admin-detail-list"><dt>Mode</dt><dd><span className="admin-status active">{request.data.payments.mode}</span></dd><dt>Supported methods</dt><dd>{request.data.payments.methods.join(', ')}</dd></dl><p className="muted">This system does not connect to real payment providers and must not collect PINs, passwords, or OTPs.</p></section>
      <section className="admin-panel"><p className="eyebrow">IMAGE HANDLING</p><h2>Menu image uploads</h2><dl className="admin-detail-list"><dt>Maximum size</dt><dd>{request.data.uploads.maximumSizeMb} MB per file</dd><dt>Supported types</dt><dd>{request.data.uploads.imageTypes.join(', ')}</dd></dl></section>
      <section className="admin-panel"><p className="eyebrow">ORDER WORKFLOW</p><h2>Available statuses</h2><div className="admin-settings-statuses">{request.data.orderStatuses.map((status) => <span className={`pill status-${status}`} key={status}>{statusText(status)}</span>)}</div><p className="muted">Workflow transitions remain enforced by the backend. Secrets and environment credentials are managed on the server, not here.</p></section>
    </div>}
  </section>;
}
