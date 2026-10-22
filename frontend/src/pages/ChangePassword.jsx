import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { FaEye, FaEyeSlash, FaLock, FaShieldAlt } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';
import BackButton from '../components/BackButton';
import mauLogo from '../assets/mau.jpg';
import { useUiText } from '../hooks/useUiText';
import { isValidPassword } from '../utils/inputValidation';

const ChangePassword = () => {
  const t = useUiText();
  const navigate = useNavigate();
  const { user, role, setAuthSession } = useAuth();
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const passwordLength = formData.newPassword.length;
  const passwordMeetsMinimum = passwordLength >= 8;
  const passwordMismatch = Boolean(formData.confirmPassword) && formData.newPassword !== formData.confirmPassword;

  const handleChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const currentPassword = formData.currentPassword;
    const newPassword = formData.newPassword;
    const confirmPassword = formData.confirmPassword;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError(t('Please fill in all fields.'));
      return;
    }

    if (!isValidPassword(newPassword)) {
      setError(t('Password must contain at least 8 characters.'));
      return;
    }

    if (newPassword === currentPassword) {
      setError(t('New password must be different from the current password.'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('Passwords do not match.'));
      return;
    }

    setIsLoading(true);

    try {
      const response = await authApi.changePassword({ currentPassword, newPassword });
      const newToken = response?.token || response?.data?.token || null;
      const updatedUser = response?.user || response?.data?.user || user || {};

      if (newToken && updatedUser) {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('token', newToken);
          window.localStorage.setItem('ipesAuthToken', newToken);
          window.localStorage.setItem('user', JSON.stringify({
            ...updatedUser,
            role: updatedUser.role || role,
            isFirstLogin: false,
          }));
          window.localStorage.setItem('userData', JSON.stringify({
            ...updatedUser,
            role: updatedUser.role || role,
            isFirstLogin: false,
          }));
        }

        setAuthSession(newToken, {
          ...updatedUser,
          role: updatedUser.role || role,
          isFirstLogin: false,
        });
      }

      toast.success(t('Password updated successfully!'));

      const normalizeRole = (value) => {
        const normalized = String(value || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
        const aliases = {
          depthead: 'dept_head',
          dept_head: 'dept_head',
          department_head: 'dept_head',
          systemadmin: 'systemadmin',
          system_admin: 'systemadmin',
          admin: 'systemadmin',
          college_dean: 'college_dean',
          dean: 'college_dean',
          academic_directorate: 'academic_directorate',
          academic_director: 'academic_directorate',
          directorate: 'academic_directorate',
          lab_assistant: 'lab_assistant',
          ara: 'lab_assistant',
          instructor: 'instructor',
          student: 'student',
        };
        return aliases[normalized] || normalized;
      };

      const normalizedRole = normalizeRole(updatedUser.role || role || '');
      const redirectTarget = ['depthead', 'dept_head', 'department_head'].includes(normalizedRole)
        ? '/dept-head-dashboard'
        : ['systemadmin', 'system_admin', 'admin'].includes(normalizedRole)
          ? '/system-admin-dashboard'
          : ['college_dean', 'dean'].includes(normalizedRole)
            ? '/dean/dashboard'
            : ['academic_directorate', 'academic_director', 'directorate'].includes(normalizedRole)
              ? '/directorate/dashboard'
              : ['lab_assistant', 'ara'].includes(normalizedRole)
                ? '/lab-assistant/dashboard'
                : normalizedRole === 'instructor'
                  ? '/instructor-dashboard'
                  : '/student-dashboard';

      navigate(redirectTarget, { replace: true });
    } catch (err) {
      const message = err?.message || t('Unable to update password.');
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-slate-50">

      <header className="relative z-10 border-b border-white/15 bg-[#38A0DC] shadow-lg">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center px-4 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <img
              src={mauLogo}
              alt={`Mekdela Amba University ${t('logo')}`}
              className="h-11 w-11 shrink-0 object-contain md:h-14 md:w-14"
            />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-bold tracking-wide text-white sm:text-base">
                {t('Instructor Performance Evaluation System')}
              </span>
              <span className="mt-0.5 block truncate text-xs text-white/80 sm:text-sm">
                Mekdela Amba University
              </span>
            </span>
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8">
          <BackButton />
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100/90 text-blue-600 shadow-inner">
              <FaShieldAlt className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">{t('Change Password')}</h1>
            <p className="mt-2 text-sm text-slate-600">{t('You must update your password before continuing.')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div style={{ padding: '12px', backgroundColor: '#fee2e2', border: '1px solid #f87171', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', fontWeight: 'bold' }}>
                ⚠️ {error}
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{t('Current Password')}</label>
              <div className="relative">
                <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={formData.currentPassword}
                  onChange={handleChange('currentPassword')}
                  placeholder={t('Enter current password')}
                  className="w-full rounded-xl border border-slate-200 bg-white/90 py-3 pl-10 pr-10 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  required
                />
                <button type="button" onClick={() => setShowCurrent((value) => !value)} aria-label={showCurrent ? t('Hide current password') : t('Show current password')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                  {showCurrent ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{t('New Password')}</label>
              <div className="relative">
                <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showNew ? 'text' : 'password'}
                  value={formData.newPassword}
                  onChange={handleChange('newPassword')}
                  placeholder={t('Enter new password')}
                  minLength={8}
                  aria-invalid={Boolean(formData.newPassword) && !isValidPassword(formData.newPassword)}
                  className={`w-full rounded-xl border bg-white/90 py-3 pl-10 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-100 ${formData.newPassword && !isValidPassword(formData.newPassword) ? 'border-red-500' : 'border-slate-200 focus:border-blue-500'}`}
                  required
                />
                <button type="button" onClick={() => setShowNew((value) => !value)} aria-label={showNew ? t('Hide new password') : t('Show new password')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                  {showNew ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
              {formData.newPassword && !isValidPassword(formData.newPassword) && <p className="mt-1 text-xs text-red-600">{t('Password must contain at least 8 characters.')}</p>}
              {formData.newPassword && (
                <div className="mt-2">
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                    <span>{t('Password length')}</span>
                    <span>{passwordMeetsMinimum ? t('Minimum length met') : `${passwordLength}/8`}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200">
                    <div
                      className={`h-2 rounded-full ${passwordMeetsMinimum ? 'bg-green-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min((passwordLength / 8) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{t('Confirm New Password')}</label>
              <div className="relative">
                <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={handleChange('confirmPassword')}
                  placeholder={t('Confirm new password')}
                  aria-invalid={passwordMismatch}
                  className="w-full rounded-xl border border-slate-200 bg-white/90 py-3 pl-10 pr-10 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  required
                />
                <button type="button" onClick={() => setShowConfirm((value) => !value)} aria-label={showConfirm ? t('Hide confirmed password') : t('Show confirmed password')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                  {showConfirm ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
              {passwordMismatch && <p className="mt-1 text-xs text-red-600">{t('Passwords do not match.')}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-[#38A0DC] py-3 font-semibold text-white shadow-lg transition hover:bg-[#2F8BBE] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? t('Updating...') : t('Update Password')}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default ChangePassword;
