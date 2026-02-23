import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { setLanguage, getLanguage, getCurrentLanguage, t as translate } from '@/src/i18n';

type Language = 'es' | 'en';

interface LanguageContextType {
  language: Language;
  setLang: (lang: Language) => Promise<void>;
  t: (key: string, options?: object) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('es');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    const savedLang = await getLanguage();
    setLanguageState(savedLang);
    setIsLoaded(true);
  };

  const setLang = async (lang: Language) => {
    await setLanguage(lang);
    setLanguageState(lang);
  };

  const t = (key: string, options?: object) => {
    return translate(key, options);
  };

  if (!isLoaded) {
    return null;
  }

  return (
    <LanguageContext.Provider value={{ language, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
