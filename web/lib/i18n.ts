import ar from '@/messages/ar.json';
import en from '@/messages/en.json';

export type Locale = 'ar' | 'en';
export const locales: Locale[] = ['ar', 'en'];
export const defaultLocale: Locale = 'ar';

const dictionaries = { ar, en } as const;
export type Dictionary = typeof ar;

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export function otherLocale(locale: Locale): Locale {
  return locale === 'ar' ? 'en' : 'ar';
}

export function dirFor(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}
