import { useContext, useEffect, useRef, useState } from 'react';
import { ChevronDown, Globe2 } from 'lucide-react';
import { LanguageContext } from '../context/LanguageContext';

const LanguageSwitcher = () => {
  const { language, setLanguage } = useContext(LanguageContext);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const closeMenu = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', closeMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Language: ${language === 'en' ? 'GB English' : 'ET አማርኛ'}`}
        className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/5 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <Globe2 className="h-4 w-4" aria-hidden="true" />
        <span>{language === 'en' ? 'GB English' : 'ET አማርኛ'}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {isOpen && (
        <div role="menu" aria-label="Language" className="absolute right-0 z-50 mt-2 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white p-1 text-slate-800 shadow-xl">
          <button
            type="button"
            role="menuitemradio"
            aria-checked={language === 'en'}
            onClick={() => { setLanguage('en'); setIsOpen(false); }}
            className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-slate-100 ${language === 'en' ? 'bg-blue-50' : ''}`}
          >
            <span>GB English</span>
          </button>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={language === 'am'}
            onClick={() => { setLanguage('am'); setIsOpen(false); }}
            className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-slate-100 ${language === 'am' ? 'bg-blue-50' : ''}`}
          >
            <span>ET አማርኛ</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
