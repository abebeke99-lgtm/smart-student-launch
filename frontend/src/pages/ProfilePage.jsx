import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import BackButton from '../components/BackButton';
import { resolveApiAssetUrl } from '../../config';
import { userApi } from '../services/api';
import { Camera, Mail, MapPin, Phone, Save, ShieldCheck, UserRound } from 'lucide-react';

const roleLabels = {
  admin: 'System Administrator',
  systemadmin: 'System Administrator',
  dept_head: 'Department Head',
  depthead: 'Department Head',
  college_dean: 'College Dean',
  dean: 'College Dean',
  academic_directorate: 'Academic Directorate',
  academic_director: 'Academic Directorate',
  directorate: 'Academic Directorate',
  instructor: 'Instructor',
  student: 'Student',
};

const COUNTRY_CODES = [
  { code: 'ET', label: 'Ethiopia', dialCode: '+251', maxLength: 9 },
  { code: 'US', label: 'United States', dialCode: '+1', maxLength: 10 },
  { code: 'GB', label: 'United Kingdom', dialCode: '+44', maxLength: 10 },
  { code: 'KE', label: 'Kenya', dialCode: '+254', maxLength: 9 },
  { code: 'UG', label: 'Uganda', dialCode: '+256', maxLength: 9 },
  { code: 'TZ', label: 'Tanzania', dialCode: '+255', maxLength: 9 },
  { code: 'NG', label: 'Nigeria', dialCode: '+234', maxLength: 10 },
  { code: 'SD', label: 'Sudan', dialCode: '+249', maxLength: 9 },
  { code: 'FR', label: 'France', dialCode: '+33', maxLength: 9 },
  { code: 'DE', label: 'Germany', dialCode: '+49', maxLength: 11 },
  { code: 'SA', label: 'Saudi Arabia', dialCode: '+966', maxLength: 9 },
  { code: 'AE', label: 'United Arab Emirates', dialCode: '+971', maxLength: 9 },
  { code: 'IN', label: 'India', dialCode: '+91', maxLength: 10 },
];

const getCountryCodeFromPhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  const match = COUNTRY_CODES.find((country) => digits.startsWith(country.dialCode.replace('+', '')));
  return match?.code || 'ET';
};

const toPhoneInputValue = (value, countryCode = 'ET') => {
  let digits = String(value || '').replace(/\D/g, '');
  const selectedCountry = COUNTRY_CODES.find((country) => country.code === countryCode) || COUNTRY_CODES[0];
  const countryPrefix = selectedCountry.dialCode.replace('+', '');

  if (digits.startsWith(countryPrefix)) digits = digits.slice(countryPrefix.length);
  if (digits.startsWith('251') && selectedCountry.code === 'ET') digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits;
};

