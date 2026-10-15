import { useContext, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  FaChalkboardTeacher, FaHome, FaInfoCircle, FaEnvelope, 
  FaSignInAlt, FaUserCircle, FaSignOutAlt, FaBars, FaTimes,
  FaUserGraduate, FaUserShield, FaChevronDown, FaSitemap 
} from 'react-icons/fa';
import LanguageSwitcher from './LanguageSwitcher';
import { LanguageContext } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import mauLogo from '../assets/mau.jpg';
import toast from 'react-hot-toast';

const Navbar = () => {
  const { strings } = useContext(LanguageContext);
  const { user, role, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isDashboardPath = ['/student-dashboard', '/instructor-dashboard', '/depthead-dashboard', '/admin-dashboard', '/system-admin-dashboard'].includes(location.pathname);
  const hidePublicNav = isDashboardPath || role === 'depthead';

  const toggleMenu = () => setIsOpen(!isOpen);
  const toggleDropdown = () => setDropdownOpen(!dropdownOpen);

  const handleLogout = async () => {
    await logout();
    setDropdownOpen(false);
    setIsOpen(false);
    toast.success('Logged out successfully');
  };

  const navLinks = hidePublicNav ? [] : [
    { path: '/', label: strings.navbar.home, icon: FaHome },
    { path: '/about', label: strings.navbar.about, icon: FaInfoCircle },
    { path: '/contact', label: strings.navbar.contact, icon: FaEnvelope },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-[#38A0DC] shadow-lg">
      <div className="w-full px-2 sm:px-3">
        <div className="flex items-center justify-between h-16 md:h-20">

          {/* Logo */}
          <Link to="/" className="flex min-w-0 items-center gap-2 md:gap-3 group">
            <img src={mauLogo} alt="Mekdela Amba University logo" className="h-11 w-11 md:h-14 md:w-14 shrink-0 object-contain" />
            <div className="min-w-0 leading-tight">
              <span className="block truncate text-white font-bold text-sm sm:text-base md:text-lg tracking-wide">{strings.common.appName}</span>
              <span className="mt-0.5 block truncate text-white text-[11px] sm:text-xs md:text-sm">{strings.common.universityName}</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {!hidePublicNav && navLinks.map(({ path, label, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-lg text-white hover:text-white hover:bg-white/10 transition-all duration-200 ${isActive ? 'bg-white/20 text-white' : ''}`
                }
              >
                <Icon className="text-sm" />
                <span>{label}</span>
              </NavLink>
            ))}

            <LanguageSwitcher />

            <div className="w-px h-8 bg-white/20 mx-2"></div>

            {isAuthenticated ? (
              <>
                <div className="relative">
                  <button
                    onClick={toggleDropdown}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-white hover:text-white hover:bg-white/10 transition-all duration-200"
                  >
                    <FaUserCircle className="text-xl" />
                    <span className="font-medium">{user?.name || strings.common.user}</span>
                    <FaChevronDown className={`text-xs transition-transform duration-300 ${dropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {dropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl py-2 border border-gray-100 animate-fadeIn">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <p className="font-semibold text-gray-800">{user?.name || strings.common.user}</p>
                        <p className="text-xs text-gray-500 capitalize">{role}</p>
                      </div>
                      
                      {role === 'student' && (
                        <Link to="/student-dashboard" className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors">
                          <FaUserGraduate /> {strings.common.dashboard}
                        </Link>
                      )}
                      {role === 'instructor' && (
                        <Link to="/instructor-dashboard" className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors">
                          <FaChalkboardTeacher /> {strings.common.instructorPanel}
                        </Link>
                      )}
                      {(role === 'admin' || role === 'systemadmin') && (
                        <Link to="/system-admin-dashboard" className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors">
                          <FaUserShield /> {strings.common.adminPanel}
                        </Link>
                      )}
                      {role === 'depthead' && (
                        <Link to="/depthead-dashboard" className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors">
                          <FaSitemap /> {strings.common.deptHeadPanel}
                        </Link>
                      )}
                      
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 transition-colors w-full border-t border-gray-100 mt-1"
                      >
                        <FaSignOutAlt /> {strings.common.logout}
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Link
                to="/login"
                className="flex items-center justify-center gap-2 px-6 py-2 bg-ieps-gold-500 text-ieps-blue-600 rounded-full font-semibold hover:bg-ieps-gold-400 transition-all duration-300 shadow-md hover:shadow-lg"
              >
                <FaSignInAlt className="shrink-0" />
                <span className="text-center">{strings.navbar.login}</span>
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={toggleMenu}
            type="button"
            aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isOpen}
            className="ml-auto inline-flex shrink-0 items-center justify-center rounded-lg p-2 text-2xl text-white transition-colors hover:bg-white/10 md:hidden"
          >
            {isOpen ? <FaTimes /> : <FaBars />}
          </button>
        </div>

        {/* Mobile Navigation */}
        <div className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="py-4 border-t border-white/10 space-y-1">
            {!hidePublicNav && navLinks.map(({ path, label, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg text-white hover:text-white hover:bg-white/10 transition-all ${isActive ? 'bg-white/20 text-white' : ''}`
                }
              >
                <Icon />
                <span>{label}</span>
              </NavLink>
            ))}

            {isAuthenticated ? (
              <>
                <div className="px-4 py-2 text-white text-sm border-t border-white/10 mt-2">
                  {strings.navbar.loggedInAs} <span className="text-white font-medium">{user?.name || strings.common.user}</span>
                </div>
                {role === 'student' && (
                  <Link to="/student-dashboard" onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-4 py-3 text-white hover:text-white hover:bg-white/10 rounded-lg">
                    <FaUserGraduate /> Dashboard
                  </Link>
                )}
                {role === 'instructor' && (
                  <Link to="/instructor-dashboard" onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-4 py-3 text-white hover:text-white hover:bg-white/10 rounded-lg">
                    <FaChalkboardTeacher /> Instructor Panel
                  </Link>
                )}
                {(role === 'admin' || role === 'systemadmin') && (
                  <Link to="/system-admin-dashboard" onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-4 py-3 text-white hover:text-white hover:bg-white/10 rounded-lg">
                    <FaUserShield /> Admin Panel
                  </Link>
                )}
                {role === 'depthead' && (
                  <Link to="/depthead-dashboard" onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-4 py-3 text-white hover:text-white hover:bg-white/10 rounded-lg">
                    <FaSitemap /> Dept. Head Panel
                  </Link>
                )}
                <button
                  onClick={() => { handleLogout(); setIsOpen(false); }}
                  className="flex items-center gap-3 px-4 py-3 text-red-300 hover:text-red-200 hover:bg-red-500/20 rounded-lg w-full"
                >
                  <FaSignOutAlt /> Logout
                </button>
              </>
            ) : (
              <Link
                to="/login"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center gap-3 px-4 py-3 bg-ieps-gold-500 text-ieps-blue-600 rounded-lg font-semibold hover:bg-ieps-gold-400 transition-colors mt-2"
              >
                <FaSignInAlt className="shrink-0" /> <span className="text-center">{strings.navbar.login}</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;