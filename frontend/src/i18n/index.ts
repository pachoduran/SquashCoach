import { I18n } from 'i18n-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import es from './es.json';
import en from './en.json';

const i18n = new I18n({
  es,
  en,
});

// Default locale
i18n.defaultLocale = 'es';
i18n.locale = 'es';
i18n.enableFallback = true;

const LANGUAGE_KEY = '@squash_coach_language';

export const setLanguage = async (lang: 'es' | 'en') => {
  i18n.locale = lang;
  await AsyncStorage.setItem(LANGUAGE_KEY, lang);
};

export const getLanguage = async (): Promise<'es' | 'en'> => {
  const lang = await AsyncStorage.getItem(LANGUAGE_KEY);
  if (lang === 'es' || lang === 'en') {
    i18n.locale = lang;
    return lang;
  }
  return 'es';
};

export const getCurrentLanguage = (): 'es' | 'en' => {
  return i18n.locale as 'es' | 'en';
};

export const t = (key: string, options?: object) => {
  return i18n.t(key, options);
};

export default i18n;
