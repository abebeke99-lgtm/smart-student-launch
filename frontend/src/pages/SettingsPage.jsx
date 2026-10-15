import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import BackButton from '../components/BackButton';
import { LanguageContext } from '../context/LanguageContext';
import { ThemeContext } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { resolveApiAssetUrl } from '../../config';
import { userApi } from '../services/api';

const notificationOptions = [
  {
    key: 'evaluationDeadlines',
    titleKey: 'evaluationDeadlines',
    descriptionKey: 'evaluationDeadlinesDescription',
  },
  {
    key: 'systemAnnouncements',
    titleKey: 'systemAnnouncements',
    descriptionKey: 'systemAnnouncementsDescription',
  },
  {
    key: 'securityAlerts',
    titleKey: 'securityAlerts',
    descriptionKey: 'securityAlertsDescription',
  },
];

const defaultPreferences = {
  evaluationDeadlines: true,
  systemAnnouncements: true,
  securityAlerts: true,
};

const readStoredUser = () => {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

const SettingsPage = () => {
  const { strings } = useContext(LanguageContext);
  const { isDark, toggleTheme } = useContext(ThemeContext);
  const { user, setAuthSession } = useAuth();
  const common = strings.common;
  const t = strings.settings;
  const [profile, setProfile] = useState(() => ({ ...readStoredUser(), ...user }));
  const isAdmin = ['admin', 'systemadmin'].includes(String(profile.role || '').trim().toLowerCase());
  const [fullName, setFullName] = useState(profile.full_name || profile.name || '');
  const [phone, setPhone] = useState(profile.phone_number || profile.phone || '');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(profile.profile_picture || '');
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [preferencesError, setPreferencesError] = useState('');
  const [savingPreference, setSavingPreference] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [revokingSession, setRevokingSession] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadSettings = async () => {
      const results = await Promise.allSettled([
        userApi.getProfile(),
        userApi.getNotificationPreferences(),
        userApi.getSessions(),
      ]);
      if (cancelled) return;

      const [profileResult, preferencesResult, sessionsResult] = results;
      if (profileResult.status === 'fulfilled' && profileResult.value?.user) {
        const nextProfile = { ...readStoredUser(), ...profileResult.value.user };
        setProfile(nextProfile);
        setFullName(nextProfile.full_name || nextProfile.name || '');
        setPhone(nextProfile.phone_number || nextProfile.phone || '');
        setPhotoPreview(nextProfile.profile_picture || '');
      } else if (profileResult.status === 'rejected') {
        console.error('Unable to load account profile:', profileResult.reason);
        toast.error(profileResult.reason?.message || t.profileLoadError);
      }
      setProfileLoading(false);

      if (preferencesResult.status === 'fulfilled') {
        setPreferences({ ...defaultPreferences, ...preferencesResult.value });
      } else {
        console.error('Unable to load notification preferences:', preferencesResult.reason);
        setPreferencesError(preferencesResult.reason?.message || t.preferenceLoadError);
      }
      setPreferencesLoading(false);

      if (sessionsResult.status === 'fulfilled') {
        setSessions(Array.isArray(sessionsResult.value) ? sessionsResult.value : []);
      } else {
        console.error('Unable to load active sessions:', sessionsResult.reason);
        setSessionError(sessionsResult.reason?.message || t.sessionsLoadError);
      }
      setSessionsLoading(false);
    };
    void loadSettings();
    return () => { cancelled = true; };
  }, [t]);

  useEffect(() => {
    if (!photoFile) return undefined;
    const previewUrl = URL.createObjectURL(photoFile);
    setPhotoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [photoFile]);

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0] || null;
    if (file && !file.type.startsWith('image/')) {
      toast.error(t.invalidImage);
      event.target.value = '';
      return;
    }
    if (file && file.size > 5 * 1024 * 1024) {
      toast.error(t.imageTooLarge);
      event.target.value = '';
      return;
    }
    setPhotoFile(file);
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    const formData = new FormData();
    const nameChanged = isAdmin && fullName.trim() !== String(profile.full_name || profile.name || '').trim();
    if (nameChanged) {
      formData.append('full_name', fullName.trim());
    }
    if (phone.trim() !== String(profile.phone_number || profile.phone || '').trim()) {
      formData.append('phone', phone.trim());
    }
    if (photoFile) formData.append('photo', photoFile);
    if (![...formData.keys()].length) {
      toast.error(t.makeProfileChange);
      return;
    }
    if (nameChanged && (fullName.trim().length < 3 || fullName.trim().split(/\s+/).length < 2)) {
      toast.error(t.enterFullName);
      return;
    }

    setProfileSaving(true);
    try {
      const response = await userApi.updateProfile(formData);
      const updatedProfile = {
        ...profile,
        ...(response?.user || {}),
        full_name: response?.user?.full_name || fullName.trim(),
        name: response?.user?.full_name || fullName.trim(),
        phone: response?.user?.phone ?? phone.trim(),
        phone_number: response?.user?.phone_number ?? phone.trim(),
      };
      if (response?.token) setAuthSession(response.token, updatedProfile);
      window.localStorage.setItem('user', JSON.stringify(updatedProfile));
      window.localStorage.setItem('userData', JSON.stringify(updatedProfile));
      setProfile(updatedProfile);
      setFullName(updatedProfile.full_name);
      setPhone(updatedProfile.phone_number);
      setPhotoPreview(updatedProfile.profile_picture || '');
      setPhotoFile(null);
      toast.success(t.profileSaved);
      const sessionResponse = await userApi.getSessions();
      setSessions(Array.isArray(sessionResponse) ? sessionResponse : []);
    } catch (error) {
      console.error('Profile update failed:', error);
      toast.error(error.message || t.profileSaveError);
    } finally {
      setProfileSaving(false);
    }
  };

  const updatePreference = async (key, checked) => {
    const previousPreferences = preferences;
    const nextPreferences = { ...preferences, [key]: checked };
    setPreferences(nextPreferences);
    setSavingPreference(true);
    try {
      const savedPreferences = await userApi.updateNotificationPreferences({ [key]: checked });
      setPreferences({ ...defaultPreferences, ...savedPreferences });
      setPreferencesError('');
      toast.success(t.preferenceSaved);
    } catch (error) {
      console.error('Notification preference update failed:', error);
      setPreferences(previousPreferences);
      toast.error(error.message || t.preferenceSaveError);
    } finally {
      setSavingPreference(false);
    }
  };

  const refreshPreferences = async () => {
    setPreferencesLoading(true);
    setPreferencesError('');
    try {
      const response = await userApi.getNotificationPreferences();
      setPreferences({ ...defaultPreferences, ...response });
    } catch (error) {
      console.error('Notification preference refresh failed:', error);
      setPreferencesError(error.message || t.preferenceLoadError);
    } finally {
      setPreferencesLoading(false);
    }
  };

  const refreshSessions = async () => {
    setSessionsLoading(true);
    setSessionError('');
    try {
      const response = await userApi.getSessions();
      setSessions(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error('Active session refresh failed:', error);
      setSessionError(error.message || t.sessionsLoadError);
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId) => {
    setRevokingSession(sessionId);
    try {
      await userApi.revokeSession(sessionId);
      setSessions((currentSessions) => currentSessions.filter((session) => session.id !== sessionId));
      toast.success(t.sessionSignedOut);
    } catch (error) {
      console.error('Session sign-out failed:', error);
      toast.error(error.message || 'Unable to sign out the selected session.');
    } finally {
      setRevokingSession('');
    }
  };

  const email = profile.email || profile.username || 'Not available';
  const department = profile.department_name || profile.departmentName || profile.department || 'Not assigned';
  const college = profile.college_name || profile.collegeName || profile.college || 'Not assigned';
  const avatarUrl = resolveApiAssetUrl(photoPreview);
  const currentSessionTracked = sessions.some((session) => session.isCurrent);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-24 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <BackButton />
        <header className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">{common.dashboardSettings}</p>
          <h1 id="settings-title" className="mt-2 text-3xl font-bold">{common.dashboardSettings}</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">{common.settingsDescription}</p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8" aria-labelledby="personal-information-title">
          <div className="border-b border-slate-200 pb-4 dark:border-slate-700">
            <h2 id="personal-information-title" className="text-xl font-semibold">{t.personalInformation}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t.personalInformationDescription}</p>
          </div>
          <form onSubmit={saveProfile}>
            <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt={`${fullName || 'Account'} profile`} className="h-20 w-20 rounded-full border border-slate-200 object-cover" />
              ) : (
                <div aria-hidden="true" className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-2xl font-semibold text-blue-800">
                  {(fullName || profile.username || 'U').trim().charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <label className="inline-flex cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
                  {t.uploadPicture}
                  <input type="file" accept="image/*" className="sr-only" onChange={handlePhotoChange} aria-label="Upload profile picture" />
                </label>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t.imageLimit}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {t.fullName}
                <input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required={isAdmin} maxLength={255} readOnly={!isAdmin} disabled={profileLoading} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 read-only:cursor-not-allowed read-only:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:disabled:bg-slate-700 dark:read-only:bg-slate-700" />
                {!isAdmin && <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">Only an administrator can change account names or login details.</span>}
              </label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {t.institutionalEmail}
                <input type="text" value={email} readOnly className="mt-2 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300" />
                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{t.emailManaged}</span>
              </label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {t.phoneNumber}
                <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" maxLength={64} disabled={profileLoading} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:disabled:bg-slate-700" />
              </label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {t.department}
                <input value={department} readOnly className="mt-2 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300" />
              </label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">
                {t.college}
                <input value={college} readOnly className="mt-2 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300" />
                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{t.affiliationManaged}</span>
              </label>
            </div>
            <button type="submit" disabled={profileSaving || profileLoading} className="mt-6 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
              {profileSaving ? t.saving : t.savePersonalInformation}
            </button>
          </form>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8" aria-labelledby="preferences-title">
          <div className="border-b border-slate-200 pb-4 dark:border-slate-700">
            <h2 id="preferences-title" className="text-xl font-semibold">{t.preferences}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t.emailPreferenceDescription}</p>
          </div>
          {preferencesError && (
            <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              <span>{preferencesError}</span>
              <button type="button" onClick={() => void refreshPreferences()} disabled={preferencesLoading} className="font-semibold underline disabled:opacity-60">{t.retry}</button>
            </div>
          )}
          <div className="mt-5 divide-y divide-slate-200 dark:divide-slate-700">
            {notificationOptions.map(({ key, titleKey, descriptionKey }) => (
              <label key={key} className="flex cursor-pointer items-center justify-between gap-6 py-4">
                <span>
                  <span className="block font-medium">{t[titleKey]}</span>
                  <span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">{t[descriptionKey]}</span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={preferences[key]}
                  disabled={preferencesLoading || savingPreference || Boolean(preferencesError)}
                  onChange={(event) => void updatePreference(key, event.target.checked)}
                  aria-label={t.emailNotificationsFor.replace('{topic}', t[titleKey].toLowerCase())}
                  className="h-5 w-5 shrink-0 accent-blue-600"
                />
              </label>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8" aria-labelledby="appearance-title">
          <h2 id="appearance-title" className="text-xl font-semibold">{common.appearance}</h2>
          <label className="mt-4 flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
            <span>
              <span className="block font-medium">{strings.systemAdminDashboard.darkMode}</span>
              <span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">{common.darkModeDescription}</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={isDark}
              onChange={toggleTheme}
              aria-label={strings.systemAdminDashboard.darkMode}
              className="h-5 w-5 shrink-0 accent-blue-600"
            />
          </label>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8" aria-labelledby="security-title">
          <div className="border-b border-slate-200 pb-4 dark:border-slate-700">
            <h2 id="security-title" className="text-xl font-semibold">{common.accountSecurity}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t.accountSecurityDescription}</p>
          </div>
          <Link to="/change-password" className="mt-5 inline-flex rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
            {common.changePassword}
          </Link>

          <div className="mt-7 border-t border-slate-200 pt-6 dark:border-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">{t.activeSessions}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t.sessionsDescription}</p>
              </div>
              <button type="button" onClick={() => void refreshSessions()} disabled={sessionsLoading} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:hover:bg-slate-800">
                {sessionsLoading ? t.refreshing : t.refresh}
              </button>
            </div>
            {sessionError ? (
              <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{sessionError}</p>
            ) : sessionsLoading ? (
              <p className="mt-4 text-sm text-slate-500">{t.loadingSessions}</p>
            ) : sessions.length ? (
              <ul className="mt-4 space-y-3">
                {sessions.map((session) => (
                  <li key={session.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{session.isCurrent ? t.thisDevice : t.signedInDevice}</p>
                          {session.isCurrent && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">{t.current}</span>}
                        </div>
                        <p className="mt-2 break-all text-sm text-slate-600 dark:text-slate-300">{t.ipAddress}: {session.ip_address || t.unavailable}</p>
                        <p className="mt-1 break-all text-sm text-slate-600 dark:text-slate-300">{t.deviceId}: {session.device_id || t.unavailable}</p>
                        <p className="mt-1 break-words text-sm text-slate-600 dark:text-slate-300">{t.browserDevice}: {session.user_agent || t.unavailable}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t.lastActive}: {new Date(session.last_seen_at).toLocaleString()}</p>
                      </div>
                      {!session.isCurrent && (
                        <button type="button" onClick={() => void handleRevokeSession(session.id)} disabled={revokingSession === session.id} className="shrink-0 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950">
                          {revokingSession === session.id ? t.signingOut : t.signOut}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                {t.noTrackedSessions}
              </p>
            )}
            {!sessionsLoading && sessions.length > 0 && !currentSessionTracked && (
              <p className="mt-3 text-sm text-amber-800 dark:text-amber-300">{t.legacySession}</p>
            )}
          </div>

          <div className="mt-6 border-t border-slate-200 pt-6 dark:border-slate-700">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold">{t.twoFactor}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t.twoFactorUnavailableDescription}</p>
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{t.unavailable}</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default SettingsPage;
