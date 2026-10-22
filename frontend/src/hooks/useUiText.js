import { useCallback, useContext } from 'react';
import { LanguageContext } from '../context/LanguageContext';
import { translateUiText } from '../locales/uiText';

export const useUiText = () => {
  const { language } = useContext(LanguageContext);
  return useCallback((englishText) => translateUiText(englishText, language), [language]);
};

export default useUiText;
