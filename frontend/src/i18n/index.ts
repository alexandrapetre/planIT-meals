import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import translationsEn from './translations/translations.en.json';
import translationsRo from './translations/translations.ro.json';

export const LANGUAGE_STORAGE_KEY = 'language';

const resources = {
  en: {
    translation: translationsEn,
  },
  ro: {
    translation: translationsRo,
  },
} as const;

const savedLanguage =
  typeof window !== 'undefined' ? localStorage.getItem(LANGUAGE_STORAGE_KEY) : null;

i18next.use(initReactI18next).init({
  resources,
  lng: savedLanguage || 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export const SUPPORTED_LANGUAGES = ['en', 'ro'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export default i18next;
