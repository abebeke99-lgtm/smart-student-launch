import { useContext, useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, LayoutDashboard, KeyRound, LogOut, Menu, Settings, Trash2, UserRound, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LanguageContext } from '../context/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';
import { notificationApi } from '../services/api';
import { resolveApiAssetUrl } from '../../config';
import mauLogo from '../assets/mau.jpg';
import toast from 'react-hot-toast';
import useUiText from '../hooks/useUiText';

const dashboardRoutes = {
  systemadmin: '/admin/dashboard',
  admin: '/admin/dashboard',
  depthead: '/dept-head/dashboard',
  dept_head: '/dept-head/dashboard',
  college_dean: '/dean/dashboard',
  dean: '/dean/dashboard',
  academic_directorate: '/directorate/dashboard',
  academic_director: '/directorate/dashboard',
  directorate: '/directorate/dashboard',
  instructor: '/instructor-dashboard',
  lab_assistant: '/lab-assistant/dashboard',
  student: '/student-dashboard',
};

const roleLabels = {
  systemadmin: 'systemAdmin', admin: 'systemAdmin', depthead: 'departmentHead', dept_head: 'departmentHead',
  college_dean: 'collegeDean', dean: 'collegeDean', academic_directorate: 'academicDirectorate',
  academic_director: 'academicDirectorate', directorate: 'academicDirectorate', instructor: 'instructor',
  lab_assistant: 'labAssistant', student: 'student',
};

