import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { LANGS, type Lang } from '../lib/storage';
import { MESSAGES, type MessageKey } from './messages';

type Vars = Record<string, string | number>;
type PluralBase<K> = K extends `${infer B}_one` ? B : never;
export type PluralKey = PluralBase<MessageKey>;

export interface Translator {
  lang: Lang;
  t: (key: MessageKey, vars?: Vars) => string;
  /** Picks `<key>_one` / `<key>_other` by `n`. */
  tn: (key: PluralKey, n: number, vars?: Vars) => string;
  formatNumber: (n: number, options?: Intl.NumberFormatOptions) => string;
}

export function interpolate(template: string, vars: Vars = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

export function createTranslator(lang: Lang): Translator {
  const messages = MESSAGES[lang];
  const numberFormats = new Map<string, Intl.NumberFormat>();
  return {
    lang,
    t: (key, vars) => interpolate(messages[key], vars),
    tn: (key, n, vars) => interpolate(messages[`${key}_${n === 1 ? 'one' : 'other'}` as MessageKey], { n, ...vars }),
    formatNumber: (n, options) => {
      const cacheKey = JSON.stringify(options ?? {});
      let f = numberFormats.get(cacheKey);
      if (!f) numberFormats.set(cacheKey, (f = new Intl.NumberFormat(lang, options)));
      return f.format(n);
    },
  };
}

/** First supported language in the browser's preference list; Catalan otherwise. */
export function detectLang(languages: readonly string[] = navigator.languages ?? [navigator.language]): Lang {
  for (const tag of languages) {
    const base = tag.toLowerCase().split('-')[0];
    if ((LANGS as string[]).includes(base)) return base as Lang;
  }
  return 'ca';
}

const I18nContext = createContext<Translator>(createTranslator('ca'));

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const value = useMemo(() => createTranslator(lang), [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
