import I18n from 'i18n-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import es from './es.json';
import en from './en.json';

// Setup translations
I18n.translations = {
  es,
  en,
};

// Default locale
I18n.defaultLocale = 'es';
I18n.locale = 'es';
I18n.fallbacks = true;

const LANGUAGE_KEY = '@squash_coach_language';

export const setLanguage = async (lang: 'es' | 'en') => {
  I18n.locale = lang;
  await AsyncStorage.setItem(LANGUAGE_KEY, lang);
};

export const getLanguage = async (): Promise<'es' | 'en'> => {
  try {
    const lang = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (lang === 'es' || lang === 'en') {
      I18n.locale = lang;
      return lang;
    }
  } catch (e) {
    console.log('Error loading language:', e);
  }
  return 'es';
};

export const getCurrentLanguage = (): 'es' | 'en' => {
  return I18n.locale as 'es' | 'en';
};

export const t = (key: string, options?: object) => {
  return I18n.t(key, options);
};

export default I18n;
