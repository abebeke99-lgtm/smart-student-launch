import { useContext, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LanguageContext } from '../context/LanguageContext';
import { authApi } from '../services/api';
import {
  FaLock,
  FaUserGraduate,
  FaUserShield,
  FaChalkboardTeacher,
  FaSitemap,
  FaShieldAlt,
  FaEnvelope,
  FaKey,
  FaEye,
  FaEyeSlash,
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import SuccessModal from '../components/SuccessModal';
import mauLogo from '../assets/mau.jpg';

const Login = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [forgotPasswordStep, setForgotPasswordStep] = useState(1);
  const [developmentRecoveryCode, setDevelopmentRecoveryCode] = useState('');
  const [forgotPasswordData, setForgotPasswordData] = useState({
    email: '',
    otp: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successPayload, setSuccessPayload] = useState({ title: '', message: '', buttonText: '' });
  const [pendingRoute, setPendingRoute] = useState(null);
  const [loginError, setLoginError] = useState('');
  const { language } = useContext(LanguageContext);
  const { isAuthenticated, role, isFirstLogin, setAuthSession } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get('resetToken') || '';

  useEffect(() => {
    if (!resetToken) return;
    setForgotPasswordMode(true);
    setForgotPasswordStep(3);
  }, [resetToken]);

  const handleChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleForgotPasswordChange = (field) => (e) => {
    setForgotPasswordData((current) => ({ ...current, [field]: e.target.value }));
  };

  const handleSendRecoveryCode = async (event) => {
    event?.preventDefault();
    const email = forgotPasswordData.email.trim();
    if (!email) {
      toast.error(isAmharic ? 'እባክዎ የኢሜል አድራሻ ያስገቡ።' : 'Enter your recovery email address.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await authApi.forgotPassword(email);
      if (result?.developmentCode) {
        setDevelopmentRecoveryCode(result.developmentCode);
        setForgotPasswordData((current) => ({
          ...current,
          otp: result.developmentCode,
        }));
      } else {
        setDevelopmentRecoveryCode('');
      }
      setForgotPasswordStep(2);
      toast.success(
        result?.developmentCode
          ? `Email delivery is unavailable locally. Development recovery code: ${result.developmentCode}`
          : isAmharic
            ? 'የማረጋገጫ ኮዱ ተልኳል።'
            : 'A recovery code was sent to your email.',
      );
    } catch (error) {
      const message = error.message?.includes('No active account was found')
        ? 'Please contact the System Administrator to reset your password. The admin will reset your account with a default password.'
        : error.message || 'Unable to send password reset instructions.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyRecoveryCode = async (event) => {
    event.preventDefault();
    const { email, otp } = forgotPasswordData;
    if (!/^\d{6}$/.test(otp.trim())) {
      toast.error(isAmharic ? 'ባለ 6 አሃዝ ኮድ ያስገቡ።' : 'Enter the 6-digit recovery code.');
      return;
    }

    setIsLoading(true);
    try {
      await authApi.verifyOtp({ email, otp: otp.trim() });
      setForgotPasswordStep(3);
      toast.success(isAmharic ? 'ኮዱ ተረጋግጧል። አዲስ የይለፍ ቃል ያስገቡ።' : 'Code verified. Set a new password.');
    } catch (error) {
      toast.error(error.message || 'Unable to verify the recovery code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    const { email, otp, newPassword, confirmPassword } = forgotPasswordData;
    if (newPassword.length < 8) {
      toast.error(isAmharic ? 'የይለፍ ቃሉ ቢያንስ 8 ቁምፊዎች ይኑሩት።' : 'Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(isAmharic ? 'የይለፍ ቃሎች አይዛመዱም።' : 'Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      await authApi.resetPassword(resetToken
        ? { token: resetToken, newPassword }
        : { email, otp: otp.trim(), newPassword });
      resetForgotPasswordFlow();
      toast.success(isAmharic ? 'የይለፍ ቃልዎ ተቀይሯል።' : 'Your password has been reset.');
    } catch (error) {
      toast.error(error.message || 'Unable to reset the password.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForgotPasswordFlow = () => {
    setForgotPasswordMode(false);
    setForgotPasswordStep(1);
    setDevelopmentRecoveryCode('');
    setForgotPasswordData({ email: '', otp: '', newPassword: '', confirmPassword: '' });
    if (resetToken) {
      navigate('/login', { replace: true });
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoading(true);

    const username = String(formData.username ?? '').trim();
    const password = String(formData.password ?? '').trim();

    if (!username || !password) {
      const message = language === 'am'
        ? 'እባክዎ የተጠቃሚ ስም እና የይለፍ ቃል ያስገቡ።'
        : 'Please enter your username and password.';
      toast.error(message, { duration: Infinity, id: 'login-error' });
      setLoginError(message);
      setIsLoading(false);
      return;
    }

    try {
      const response = await authApi.login({ username, password });
      const { token, user } = response || {};

      if (!token || !user) {
        throw new Error('Authentication failed.');
      }

      const first = user.first_name || user.firstName || user.full_name || '';
      const last = user.last_name || user.lastName || '';
      const displayName = `${first} ${last}`.trim() || user.username || user.student_id || user.email || 'User';
      const isFirstLogin = Boolean(user.isFirstLogin ?? user.is_first_login ?? false);
      setAuthSession(token, {
        name: displayName,
        first_name: first || null,
        last_name: last || null,
        email: user.email || null,
        student_id: user.student_id || null,
        username: user.username || null,
        role: user.role,
        department_id: user.department_id || null,
        isFirstLogin,
      });

      const accessRoute = getDashboardRoute(user.role);

      if (isFirstLogin) {
        navigate('/change-password', { replace: true });
        return;
      }

      setSuccessPayload({
        title: language === 'am' ? 'ስኬታማ!' : 'Success!',
        message: language === 'am' ? 'ግባት ተሳክቷል።' : 'Login successful.',
        buttonText: language === 'am' ? 'ቀጥል' : 'Continue',
      });
      setPendingRoute(accessRoute);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Login error:', error);
      console.log('Full Login Error:', error, error?.response);

      const backendMsg = error?.response?.data?.message || error?.response?.data?.error;
      const normalizedBackendMsg = typeof backendMsg === 'string'
        ? backendMsg
        : backendMsg?.en || backendMsg?.am || backendMsg?.message || '';
      const statusText = error?.response?.statusText;
      const genericMsg = isAmharic ? 'የተሳሳተ መግቢያ መረጃ ነው።' : 'Incorrect username or password.';

      const finalMsg = normalizedBackendMsg || statusText || genericMsg;

      setLoginError(finalMsg);

      const isSystemUnavailable =
        error?.response?.status === 503 ||
        (error?.response?.status === 403 && /system.*(disabled|unavailable|maintenance)/i.test(finalMsg));
      if (!isSystemUnavailable) {
        toast.error(finalMsg, {
          id: 'login-error-toast',
          duration: 6000,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    if (pendingRoute) {
      navigate(pendingRoute);
    }
  };

  const normalizeRole = (value) => {
    const normalizedValue = String(value || '').trim().toLowerCase().replace(/[-\s]+/g, '_');

    if (normalizedValue === 'dept_head' || normalizedValue === 'depthead') return 'depthead';
    if (normalizedValue === 'system_admin' || normalizedValue === 'systemadmin' || normalizedValue === 'admin') return 'systemadmin';
    if (normalizedValue === 'college_dean' || normalizedValue === 'dean') return 'college_dean';
    if (normalizedValue === 'academic_directorate' || normalizedValue === 'academic_director' || normalizedValue === 'directorate') return 'academic_directorate';
    if (['vice_president', 'vice_presdant', 'vic_president'].includes(normalizedValue)) return 'vice_president';
    if (normalizedValue === 'lab_assistant' || normalizedValue === 'ara') return 'lab_assistant';
    if (normalizedValue === 'student' || normalizedValue === 'instructor') return normalizedValue;

    return 'student';
  };

  const getDashboardRoute = (value) => {
    const normalizedRole = normalizeRole(value);

    if (normalizedRole === 'instructor') return '/instructor-dashboard';
    if (normalizedRole === 'depthead') return '/dept-head-dashboard';
    if (normalizedRole === 'systemadmin') return '/system-admin-dashboard';
    if (normalizedRole === 'college_dean') return '/dean/dashboard';
    if (normalizedRole === 'academic_directorate') return '/directorate/dashboard';
    if (normalizedRole === 'vice_president') return '/vice-president/dashboard';
    if (normalizedRole === 'lab_assistant') return '/lab-assistant/dashboard';

    return '/student-dashboard';
  };

  useEffect(() => {
    if (!isAuthenticated || !role || isFirstLogin) return;

    const normalizedRole = normalizeRole(role);

    if (normalizedRole === 'student') {
      navigate('/student-dashboard');
    } else if (normalizedRole === 'instructor') {
      navigate('/instructor-dashboard');
    } else if (normalizedRole === 'depthead') {
      navigate('/dept-head-dashboard');
    } else if (normalizedRole === 'systemadmin') {
      navigate('/system-admin-dashboard');
    } else if (normalizedRole === 'college_dean') {
      navigate('/dean/dashboard');
    } else if (normalizedRole === 'academic_directorate') {
      navigate('/directorate/dashboard');
    } else if (normalizedRole === 'vice_president') {
      navigate('/vice-president/dashboard');
    } else if (normalizedRole === 'lab_assistant') {
      navigate('/lab-assistant/dashboard');
    }
  }, [isAuthenticated, isFirstLogin, navigate, role]);

  const normalizedIdentifier = String(formData.username ?? '').trim().toLowerCase();
  const resolvedRole = normalizeRole(
    normalizedIdentifier === 'instructor'
      ? 'instructor'
      : normalizedIdentifier === 'depthead' || normalizedIdentifier === 'dept_head'
      ? 'depthead'
      : normalizedIdentifier === 'systemadmin' || normalizedIdentifier === 'system-admin' || normalizedIdentifier === 'admin'
      ? 'systemadmin'
      : 'student'
  );

  const isAmharic = language === 'am';
  const loginText = isAmharic
    ? {
        welcome: ' እንኳን ወደ IPES በደህና መጡ',
        subtitle: 'የአስተማሪ አፈጻጸም ግምገማ ስርዓትን ይጠቀሙ',
        username: 'የተጠቃሚ ስም',
        usernamePlaceholder: 'የተጠቃሚ ስምዎን ያስገቡ',
        usernameHelper: 'በተጠቃሚ ስምዎ ይግቡ። አስተዳዳሪዎች ኢሜላቸውንም መጠቀም ይችላሉ።',
        password: 'የይለፍ ቃል',
        login: 'ግባ',
        loggingIn: 'በመግባት ላይ...',
        forgotPassword: 'የይለፍ ቃል ረስተዋል?',
        departmentHead: 'የዲፓርትመንት ኃላፊ መግቢያ',
        departmentHeadSubtitle: 'የምደባ እና የማዛመድ መሳሪያዎችን ይጠቀሙ',
        systemAdmin: 'የስርዓት አስተዳዳሪ መግቢያ',
        systemAdminSubtitle: 'ሙሉ የአስተዳደር ማዕከሉን ይጠቀሙ',
      }
    : {
        welcome: 'WELCOME BACK TO IPES',
        subtitle: 'Access the Instructor Performance Evaluation System',
        username: 'Username',
        usernamePlaceholder: 'Enter your username',
        usernameHelper: 'Sign in with your username. Admins may also use their email.',
        password: 'Password',
        login: 'Login',
        loggingIn: 'Logging in...',
        forgotPassword: 'Forgot your password?',
        departmentHead: 'Department Head Login',
        departmentHeadSubtitle: 'Access assignment and mapping tools',
        systemAdmin: 'System Admin Login',
        systemAdminSubtitle: 'Access the full administration console',
      };
  const roleMeta = {
    student: {
      title: loginText.welcome,
      subtitle: loginText.subtitle,
      icon: FaUserGraduate,
    },
    instructor: {
      title: loginText.welcome,
      subtitle: loginText.subtitle,
      icon: FaChalkboardTeacher,
    },
    admin: {
      title: loginText.welcome,
      subtitle: loginText.subtitle,
      icon: FaUserShield,
    },
    depthead: {
      title: loginText.departmentHead,
      subtitle: loginText.departmentHeadSubtitle,
      icon: FaSitemap,
    },
    systemadmin: {
      title: loginText.systemAdmin,
      subtitle: loginText.systemAdminSubtitle,
      icon: FaShieldAlt,
    },
  };

  const roleMetaEntry = roleMeta[resolvedRole] || roleMeta.student;
  const ActiveIcon = roleMetaEntry.icon;
  const identifierLabel = loginText.username;
  const identifierPlaceholder = loginText.usernamePlaceholder;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-xl md:p-10">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-ieps-blue-100 shadow-inner shadow-ieps-blue-200/40">
              <img src={mauLogo} alt="Mekdela Amba University logo" className="h-14 w-14" />
            </div>

            {forgotPasswordMode ? (
              <>
                <button type="button" onClick={resetForgotPasswordFlow} className="mb-4 text-sm font-medium text-ieps-blue-600 hover:underline">
                  {isAmharic ? 'ወደ ግባ ተመለስ' : 'Back to login'}
                </button>
                <FaKey className="mx-auto mb-3 h-8 w-8 text-ieps-blue-500" />
                <h2 className="text-2xl font-bold text-ieps-blue-600">{isAmharic ? 'የይለፍ ቃል ረሱ?' : 'Forgot Password?'}</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {forgotPasswordStep === 1
                    ? (isAmharic ? 'የመልሶ ማግኛ ኮድ ወደ ኢሜልዎ እንልካለን።' : 'We will send a recovery code to your email.')
                    : forgotPasswordStep === 2
                        ? (isAmharic ? 'ወደ ኢሜልዎ የተላከውን ባለ 6 አሃዝ ኮድ ያስገቡ።' : 'Enter the 6-digit code sent to your email.')
                      : (isAmharic ? 'አዲስ የይለፍ ቃል ይፍጠሩ።' : 'Create a new password.')}
                </p>
              </>
            ) : (
              <>
                {ActiveIcon && <ActiveIcon className="mx-auto mb-3 h-8 w-8 text-ieps-blue-500" />}
                <h2 className="text-2xl font-bold text-ieps-blue-600">{roleMetaEntry.title}</h2>
                <p className="mt-1 text-sm text-gray-500">{roleMetaEntry.subtitle}</p>
              </>
            )}
          </div>

          {!forgotPasswordMode ? (
            <>
              <SuccessModal
                open={showSuccessModal}
                title={successPayload.title}
                message={successPayload.message}
                buttonText={successPayload.buttonText}
                onClose={handleSuccessModalClose}
              />
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">{identifierLabel}</label>
                  <div className="relative">
                    <FaEnvelope className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleChange('username')}
                      placeholder={identifierPlaceholder}
                      autoComplete="username"
                      className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ieps-blue-500"
                      required
                    />
                  </div>
                  {loginError === 'Incorrect username' && <p className="mt-1 text-sm font-medium text-red-600">Incorrect username</p>}
                  <p className="mt-1 text-xs text-gray-500">{loginText.usernameHelper}</p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">{loginText.password}</label>
                  <div className="relative">
                    <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange('password')}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-12 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ieps-blue-500"
                      required
                    />
                    <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-ieps-blue-600" aria-label={showPassword ? (isAmharic ? 'የይለፍ ቃሉን ደብቅ' : 'Hide password') : (isAmharic ? 'የይለፍ ቃሉን አሳይ' : 'Show password')}>
                      {showPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                  {loginError === 'Incorrect password' && <p className="mt-1 text-sm font-medium text-red-600">Incorrect password</p>}
                </div>

                {loginError && loginError !== 'Incorrect username' && loginError !== 'Incorrect password' && (
                  <div style={{ padding: '12px', backgroundColor: '#fee2e2', border: '1px solid #f87171', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', fontWeight: 'bold' }}>
                    ⚠️ {loginError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full items-center justify-center rounded-xl bg-ieps-blue-600 py-3 font-semibold text-white shadow-lg transition-all duration-300 hover:bg-ieps-blue-500 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isLoading ? loginText.loggingIn : loginText.login}
                </button>
                <div className="text-center">
                  <button type="button" onClick={() => setForgotPasswordMode(true)} className="text-sm font-medium text-ieps-blue-600 hover:underline">
                    {loginText.forgotPassword}
                  </button>
                </div>
              </form>
            </>
          ) : forgotPasswordStep === 1 ? (
            <form onSubmit={handleSendRecoveryCode} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{isAmharic ? 'የኢሜል አድራሻ' : 'Recovery email'}</label>
                <input
                  type="email"
                  value={forgotPasswordData.email}
                  onChange={handleForgotPasswordChange('email')}
                  autoComplete="email"
                  placeholder="name@example.com"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ieps-blue-500"
                  required
                />
              </div>
              <button type="submit" disabled={isLoading} className="w-full rounded-xl bg-ieps-blue-700 py-3 font-semibold text-white transition hover:bg-ieps-blue-800 disabled:opacity-70">
                {isLoading ? (isAmharic ? 'ኮድ በመላክ ላይ...' : 'Sending code...') : (isAmharic ? 'ኮድ ላክ' : 'Send recovery code')}
              </button>
            </form>
          ) : forgotPasswordStep === 2 ? (
            <form onSubmit={handleVerifyRecoveryCode} className="space-y-4">
              <p className={`rounded-lg p-3 text-sm ${developmentRecoveryCode ? 'bg-amber-50 text-amber-800' : 'bg-gray-50 text-gray-600'}`}>
                {developmentRecoveryCode
                  ? <>Development recovery code: <strong>{developmentRecoveryCode}</strong></>
                  : <>{isAmharic ? 'ኮድ የተላከው ወደ' : 'Code sent to'} <strong>{forgotPasswordData.email}</strong></>}
              </p>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{isAmharic ? 'ባለ 6 አሃዝ ኮድ' : '6-digit code'}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={forgotPasswordData.otp}
                  onChange={handleForgotPasswordChange('otp')}
                  autoComplete="one-time-code"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-ieps-blue-500"
                  required
                />
              </div>
              <button type="submit" disabled={isLoading} className="w-full rounded-xl bg-ieps-blue-700 py-3 font-semibold text-white transition hover:bg-ieps-blue-800 disabled:opacity-70">
                {isLoading ? (isAmharic ? 'ኮዱን በማረጋገጥ ላይ...' : 'Verifying code...') : (isAmharic ? 'ኮዱን አረጋግጥ' : 'Verify code')}
              </button>
              <button type="button" onClick={handleSendRecoveryCode} disabled={isLoading} className="w-full text-sm font-medium text-ieps-blue-600 hover:underline disabled:opacity-70">
                {isAmharic ? 'ኮዱን እንደገና ላክ' : 'Resend code'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                {isAmharic ? 'አዲስ የይለፍ ቃል ያስገቡ።' : 'Choose a new password for your account.'}
              </p>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{isAmharic ? 'አዲስ የይለፍ ቃል' : 'New password'}</label>
                <input
                  type="password"
                  value={forgotPasswordData.newPassword}
                  onChange={handleForgotPasswordChange('newPassword')}
                  autoComplete="new-password"
                  minLength={8}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ieps-blue-500"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{isAmharic ? 'አዲሱን የይለፍ ቃል ያረጋግጡ' : 'Confirm new password'}</label>
                <input
                  type="password"
                  value={forgotPasswordData.confirmPassword}
                  onChange={handleForgotPasswordChange('confirmPassword')}
                  autoComplete="new-password"
                  minLength={8}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ieps-blue-500"
                  required
                />
              </div>
              <button type="submit" disabled={isLoading} className="w-full rounded-xl bg-ieps-blue-700 py-3 font-semibold text-white transition hover:bg-ieps-blue-800 disabled:opacity-70">
                {isLoading ? (isAmharic ? 'በማዘመን ላይ...' : 'Resetting...') : (isAmharic ? 'የይለፍ ቃል ቀይር' : 'Reset password')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
export default Login; 