const getAvatarFallback = (name) => {
  const initials = String(name || 'U')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || 'U';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192"><rect width="192" height="192" rx="96" fill="#dbeafe"/><text x="96" y="112" text-anchor="middle" font-family="Arial,sans-serif" font-size="64" font-weight="700" fill="#1e3a8a">${initials}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const ProfilePage = () => {
  const { user, role, setAuthSession } = useAuth();
  const storedUser = useMemo(() => {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(window.localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }, []);
  const profile = { ...storedUser, ...user };
  const normalizedRole = String(profile.role || role || '').trim().toLowerCase();
  const isAdmin = ['admin', 'systemadmin', 'super_admin'].includes(normalizedRole);
  const profileName = profile.full_name || [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.name || profile.fullName || profile.username || 'User';
  const [fullName, setFullName] = useState(profileName);
  const [username, setUsername] = useState(profile.username || '');
  const [emailAddress, setEmailAddress] = useState(profile.email || '');
  const [savedEmailAddress, setSavedEmailAddress] = useState(profile.email || '');
  const department = profile.department_name || profile.departmentName || profile.department || 'Not assigned';
  const [selectedCountryCode, setSelectedCountryCode] = useState(getCountryCodeFromPhone(profile.phone || profile.phone_number || ''));
  const [phone, setPhone] = useState(toPhoneInputValue(profile.phone || profile.phone_number, getCountryCodeFromPhone(profile.phone || profile.phone_number || '')));
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(profile.profile_picture || '');
  const [saving, setSaving] = useState(false);
  const selectedCountry = COUNTRY_CODES.find((country) => country.code === selectedCountryCode) || COUNTRY_CODES[0];

  useEffect(() => {
    const nextCountryCode = getCountryCodeFromPhone(profile.phone || profile.phone_number || '');
    setFullName(profileName);
    setUsername(profile.username || '');
    setEmailAddress(profile.email || '');
    setSavedEmailAddress(profile.email || '');
    setSelectedCountryCode(nextCountryCode);
    setPhone(toPhoneInputValue(profile.phone || profile.phone_number, nextCountryCode));
    setPhotoPreview(profile.profile_picture || '');
  }, [isAdmin, profile.email, profile.username, profileName, profile.phone, profile.phone_number, profile.profile_picture]);

  useEffect(() => {
    let cancelled = false;
    const loadProfile = async () => {
      try {
        const response = await userApi.getProfile();
        const profileUser = response?.user;
        if (!cancelled && profileUser) {
          setUsername(profileUser.username || '');
          setEmailAddress(profileUser.email || '');
          setSavedEmailAddress(profileUser.email || '');
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Unable to load profile details:', error);
          toast.error(error.response?.data?.message || 'Unable to load your profile details.');
        }
      }
    };
    void loadProfile();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!photoFile) return undefined;
    const previewUrl = URL.createObjectURL(photoFile);
    setPhotoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [photoFile]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData();
    if (fullName.trim() !== profileName.trim()) {
      formData.append('full_name', fullName.trim());
    }
    const normalizedUsername = username.trim();
    const normalizedEmail = emailAddress.trim().toLowerCase();
    if (isAdmin && normalizedEmail !== savedEmailAddress.trim().toLowerCase()) {
      formData.append('email', normalizedEmail);
    }
    const currentPhone = toPhoneInputValue(profile.phone || profile.phone_number, selectedCountryCode);
    if (phone.trim() !== currentPhone) {
      if (phone.trim() && (!/^\d+$/.test(phone.trim()) || phone.trim().length > selectedCountry.maxLength)) {
        toast.error('Enter a valid phone number for the selected country.');
        return;
      }
      formData.append('phone', phone.trim() ? `${selectedCountry.dialCode}${phone.trim()}` : '');
    }
    if (photoFile) formData.append('photo', photoFile);
    if (![...formData.keys()].length) {
      toast.error('Make a profile change before saving.');
      return;
    }

    setSaving(true);
    try {
      const response = await userApi.updateProfile(formData);
      const responseUser = response?.user || {};
      const updatedUser = {
        ...profile,
        ...responseUser,
        name: responseUser.full_name || fullName.trim(),
        full_name: responseUser.full_name || fullName.trim(),
        email: responseUser.email ?? (isAdmin ? normalizedEmail : profile.email),
        username: responseUser.username || normalizedUsername || profile.username,
        phone: responseUser.phone ?? (phone.trim() ? `${selectedCountry.dialCode}${phone.trim()}` : ''),
        phone_number: responseUser.phone_number ?? (phone.trim() ? `${selectedCountry.dialCode}${phone.trim()}` : ''),
        profile_picture: responseUser.profile_picture || photoPreview,
      };
      if (response?.token) setAuthSession(response.token, updatedUser);
      window.localStorage.setItem('user', JSON.stringify(updatedUser));
      window.localStorage.setItem('userData', JSON.stringify(updatedUser));
      const nextCountryCode = getCountryCodeFromPhone(updatedUser.phone_number || updatedUser.phone || '');
      setFullName(updatedUser.full_name);
      setEmailAddress(updatedUser.email || '');
      setSavedEmailAddress(updatedUser.email || '');
      setUsername(updatedUser.username || '');
      setSelectedCountryCode(nextCountryCode);
      setPhone(toPhoneInputValue(updatedUser.phone_number || updatedUser.phone, nextCountryCode));
      setPhotoPreview(updatedUser.profile_picture);
      setPhotoFile(null);
      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('Profile update failed:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      toast.error(error.response?.data?.message || 'Unable to update your profile.');
    } finally {
      setSaving(false);
    }
  };

  const avatarSource = resolveApiAssetUrl(photoPreview || profile.avatar) || getAvatarFallback(fullName);
  const handleAvatarError = (event) => {
    event.currentTarget.onerror = null;
    event.currentTarget.src = getAvatarFallback(fullName);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 px-4 py-24 text-slate-900 sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-blue-200/40 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-indigo-200/40 blur-3xl" />
      <div className="relative mx-auto max-w-5xl">
        <div className="mb-5">
          <BackButton />
        </div>
        <form onSubmit={handleSubmit} className="overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-2xl shadow-slate-900/10" aria-labelledby="profile-title">
          <header className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-blue-950 to-blue-800 px-6 py-9 text-white sm:px-10 sm:py-11">
            <div aria-hidden="true" className="absolute -right-16 -top-32 h-80 w-80 rounded-full border-[36px] border-white/5" />
            <div aria-hidden="true" className="absolute -bottom-40 right-32 h-72 w-72 rounded-full bg-blue-400/10 blur-2xl" />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">
                  <ShieldCheck size={15} aria-hidden="true" />
                  Account settings
                </div>
                <h1 id="profile-title" className="text-3xl font-bold tracking-tight sm:text-4xl">Profile</h1>
                <p className="mt-2 max-w-lg text-sm leading-6 text-blue-100 sm:text-base">Manage your personal details and keep your account information up to date.</p>
              </div>
              <div className="flex items-center gap-4 rounded-2xl border border-white/15 bg-white/10 p-3 pr-5 backdrop-blur-sm">
                <img src={avatarSource} alt={`${fullName} profile`} onError={handleAvatarError} className="h-16 w-16 rounded-xl border-2 border-white/30 object-cover shadow-lg" />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{fullName || 'Your profile'}</p>
                  <p className="mt-1 text-sm text-blue-100">{roleLabels[normalizedRole] || normalizedRole || 'User'}</p>
                </div>
              </div>
            </div>
          </header>

          <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[240px_minmax(0,1fr)]">
            <aside className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
                <div className="relative mx-auto w-fit">
                  <img src={avatarSource} alt="" onError={handleAvatarError} className="h-32 w-32 rounded-full border-4 border-white object-cover shadow-lg ring-1 ring-slate-200" />
                  <label className="absolute bottom-1 right-1 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-4 border-white bg-blue-700 text-white shadow-md transition hover:bg-blue-800 focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2" title="Change profile photo">
                    <Camera size={17} aria-hidden="true" />
                    <input type="file" accept="image/*" className="sr-only" onChange={(event) => setPhotoFile(event.target.files?.[0] || null)} />
                    <span className="sr-only">Change Profile Photo</span>
                  </label>
                </div>
                <div className="mt-4 text-center">
                  <p className="font-semibold text-slate-900">{fullName || 'Your profile'}</p>
                  <p className="mt-1 text-sm text-slate-500">{roleLabels[normalizedRole] || normalizedRole || 'User'}</p>
                </div>
                <p className="mt-4 border-t border-slate-200 pt-4 text-center text-xs leading-5 text-slate-500">Choose a clear, recent photo to help others recognize your account.</p>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/80 p-4 text-sm leading-5 text-blue-900">
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-blue-700" aria-hidden="true" />
                <p>Your role and department are managed by your administrator and cannot be changed here.</p>
              </div>
            </aside>

            <section aria-label="Profile information">
              <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                  <UserRound size={20} aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-semibold text-slate-900">Personal information</h2>
                  <p className="mt-0.5 text-sm text-slate-500">Update your contact and account details.</p>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Full Name
                  <input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required maxLength={255} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" />
                </label>

                {isAdmin ? (
                  <label className="block text-sm font-semibold text-slate-700">
                    <span className="inline-flex items-center gap-2"><Mail size={15} className="text-blue-700" aria-hidden="true" />Email Address (Login &amp; Recovery)</span>
                    <input type="email" value={emailAddress} onChange={(event) => setEmailAddress(event.target.value)} autoComplete="email" required maxLength={254} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" />
                    <span className="mt-1.5 block text-xs font-normal leading-5 text-slate-500">Used to sign in and receive password recovery codes.</span>
                  </label>
                ) : (
                  <label className="block text-sm font-semibold text-slate-700">
                    Username
                    <input value={username} readOnly autoComplete="username" className="mt-2 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 font-normal text-slate-500 shadow-inner" />
                  </label>
                )}

                <label className="block text-sm font-semibold text-slate-700">
                  <span className="inline-flex items-center gap-2"><ShieldCheck size={15} className="text-slate-400" aria-hidden="true" />Role / Title</span>
                  <input value={roleLabels[normalizedRole] || normalizedRole || 'User'} disabled className="mt-2 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 font-normal text-slate-500" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  <span className="inline-flex items-center gap-2"><MapPin size={15} className="text-slate-400" aria-hidden="true" />Department</span>
                  <input value={department} disabled className="mt-2 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 font-normal text-slate-500" />
                </label>

                <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">
                  <span className="inline-flex items-center gap-2"><Phone size={15} className="text-blue-700" aria-hidden="true" />Phone Number</span>
                  <div className="mt-2 flex w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10">
                    <select
                      value={selectedCountryCode}
                      onChange={(event) => {
                        const nextCountryCode = event.target.value;
                        setSelectedCountryCode(nextCountryCode);
                        setPhone('');
                      }}
                      className="max-w-[52%] border-r border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 outline-none sm:max-w-none"
                      aria-label="Select country calling code"
                    >
                      {COUNTRY_CODES.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.dialCode} {country.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={selectedCountry.maxLength}
                      value={phone}
                      onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, selectedCountry.maxLength))}
                      className="min-w-0 flex-1 bg-white px-4 py-3 font-normal text-slate-900 outline-none"
                      placeholder={selectedCountry.code === 'ET' ? '9XXXXXXXX' : 'XXXXXXXXXX'}
                      aria-label={`${selectedCountry.label} phone number`}
                    />
                  </div>
                  <span className="mt-1.5 block text-xs font-normal text-slate-500">Enter the local number after the selected country code.</span>
                </label>
              </div>

              <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">Your profile changes are saved securely to your account.</p>
                <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/15 transition hover:-translate-y-0.5 hover:bg-blue-800 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-500/25 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none">
                  <Save size={17} aria-hidden="true" />
                  {saving ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </div>
            </section>
          </div>
        </form>
      </div>
    </main>
  );
};

export default ProfilePage;