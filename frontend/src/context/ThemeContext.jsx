import { createContext, useEffect, useState } from 'react';

export const ThemeContext = createContext({
  isDark: true,
  toggleTheme: () => {},
});

const getInitialTheme = () => {
  try {
    if (typeof window === 'undefined') return false;
    const storedTheme = window.localStorage.getItem('ipes-theme');
    if (storedTheme === 'dark' || storedTheme === 'light') return storedTheme === 'dark';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches || false;
  } catch {
    return false;
  }
};

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      window.localStorage.setItem('ipes-theme', isDark ? 'dark' : 'light');
    } catch {}
  }, [isDark]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === 'ipes-theme' && (event.newValue === 'dark' || event.newValue === 'light')) {
        setIsDark(event.newValue === 'dark');
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const toggleTheme = () => setIsDark((v) => !v);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;
