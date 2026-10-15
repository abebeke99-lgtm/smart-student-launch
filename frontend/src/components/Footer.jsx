import { useContext, useState, useEffect } from 'react';
import { FaFacebook, FaTwitter, FaLinkedin, FaTelegram, FaEnvelope, FaPhone, FaMapMarkerAlt, FaTimes } from 'react-icons/fa';
import { LanguageContext } from '../context/LanguageContext';
import { API_URL } from '../../config';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { strings } = useContext(LanguageContext);
  const [showDevelopers, setShowDevelopers] = useState(false);
  const [adminContact, setAdminContact] = useState({
    name: '',
    email: '',
    phone: '',
    location: 'Mekdela Amba University, Ethiopia',
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
        console.warn('Unable to load admin contact info:', error);
      }
    };

    loadAdminContact();
    return () => window.removeEventListener('ipes-contact-info-updated', handleContactInfoUpdated);
  }, []);

  const developers = [
    { key: 'kinduFikad', phone: '0961806188' },
    { key: 'negeseAbewa', phone: '0920043502' },
    { key: 'tadeleAschale', phone: '0974213404' },
    { key: 'simegnawMuniye', phone: '0918590820' },
    { key: 'fikiradisEnyih', phone: '0951877187' },
    { key: 'embetBayu', phone: '0900394631' },
  ];

  return (
    <footer className="bg-[#38A0DC] text-white">
      <div className="grid grid-cols-1 gap-8 px-6 py-12 md:grid-cols-2 md:items-center md:px-10 lg:px-16">
        <div className="flex flex-col items-center justify-center text-center md:items-center">
          <h3 className="mb-5 text-[2rem] font-bold text-white">{strings.footer.followUs}</h3>
          <div className="flex items-center justify-center gap-3">
            <a href="https://www.facebook.com/MekdelaAmbaUniversity" target="_blank" rel="noreferrer noopener" aria-label="Facebook" className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white shadow-md transition hover:bg-white/25"><FaFacebook className="h-5 w-5" /></a>
            <a href="https://twitter.com/MekdelaAmbaUni" target="_blank" rel="noreferrer noopener" aria-label="Twitter" className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white shadow-md transition hover:bg-white/25"><FaTwitter className="h-5 w-5" /></a>
            <a href="https://t.me/mekdelaamba" target="_blank" rel="noreferrer noopener" aria-label="Telegram" className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white shadow-md transition hover:bg-white/25"><FaTelegram className="h-5 w-5" /></a>
            <a href="https://www.linkedin.com/school/mekdela-amba-university" target="_blank" rel="noreferrer noopener" aria-label="LinkedIn" className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white shadow-md transition hover:bg-white/25"><FaLinkedin className="h-5 w-5" /></a>
          </div>
        </div>

        <div className="flex items-center justify-center md:justify-end">
          <div className="w-full max-w-md rounded-[26px] bg-[#2B87BD] px-5 py-5 shadow-lg">
            <h4 className="mb-4 text-center text-4xl font-bold text-white">{strings.footer.contact}</h4>
            <ul className="space-y-4 text-lg text-white">
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white">
                  <FaEnvelope className="h-4 w-4" />
                </span>
                <span>{adminContact.name}</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white">
                  <FaMapMarkerAlt className="h-4 w-4" />
                </span>
                <span>{adminContact.location}</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white">
                  <FaPhone className="h-4 w-4" />
                </span>
                <span>{adminContact.phone}</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white">
                  <FaEnvelope className="h-4 w-4" />
                </span>
                <span>{adminContact.email}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-white/20 bg-[#2B87BD] px-6 py-4 text-sm font-medium text-white md:flex-row md:items-center md:justify-between md:px-10 lg:px-16">
        <p>&copy; {currentYear} {strings.common.universityName}. {strings.footer.rights}</p>
        <button type="button" onClick={() => setShowDevelopers(true)} className="font-bold underline decoration-2 underline-offset-4 hover:text-white/80">
          {strings.footer.developedBy}
        </button>
      </div>

      {showDevelopers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setShowDevelopers(false)}>
          <div className="w-full max-w-2xl rounded-[20px] bg-[#1b2d6a] text-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between rounded-t-[20px] bg-[#1b2d6a] px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-sm font-bold">&lt;/&gt;</div>
                <h3 className="text-2xl font-bold">{strings.footer.developedTitle}</h3>
              </div>
              <button type="button" onClick={() => setShowDevelopers(false)} className="text-white/80 transition hover:text-white" aria-label={strings.footer.close}>
                <FaTimes className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-[#f3f4f6] px-5 py-6 text-gray-800">
              <p className="mb-5 text-center text-lg font-medium text-gray-700">
                {strings.footer.developedIntro}
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {developers.map((developer) => (
                  <div key={developer.key} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center shadow-sm">
                    <div className="text-xl font-bold text-gray-800">{strings.footer.developerNames[developer.key]}</div>
                    <div className="mt-1 text-base text-gray-600">{developer.phone}</div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowDevelopers(false)}
                className="mt-6 w-full rounded-xl bg-[#1b2d6a] py-3 text-lg font-bold text-white transition hover:bg-[#16285e]"
              >
                {strings.footer.close}
              </button>
            </div>
          </div>
        </div>
      )}
      
    </footer>
  );
};

export default Footer;
