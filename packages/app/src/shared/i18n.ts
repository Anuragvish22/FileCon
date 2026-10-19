import type { Locale } from '@filecon/core/types';
import en from '../locales/en.json' with { type: 'json' };

export type Catalog = Record<string, string>;
export type TextParams = Record<string, string | number>;
export type Translate = (key: string, params?: TextParams) => string;

// One entry per shipped locale file (CONTRACTS section 10).
export const CATALOGS: Record<Locale, Catalog> = { en };

const FALLBACK_LOCALE: Locale = 'en';
const PLURAL_COUNT = 'count';

interface TranslatorInput {
  locale: Locale;
  catalogs?: Record<string, Catalog>;
  /** Called once per missing key. Defaults to console.warn. */
  warn?: (message: string) => void;
}

/** A missing key falls back to `en`, then to the key itself. It never throws (CONTRACTS section 10). */
export const createTranslator = ({
  locale,
  catalogs = CATALOGS,
  warn = (message) => {
    console.warn(message);
  },
}: TranslatorInput): Translate => {
  const plurals = new Intl.PluralRules(locale);
  const numbers = new Intl.NumberFormat(locale);
  const warned = new Set<string>();

  const lookup = (key: string): string | undefined =>
    catalogs[locale]?.[key] ?? catalogs[FALLBACK_LOCALE]?.[key];

  return (key, params = {}) => {
    const count = params[PLURAL_COUNT];
    const plural =
      typeof count === 'number' ? lookup(`${key}.${plurals.select(count)}`) : undefined;
    const text = plural ?? lookup(key);
    if (text === undefined) {
      if (!warned.has(key)) {
        warned.add(key);
        warn(`missing text key: ${key}`);
      }
      return key;
    }
    return text.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
      const value = params[name];
      if (value === undefined) return placeholder;
      return typeof value === 'number' ? numbers.format(value) : value;
    });
  };
};

/** `system` follows the OS language when a catalog for it ships, else `en` (CONTRACTS section 8). */
export const resolveLocale = (language: string, systemLanguage: string): Locale => {
  const wanted = language === 'system' ? systemLanguage.split('-')[0] : language;
  return (
    Object.keys(CATALOGS).find((locale): locale is Locale => locale === wanted) ?? FALLBACK_LOCALE
  );
};
