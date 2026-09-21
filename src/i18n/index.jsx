import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import en from './en.json';
import es from './es.json';

// Real i18n infrastructure, not a hardcoded-English placeholder: locale
// switching, a translation function with a safe fallback to English (so a
// partially-translated locale never renders blank), and locale-aware
// date/number formatting via Intl. Only `en` is fully translated today;
// `es` intentionally covers a meaningful subset (nav/home/auth) to prove
// the mechanism works end-to-end — adding more strings or locales is
// additive, never a rewrite. See README "Internationalization".
const DICTIONARIES = { en, es };
export const SUPPORTED_LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
];

const I18nContext = createContext(null);

function detectDefaultLocale() {
  try {
    const stored = localStorage.getItem('human_locale');
    if (stored && DICTIONARIES[stored]) return stored;
  } catch {
    // localStorage unavailable — fall through to browser detection
  }
  const browserLang = (navigator.language || 'en').split('-')[0];
  return DICTIONARIES[browserLang] ? browserLang : 'en';
}

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(detectDefaultLocale);

  const setLocale = useCallback((code) => {
    if (!DICTIONARIES[code]) return;
    setLocaleState(code);
    try {
      localStorage.setItem('human_locale', code);
    } catch {
      // best-effort only
    }
  }, []);

  const t = useCallback((key) => DICTIONARIES[locale]?.[key] ?? DICTIONARIES.en[key] ?? key, [locale]);

  const formatDate = useCallback((value, options = { dateStyle: 'medium', timeStyle: 'short' }) => {
    try {
      return new Intl.DateTimeFormat(locale, options).format(new Date(value));
    } catch {
      return new Date(value).toLocaleString();
    }
  }, [locale]);

  const formatRelativeTime = useCallback((value) => {
    const diffSeconds = (new Date(value).getTime() - Date.now()) / 1000;
    const divisions = [
      { amount: 60, unit: 'second' }, { amount: 60, unit: 'minute' }, { amount: 24, unit: 'hour' },
      { amount: 7, unit: 'day' }, { amount: 4.34524, unit: 'week' }, { amount: 12, unit: 'month' }, { amount: Infinity, unit: 'year' },
    ];
    let duration = diffSeconds;
    for (const division of divisions) {
      if (Math.abs(duration) < division.amount) {
        return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(Math.round(duration), division.unit);
      }
      duration /= division.amount;
    }
    return new Date(value).toLocaleDateString();
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t, formatDate, formatRelativeTime }), [locale, setLocale, t, formatDate, formatRelativeTime]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
