import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { translations } from '../translations';

const DEFAULT_LANGUAGE = 'en';
const SUPPORTED_LANGUAGES = new Set(['en', 'am']);

const normalizeLanguage = (value) => (
  typeof value === 'string' && SUPPORTED_LANGUAGES.has(value) ? value : DEFAULT_LANGUAGE
);

const mergeWithEnglishFallback = (base, translated) => {
  if (!base || typeof base !== 'object' || Array.isArray(base)) {
    return typeof translated === 'string' && translated.length === 0 ? base : translated ?? base;
  }

  const result = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(translated || {})]);
  keys.forEach((key) => {
    const baseValue = base[key];
    const translatedValue = translated?.[key];
    if (baseValue && typeof baseValue === 'object' && !Array.isArray(baseValue)) {
      result[key] = mergeWithEnglishFallback(baseValue, translatedValue);
    } else {
      result[key] = typeof translatedValue === 'string' && translatedValue.length === 0
        ? baseValue
        : translatedValue ?? baseValue;
    }
  });
  return result;
};

export const LanguageContext = createContext({
  language: DEFAULT_LANGUAGE,
  toggleLanguage: () => {},
  setLanguage: () => {},
  strings: translations.en,
});

export const LanguageProvider = ({ children }) => {
  const getInitialLanguage = () => {
    if (typeof window !== 'undefined') {
      try {
        const storedLanguage = window.localStorage.getItem('ipes-language');
        if (storedLanguage) return normalizeLanguage(storedLanguage);
      } catch {
        return DEFAULT_LANGUAGE;
      }
    }
    return DEFAULT_LANGUAGE;
  };

  const [language, setLanguage] = useState(getInitialLanguage);

  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = language;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('ipes-language', language);
      } catch {
        // The selected language remains active for this session when storage is unavailable.
      }
    }
  }, [language]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === 'ipes-language') setLanguage(normalizeLanguage(event.newValue));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const updateLanguage = useCallback((nextLanguage) => {
    setLanguage(normalizeLanguage(nextLanguage));
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage((current) => (current === 'en' ? 'am' : 'en'));
  }, []);

  const value = useMemo(
    () => ({
      language,
      toggleLanguage,
      setLanguage: updateLanguage,
      strings: language === DEFAULT_LANGUAGE
        ? translations.en
        : mergeWithEnglishFallback(translations.en, translations[language]),
    }),
    [language, toggleLanguage, updateLanguage]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};
