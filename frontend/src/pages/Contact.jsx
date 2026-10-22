import { useContext, useState, useEffect } from 'react';
import { FaEnvelope, FaPhone, FaMapMarkerAlt, FaClock, FaPaperPlane, FaUser, FaFileAlt, FaCommentDots, FaGraduationCap, FaMountain, FaDirections } from 'react-icons/fa';
import toast from 'react-hot-toast';
import MapEmbed from '../components/MapEmbed';
import { LanguageContext } from '../context/LanguageContext';
import { API_URL } from '../../config';
import campusPhoto from '../assets/campus.jpg';
import { useUiText } from '../hooks/useUiText';
import { isValidEmail, stripHtmlTags } from '../utils/inputValidation';

const Contact = () => {
  const { language, strings } = useContext(LanguageContext);
  const t = useUiText();
  const copy = strings.contactPage;
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [adminContact, setAdminContact] = useState({
    name: '',
    email: '',
    phone: '',
    location: 'Gimba, Ethiopia',
    poBox: 'P.O. Box 32',
    officeDays: 'Mon-Fri',
    officeHours: '9:00 AM - 5:00 PM',
    institution: 'Mekdela Amba University (Main Campus - Tulu Awulia / Gimba)',
    region: 'Amhara Region, South Wollo, Ethiopia',
    landmark: 'Near Gimba Masjid Al-Noor',
    mapQuery: 'Mekdela Amba University, Tulu Awulia, Gimba, Ethiopia',
  });

  useEffect(() => {
    const applyAdminContact = (settings) => {
      if (settings && typeof settings === 'object') setAdminContact((current) => ({ ...current, ...settings }));
    };
    const handleContactInfoUpdated = (event) => applyAdminContact(event.detail);
    window.addEventListener('ipes-contact-info-updated', handleContactInfoUpdated);

    const loadAdminContact = async () => {
      try {
        const response = await fetch(`${API_URL}/contact/admin-info`);
        if (!response.ok) return;
        const data = await response.json();
        if (data?.success && data?.data) {
          applyAdminContact(data.data);
        }
      } catch (error) {
        console.error('Unable to load admin contact info:', error);
      }
    };

    loadAdminContact();
    return () => window.removeEventListener('ipes-contact-info-updated', handleContactInfoUpdated);
  }, []);

  // Validate email format
  // Validate form data
  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = copy.validationName;
    }

    if (!formData.email.trim()) {
      newErrors.email = copy.validationEmail;
    } else if (!isValidEmail(formData.email.trim())) {
      newErrors.email = copy.validationEmailFormat;
    }

    if (!formData.message.trim()) {
      newErrors.message = copy.validationMessage;
    } else if (formData.message.trim().length < 10) {
      newErrors.message = copy.validationMessageLength;
    }

    if (formData.subject.trim().length > 200) {
      newErrors.subject = copy.validationSubject;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({
      ...current,
      [name]: name === 'email' && value.trim() && !isValidEmail(value)
        ? t('Enter a valid email address.')
        : '',
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error(copy.validationForm);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: stripHtmlTags(formData.name),
          email: formData.email.trim(),
          subject: stripHtmlTags(formData.subject),
          message: stripHtmlTags(formData.message),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message?.[language] || data.message?.en || copy.failedSend);
      }

      setSubmitted(true);
      const responseMessage = data?.message?.[language] || data?.message?.en || copy.sent;
      if (data?.data?.emailSent === false) {
        toast.success(responseMessage, { duration: 8000 });
      } else {
        toast.success(responseMessage);
      }

      setTimeout(() => {
        setFormData({ name: '', email: '', subject: '', message: '' });
        setSubmitted(false);
      }, 3000);
    } catch (error) {
      console.error('Error submitting contact form:', error);
      toast.error(error.message || copy.failedSend);
    } finally {
      setLoading(false);
    }
  };

  const contactCards = [
    {
      label: copy.adminName,
      value: adminContact.name || t('Admin'),
      detail: adminContact.institution?.split(' (')[0],
      icon: FaUser,
      theme: 'border-purple-100 bg-purple-50/80 text-purple-700',
      iconTheme: 'bg-purple-600 text-white',
    },
    {
      label: copy.email,
      value: adminContact.email || '—',
      href: adminContact.email ? `mailto:${adminContact.email}` : undefined,
      icon: FaEnvelope,
      theme: 'border-blue-100 bg-blue-50/80 text-blue-700',
      iconTheme: 'bg-blue-600 text-white',
    },
    {
      label: copy.phone,
      value: adminContact.phone || '—',
      href: adminContact.phone ? `tel:${adminContact.phone.replace(/\s+/g, '')}` : undefined,
      icon: FaPhone,
      theme: 'border-emerald-100 bg-emerald-50/80 text-emerald-700',
      iconTheme: 'bg-emerald-600 text-white',
    },
    {
      label: copy.location,
      value: adminContact.location,
      detail: adminContact.poBox,
      icon: FaMapMarkerAlt,
      theme: 'border-pink-100 bg-pink-50/80 text-pink-700',
      iconTheme: 'bg-pink-600 text-white',
    },
    {
      label: copy.officeHours,
      value: adminContact.officeDays === 'Mon-Fri' ? t('Mon-Fri') : adminContact.officeDays,
      detail: adminContact.officeHours === '9:00 AM - 5:00 PM' ? t('9:00 AM - 5:00 PM') : adminContact.officeHours,
      icon: FaClock,
      theme: 'border-amber-100 bg-amber-50/80 text-amber-700',
      iconTheme: 'bg-amber-500 text-white',
    },
  ];

  const formFields = [
    { name: 'name', label: copy.yourName, placeholder: copy.namePlaceholder, icon: FaUser, required: true, type: 'text' },
    { name: 'email', label: copy.emailAddress, placeholder: copy.emailPlaceholder, icon: FaEnvelope, required: true, type: 'email' },
    { name: 'subject', label: copy.subject, placeholder: copy.subjectPlaceholder, icon: FaFileAlt, required: false, type: 'text' },
  ];
  const locationQuery =
    adminContact.mapQuery || 'Mekdela Amba University, Tulu Awulia, Gimba, Ethiopia';

  return (
    <div className="min-h-screen bg-[#f5f9ff]">
      <section className="relative isolate overflow-hidden border-b border-blue-100 bg-gradient-to-r from-[#e8f3ff] via-[#f3f8ff] to-[#e7f1ff]">
        <div className="pointer-events-none absolute -right-16 -top-28 h-80 w-80 rounded-full bg-blue-200/40 blur-3xl" />
        <div className="container-custom relative flex min-h-[250px] items-center justify-between gap-8 py-10 md:min-h-[260px] md:py-12">
          <div className="max-w-2xl">
            <span className="inline-flex rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-[11px] font-bold tracking-[0.14em] text-[#2B6CB0]">
              {t('GET IN TOUCH')}
            </span>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-[#16345f] sm:text-5xl">{copy.title}</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">{copy.intro}</p>
          </div>

          <div className="relative hidden h-44 w-64 shrink-0 items-center justify-center sm:flex md:h-52 md:w-80" aria-hidden="true">
            <div className="absolute bottom-2 left-8 h-24 w-48 rounded-[45%] bg-blue-200/60 blur-sm" />
            <div className="absolute bottom-0 left-0 h-16 w-20 rounded-t-full bg-emerald-300/80 [clip-path:polygon(0_100%,10%_20%,40%_0,55%_100%)]" />
            <div className="absolute bottom-0 right-2 h-20 w-24 rounded-t-full bg-emerald-400/75 [clip-path:polygon(0_100%,32%_10%,65%_0,100%_100%)]" />
            <div className="relative z-10 mt-7 flex h-28 w-44 items-center justify-center rounded-2xl border border-blue-100 bg-white shadow-[0_18px_40px_rgba(37,99,235,0.18)] md:h-32 md:w-52">
              <div className="absolute inset-x-0 bottom-0 h-16 rounded-b-2xl bg-gradient-to-br from-blue-600 to-blue-500 [clip-path:polygon(0_100%,50%_15%,100%_100%)]" />
              <div className="absolute inset-x-5 top-4 space-y-2 rounded-lg border border-blue-100 bg-blue-50 p-3 shadow-sm">
                <div className="h-1.5 w-2/3 rounded-full bg-blue-300" />
                <div className="h-1.5 w-full rounded-full bg-slate-200" />
                <div className="h-1.5 w-4/5 rounded-full bg-slate-200" />
              </div>
              <FaPaperPlane className="absolute -right-10 -top-6 rotate-[-20deg] text-4xl text-[#2B6CB0] drop-shadow-md md:-right-12 md:-top-8 md:text-5xl" />
              <span className="absolute -right-2 top-4 h-12 w-12 rounded-full border border-dashed border-blue-300" />
              <span className="absolute -left-4 top-7 h-2 w-2 rounded-full bg-amber-400" />
              <span className="absolute -left-8 top-12 h-1 w-7 rotate-[25deg] rounded-full bg-blue-400" />
            </div>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 -z-0 h-6 bg-gradient-to-r from-blue-200/50 via-white/30 to-blue-200/50 [clip-path:polygon(0_0,100%_0,100%_100%,0_100%)]" />
      </section>

      <div className="container-custom py-8 sm:py-10">
        <div className="grid items-start gap-6 lg:grid-cols-[0.9fr_1.35fr] lg:gap-7">
          <div className="space-y-3.5">
            {contactCards.map(({ label, value, detail, href, icon: Icon, theme, iconTheme }) => (
              <div key={label} className={`flex min-h-[76px] items-center gap-3.5 rounded-2xl border px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${theme}`}>
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm ${iconTheme}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.13em] opacity-75">{label}</p>
                  {href ? <a href={href} className="mt-0.5 block break-words text-sm font-bold text-slate-800 hover:underline">{value}</a> : <p className="mt-0.5 break-words text-sm font-bold text-slate-800">{value}</p>}
                  {detail ? <p className="mt-0.5 text-xs text-slate-500">{detail}</p> : null}
                </div>
                <span className="text-lg text-slate-400" aria-hidden="true">›</span>
              </div>
            ))}

            <div className="group relative mt-4 h-40 overflow-hidden rounded-2xl border border-white bg-white shadow-md">
              <img src={campusPhoto} alt={`Mekdela Amba University ${t('campus')}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/10 to-transparent" />
              <div className="absolute bottom-3 left-4 right-4 text-white">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-100">{copy.institution}</p>
                <p className="mt-1 text-sm font-bold">{adminContact.institution?.split(' (')[0] || 'Mekdela Amba University'}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.07)] sm:p-7">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2B6CB0] text-white shadow-md shadow-blue-900/15">
                <FaPaperPlane className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-xl font-bold text-[#16345f] sm:text-2xl">{copy.sendMessage}</h2>
                <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{t('Fill out the form below and we’ll get back to you as soon as possible.')}</p>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {formFields.map(({ name, label, placeholder, icon: Icon, required, type }) => (
                <div key={name}>
                  <label htmlFor={`contact-${name}`} className="mb-1 block text-xs font-semibold text-slate-700">{label}</label>
                  <div className={`flex items-center rounded-xl border bg-white transition focus-within:ring-2 ${errors[name] ? 'border-red-400 focus-within:border-red-500 focus-within:ring-red-500/15' : 'border-slate-200 focus-within:border-blue-400 focus-within:ring-blue-500/10'}`}>
                    <span className="pl-3.5 text-[#2B6CB0]"><Icon className="h-3.5 w-3.5" /></span>
                    <input
                      id={`contact-${name}`}
                      type={type}
                      name={name}
                      value={formData[name]}
                      onChange={handleChange}
                      placeholder={placeholder}
                      required={required}
                      aria-invalid={Boolean(errors[name])}
                      aria-describedby={errors[name] ? `contact-${name}-error` : undefined}
                      className="min-w-0 flex-1 rounded-xl bg-transparent px-3 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                    />
                  </div>
                  {errors[name] && <p id={`contact-${name}-error`} className="mt-1 text-xs text-red-600">{errors[name]}</p>}
                </div>
              ))}

              <div>
                <label htmlFor="contact-message" className="mb-1 block text-xs font-semibold text-slate-700">{copy.message}</label>
                <div className={`flex items-start rounded-xl border bg-white transition focus-within:ring-2 ${errors.message ? 'border-red-400 focus-within:border-red-500 focus-within:ring-red-500/15' : 'border-slate-200 focus-within:border-blue-400 focus-within:ring-blue-500/10'}`}>
                  <span className="pt-3.5 pl-3.5 text-[#2B6CB0]"><FaCommentDots className="h-3.5 w-3.5" /></span>
                  <textarea
                    id="contact-message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder={copy.messagePlaceholder}
                    rows="4"
                    required
                    aria-invalid={Boolean(errors.message)}
                    aria-describedby={errors.message ? 'contact-message-error' : undefined}
                    className="min-w-0 flex-1 resize-y rounded-xl bg-transparent px-3 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                  />
                </div>
                <div className="mt-1 flex min-h-4 items-center justify-between gap-3">
                  {errors.message ? <p id="contact-message-error" className="text-xs text-red-600">{errors.message}</p> : <span />}
                  <p className="text-[10px] text-slate-400">{formData.message.length} {copy.characters}</p>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2B6CB0] py-3 text-sm font-semibold text-white shadow-md shadow-blue-900/15 transition hover:bg-[#1e5c9c] disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <FaPaperPlane className="h-3.5 w-3.5" />}
                {loading ? copy.sending : copy.send}
              </button>

              {submitted && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                  <p className="font-medium text-green-700">✓ {copy.sent}</p>
                  <p className="text-sm text-green-600">{copy.thanks}</p>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Map Section */}
        <section className="mt-16 overflow-hidden rounded-[28px] border border-blue-100 bg-gradient-to-br from-[#f0f7ff] via-[#f8fbff] to-[#e7f3ff] p-5 shadow-[0_18px_48px_rgba(56,160,220,0.12)] sm:p-7 lg:p-8" aria-labelledby="our-location-title">
          <div className="mb-6 flex min-h-24 items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#38A0DC]/10 text-[#1679bd]">
                <FaMapMarkerAlt className="h-6 w-6" aria-hidden="true" />
              </span>
              <div className="border-l-2 border-[#38A0DC] pl-4">
                <h2 id="our-location-title" className="text-3xl font-extrabold tracking-tight text-[#16345f] sm:text-4xl">{copy.ourLocation}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600 sm:text-base">{copy.locationSubtitle}</p>
              </div>
            </div>

            <div className="relative hidden h-24 w-56 shrink-0 items-end justify-center sm:flex" aria-hidden="true">
              <div className="absolute bottom-0 h-8 w-52 rounded-full bg-blue-200/60 blur-md" />
              <svg viewBox="0 0 220 100" className="relative z-10 h-full w-full text-[#38A0DC]" fill="none">
                <path d="M15 88h190M34 88V48l17-13 17 13v40M68 88V31h107v57M175 48l17-13 17 13v40" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
                <path d="M91 31V17h61v14M111 17V8h21v9M117 88V62h20v26" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
                <path d="M79 44h14v13H79zm29 0h14v13h-14zm29 0h14v13h-14zM47 58h12v12H47zm139 0h12v12h-12z" fill="currentColor" opacity=".25" stroke="currentColor" strokeWidth="2" />
                <path d="M122 8h9l-4.5 5z" fill="#f5b942" />
              </svg>
              <FaMapMarkerAlt className="absolute right-1 top-1 h-7 w-7 text-[#1679bd]" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
              {[
                { label: copy.institution, value: adminContact.institution, icon: FaGraduationCap, prominent: true },
                { label: copy.region, value: adminContact.region, icon: FaMapMarkerAlt },
                { label: copy.landmark, value: adminContact.landmark, icon: FaMountain },
              ].map(({ label, value, icon: Icon, prominent }) => (
              <div key={label} className="flex items-center gap-4 rounded-2xl border border-blue-50 bg-white px-4 py-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#38A0DC]/10 text-[#1679bd]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#4784ad]">{label}</p>
                    <p className={`mt-1 leading-snug text-[#16345f] ${prominent ? 'text-base font-bold sm:text-lg' : 'text-sm font-medium sm:text-base'}`}>{value}</p>
                  </div>
                </div>
              ))}

              <div className="mt-auto flex flex-col gap-4 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(locationQuery)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center justify-center gap-3 rounded-full bg-[#38A0DC] px-6 py-3.5 text-sm font-bold text-white shadow-md shadow-blue-500/20 transition hover:bg-[#2B87BD] focus:outline-none focus:ring-2 focus:ring-[#38A0DC] focus:ring-offset-2"
                >
                  <FaMapMarkerAlt className="h-4 w-4" aria-hidden="true" />
                  {copy.openMaps}
                  <FaDirections className="h-4 w-4" aria-hidden="true" />
                </a>
                <p className="flex items-start gap-2 text-xs leading-5 text-slate-500">
                  <FaDirections className="mt-0.5 h-4 w-4 shrink-0 text-[#1679bd]" aria-hidden="true" />
                  {copy.locationDirectionsHelp}
                </p>
              </div>
            </div>

            <div className="min-h-[340px] overflow-hidden rounded-3xl border border-white bg-white p-2 shadow-sm sm:min-h-[400px]">
              <MapEmbed className="h-full min-h-[324px] rounded-2xl border-0 shadow-none sm:min-h-[384px]" query={locationQuery} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Contact;