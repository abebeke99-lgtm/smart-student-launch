import { createContext, useMemo, useState, useEffect } from 'react';
import { translations } from '../translations';

export const LanguageContext = createContext({
  language: 'en',
  toggleLanguage: () => {},
  setLanguage: () => {},
  strings: translations.en,
});

export const LanguageProvider = ({ children }) => {
  const getInitialLanguage = () => {
    if (typeof window !== 'undefined') {
      const storedLanguage = window.localStorage.getItem('ipes-language');
      if (storedLanguage === 'en' || storedLanguage === 'am') return storedLanguage;
    }
    const nav = typeof navigator !== 'undefined' && navigator.language ? navigator.language.toLowerCase() : '';
    if (nav.startsWith('am')) return 'am';
    return 'en';
  };

  const [language, setLanguage] = useState(getInitialLanguage);

  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem('ipes-language', language);
  }, [language]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === 'ipes-language' && (event.newValue === 'en' || event.newValue === 'am')) setLanguage(event.newValue);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const toggleLanguage = () => {
    setLanguage((current) => (current === 'en' ? 'am' : 'en'));
  };

  const value = useMemo(
    () => ({ language, toggleLanguage, setLanguage, strings: translations[language] || translations.en }),
    [language]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};
