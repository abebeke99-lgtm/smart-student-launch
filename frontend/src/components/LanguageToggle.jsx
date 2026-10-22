import { useContext } from 'react';
import { LanguageContext } from '../context/LanguageContext';
import { useUiText } from '../hooks/useUiText';

export const LanguageToggle = ({ language, onChange, currentLang, onLanguageChange }) => {
  const t = useUiText();
  const { language: globalLanguage, setLanguage } = useContext(LanguageContext);
  const selectedLanguage = currentLang || language || globalLanguage || 'en';
  const handleLanguageChange = (nextLanguage) => {
    setLanguage(nextLanguage);
    (onLanguageChange || onChange)?.(nextLanguage);
  };

  return (
    <div className="inline-flex items-center rounded-full border border-gray-200 bg-white p-1 text-sm shadow-sm" role="group" aria-label={t('Evaluation language')}>
    <button
      type="button"
      onClick={() => handleLanguageChange?.('en')}
      aria-pressed={selectedLanguage === 'en'}
      className={`rounded-full px-3 py-1.5 font-semibold transition ${selectedLanguage === 'en' ? 'bg-ieps-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
    >
      🇬🇧 {t('English')}
    </button>
    <button
      type="button"
      onClick={() => handleLanguageChange?.('am')}
      aria-pressed={selectedLanguage === 'am'}
      className={`rounded-full px-3 py-1.5 font-semibold transition ${selectedLanguage === 'am' ? 'bg-ieps-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
    >
      🇪🇹 {t('Amharic')}
    </button>
  </div>
  );
};

export default LanguageToggle;