const getAvatarFallback = (name) => {
  const initials = String(name || 'U')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || 'U';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="#dbeafe"/><text x="48" y="57" text-anchor="middle" font-family="Arial,sans-serif" font-size="32" font-weight="700" fill="#1e3a8a">${initials}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const Header = ({ onMenuToggle, sidebarOpen = false }) => {
  const { user, role, logout } = useAuth();
  const { strings } = useContext(LanguageContext);
  const t = useUiText();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState('all');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedNotificationIds, setSelectedNotificationIds] = useState([]);
  const [notificationAction, setNotificationAction] = useState('');
  const menuRef = useRef(null);
  const notificationsRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const longPressTriggeredRef = useRef(false);
  const longPressOriginRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    const loadNotifications = async () => {
      try {
        const response = await notificationApi.getAll('all');
        const nextNotifications = Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
            ? response.data
            : [];
        if (mounted) setNotifications(nextNotifications);
      } catch (error) {
        console.warn('Unable to load notifications:', error);
      }
    };
    void loadNotifications();
    const timer = window.setInterval(() => { void loadNotifications(); }, 30000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  let storedUser = {};
  if (typeof window !== 'undefined') {
    try {
      storedUser = JSON.parse(window.localStorage.getItem('user') || '{}');
    } catch {
      storedUser = {};
    }
  }

  useEffect(() => {
    const closeMenu = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setIsOpen(false);
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) setNotificationsOpen(false);
    };
    document.addEventListener('mousedown', closeMenu);
    return () => document.removeEventListener('mousedown', closeMenu);
  }, []);

  useEffect(() => () => {
    window.clearTimeout(longPressTimerRef.current);
  }, []);

  useEffect(() => {
    if (!notificationsOpen) return undefined;
    let mounted = true;
    notificationApi.getAll('all')
      .then((response) => {
        const nextNotifications = Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
            ? response.data
            : [];
        if (mounted) setNotifications(nextNotifications);
      })
      .catch((error) => console.warn('Unable to refresh notifications:', error));
    return () => { mounted = false; };
  }, [notificationsOpen]);

  useEffect(() => {
    if (!notificationsOpen) {
      setSelectionMode(false);
      setSelectedNotificationIds([]);
      window.clearTimeout(longPressTimerRef.current);
      longPressOriginRef.current = null;
      longPressTriggeredRef.current = false;
    }
  }, [notificationsOpen]);

  const normalizedRole = String(user?.role || role || storedUser?.role || '').trim().toLowerCase();
  const currentUser = { ...storedUser, ...user };
  const dashboardPath = dashboardRoutes[normalizedRole] || '/login';
  const displayName = currentUser.name || currentUser.full_name || currentUser.fullName || currentUser.username || currentUser.email || t('User');
  const profileLabel = currentUser.username || displayName;
  const profileInitials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || 'U';
  const email = currentUser.email || currentUser.username || 'user@university.edu';
  const profilePicture = resolveApiAssetUrl(currentUser.profile_picture);
  const avatarFallback = getAvatarFallback(displayName);
  const roleLabelKey = roleLabels[normalizedRole];
  const roleLabel = strings.common.roleTitles[roleLabelKey] || strings.common.roleTitles.user;

  const handleLogout = async () => {
    setIsOpen(false);
    if (typeof window !== 'undefined') window.localStorage.clear();
    await logout();
  };

  const navigateAndClose = (path) => {
    setIsOpen(false);
    navigate(path);
  };

  const markNotificationRead = async (notification) => {
    if (Number(notification.is_read)) return;
    try {
      await notificationApi.markRead(notification.id);
      setNotifications((current) => current.map((item) => (
        item.id === notification.id ? { ...item, is_read: 1 } : item
      )));
    } catch (error) {
      toast.error(error.message || t('Unable to mark notification as read.'));
    }
  };
  const deleteNotification = async (notification) => {
    setNotificationAction(`item:${notification.id}`);
    try {
      await notificationApi.deleteOne(notification.id);
      setNotifications((current) => current.filter((item) => item.id !== notification.id));
      setSelectedNotificationIds((current) => current.filter((id) => id !== String(notification.id)));
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || t('Unable to delete notification.'));
    } finally {
      setNotificationAction('');
    }
  };
  const clearAllNotifications = async () => {
    if (!notifications.length) return;
    setNotificationAction('all');
    try {
      await notificationApi.clearAll();
      setNotifications([]);
      setSelectedNotificationIds([]);
      toast.success(strings.common.allNotificationsCleared);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || t('Unable to clear notifications.'));
    } finally {
      setNotificationAction('');
    }
  };
  const deleteSelectedNotifications = async () => {
    if (!selectedNotificationIds.length) return;
    const selectedIds = selectedNotificationIds.map(Number);
    setNotificationAction('selected');
    try {
      await notificationApi.deleteMany(selectedIds);
      const selectedIdSet = new Set(selectedNotificationIds);
      setNotifications((current) => current.filter((item) => !selectedIdSet.has(String(item.id))));
      setSelectedNotificationIds([]);
      toast.success(strings.common.selectedNotificationsCleared);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || t('Unable to delete selected notifications.'));
    } finally {
      setNotificationAction('');
    }
  };
  const toggleNotificationSelection = (id) => {
    const notificationId = String(id);
    setSelectedNotificationIds((current) => (
      current.includes(notificationId)
        ? current.filter((selectedId) => selectedId !== notificationId)
        : [...current, notificationId]
    ));
  };
  const selectNotification = (id) => {
    const notificationId = String(id);
    setSelectionMode(true);
    setSelectedNotificationIds((current) => (
      current.includes(notificationId) ? current : [...current, notificationId]
    ));
  };
  const exitNotificationSelection = () => {
    setSelectionMode(false);
    setSelectedNotificationIds([]);
    cancelNotificationLongPress();
  };
  const cancelNotificationLongPress = () => {
    window.clearTimeout(longPressTimerRef.current);
    longPressOriginRef.current = null;
  };
  const startNotificationLongPress = (event, notificationId) => {
    if (event.button !== 0) return;
    cancelNotificationLongPress();
    longPressTriggeredRef.current = false;
    longPressOriginRef.current = { x: event.clientX, y: event.clientY };
    longPressTimerRef.current = window.setTimeout(() => {
      selectNotification(notificationId);
      longPressTriggeredRef.current = true;
      longPressOriginRef.current = null;
    }, 550);
  };
  const trackNotificationLongPress = (event) => {
    const origin = longPressOriginRef.current;
    if (!origin) return;
    if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 12) {
      cancelNotificationLongPress();
    }
  };
  const handleNotificationClick = (notification) => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    if (selectionMode) {
      toggleNotificationSelection(notification.id);
      return;
    }
    void markNotificationRead(notification);
  };
  const handleNotificationContextMenu = (event, notificationId) => {
    event.preventDefault();
    cancelNotificationLongPress();
    longPressTriggeredRef.current = true;
    selectNotification(notificationId);
  };
  const unreadNotificationCount = notifications.filter((item) => !Number(item.is_read)).length;
  const visibleNotifications = notifications.filter((item) => (
    notificationFilter === 'all' ||
    (notificationFilter === 'read' && Number(item.is_read)) ||
    (notificationFilter === 'unread' && !Number(item.is_read))
  ));

  return (
    <header className="fixed inset-x-0 top-0 z-[70] h-16 w-full bg-[#38A0DC] text-white shadow-none">
      <div className="flex h-full w-full items-center justify-between gap-4 px-4 lg:px-8">
        <Link to={dashboardPath} className="flex min-w-0 items-center gap-3" aria-label={strings.common.dashboard}>
          <img src={mauLogo} alt={t('Mekdela Amba University logo')} className="h-10 w-10 shrink-0 object-contain" />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-bold sm:text-base">{strings.common.appName}</span>
            <span className="block truncate text-[11px] text-white sm:text-xs">{strings.common.universityName}</span>
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <LanguageSwitcher />
          <div ref={notificationsRef} className="relative">
            <button
              type="button"
              onClick={() => setNotificationsOpen((open) => !open)}
              aria-expanded={notificationsOpen}
              aria-label={`${strings.common.openNotifications}${unreadNotificationCount ? ` (${unreadNotificationCount})` : ''}`}
              className="relative rounded-lg p-2 hover:bg-white/10"
            >
              <Bell className="h-5 w-5" />
              {unreadNotificationCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
                  {unreadNotificationCount}
                </span>
              )}
            </button>
            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-2xl">
                <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold">{strings.common.notifications}</p>
                    <p className="mt-1 text-xs text-slate-500">{unreadNotificationCount} {strings.common.unread}</p>
                  </div>
                  {selectionMode && (
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => void deleteSelectedNotifications()}
                        disabled={!selectedNotificationIds.length || Boolean(notificationAction)}
                        className="rounded-md px-2 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {notificationAction === 'selected' ? strings.common.clearingNotifications : `${strings.common.clearSelectedNotifications} (${selectedNotificationIds.length})`}
                      </button>
                      <button
                        type="button"
                        onClick={() => void clearAllNotifications()}
                        disabled={!notifications.length || Boolean(notificationAction)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {notificationAction === 'all' ? strings.common.clearingNotifications : strings.common.clearAllNotifications}
                      </button>
                      <button
                        type="button"
                        onClick={exitNotificationSelection}
                        disabled={Boolean(notificationAction)}
                        className="rounded-md px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {strings.common.cancel}
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex gap-1 border-b border-slate-100 px-2 py-2" role="tablist" aria-label={strings.common.notifications}>
                  {['all', 'read', 'unread'].map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      role="tab"
                      aria-selected={notificationFilter === filter}
                      onClick={() => {
                        setNotificationFilter(filter);
                        exitNotificationSelection();
                      }}
                      className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold capitalize ${notificationFilter === filter ? 'bg-blue-100 text-blue-800' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      {strings.common[filter]}
                    </button>
                  ))}
                </div>
                <div className="max-h-80 overflow-y-auto p-2">
                  {visibleNotifications.length ? visibleNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`mb-2 flex items-start gap-2 rounded-lg p-3 text-sm transition last:mb-0 ${selectedNotificationIds.includes(String(notification.id)) ? 'bg-blue-50 ring-1 ring-blue-300' : Number(notification.is_read) ? 'bg-white' : 'bg-slate-50'}`}
                    >
                      {selectionMode && (
                        <input
                          type="checkbox"
                          checked={selectedNotificationIds.includes(String(notification.id))}
                          onChange={() => toggleNotificationSelection(notification.id)}
                          aria-label={`${t('Select')} ${notification.title}`}
                          className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                        />
                      )}
                      <button
                        type="button"
                        onPointerDown={(event) => startNotificationLongPress(event, notification.id)}
                        onPointerMove={trackNotificationLongPress}
                        onPointerUp={cancelNotificationLongPress}
                        onPointerCancel={cancelNotificationLongPress}
                        onPointerLeave={cancelNotificationLongPress}
                        onContextMenu={(event) => handleNotificationContextMenu(event, notification.id)}
                        onClick={() => handleNotificationClick(notification)}
                        className="flex min-w-0 flex-1 select-none items-start gap-2 text-left hover:text-blue-900"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2 font-semibold">
                            <span className="truncate">{notification.title}</span>
                            <span className={`shrink-0 text-[10px] uppercase ${Number(notification.is_read) ? 'text-slate-400' : 'text-blue-700'}`}>
                              {Number(notification.is_read) ? strings.common.read : strings.common.unread}
                            </span>
                          </span>
                          <span className="mt-1 block text-slate-600">{notification.message}</span>
                        </span>
                      </button>
                      {selectionMode && (
                        <button
                          type="button"
                          onClick={() => void deleteNotification(notification)}
                          disabled={Boolean(notificationAction)}
                          aria-label={`${t('Delete')} ${notification.title}`}
                          title={t('Delete notification')}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-100 hover:text-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  )) : <p className="p-2 text-sm text-slate-500">{strings.common.noNotificationsForFilter}</p>}
                </div>
              </div>
            )}
          </div>
          <div ref={menuRef} className="relative">
            <button type="button" onClick={() => setIsOpen((open) => !open)} aria-expanded={isOpen} aria-label={`${strings.common.user}: ${profileLabel}`} className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
              {profilePicture
                ? <img src={profilePicture} alt="" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = avatarFallback; }} className="h-7 w-7 rounded-full border border-white/40 object-cover" />
                : <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full border border-white/40 bg-white/15 text-xs font-bold">{profileInitials}</span>}
              <span className="hidden max-w-36 truncate text-sm font-semibold sm:block">{profileLabel}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
              <div className="absolute right-0 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-2xl">
                <div className="border-b border-slate-100 px-4 py-4">
                  <p className="font-semibold">{displayName}</p>
                  <p className="mt-1 truncate text-sm text-slate-500">{email}</p>
                  <span className="mt-3 inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{roleLabel}</span>
                </div>
                <nav className="p-2" aria-label={strings.common.user}>
                  <button type="button" onClick={() => navigateAndClose(dashboardPath)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-900"><LayoutDashboard className="h-4 w-4" /> {strings.common.myDashboard}</button>
                  <button type="button" onClick={() => navigateAndClose('/profile')} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-900"><UserRound className="h-4 w-4" /> {strings.common.viewProfile}</button>
                  <button type="button" onClick={() => navigateAndClose('/change-password')} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-900"><KeyRound className="h-4 w-4" /> {strings.common.changePassword}</button>
                  <button type="button" onClick={() => navigateAndClose('/settings')} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-900"><Settings className="h-4 w-4" /> {strings.common.dashboardSettings}</button>
                  <button type="button" onClick={handleLogout} className="mt-1 flex w-full items-center gap-3 border-t border-slate-100 px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"><LogOut className="h-4 w-4" /> {strings.common.signOut}</button>
                </nav>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onMenuToggle}
            aria-expanded={sidebarOpen}
            aria-label={sidebarOpen ? strings.common.closeSidebar : strings.common.openSidebar}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 lg:hidden"
          >
            {sidebarOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
