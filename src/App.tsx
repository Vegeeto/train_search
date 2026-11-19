import { AlertTriangle, ArrowUpDown, Moon, RefreshCw, Star, Sun, TrainFront } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { HomePanel } from './components/HomePanel';
import { StationPicker } from './components/StationPicker';
import { TrainResults } from './components/TrainResults';
import { useAsync } from './hooks/useAsync';
import { usePrefs } from './hooks/usePrefs';
import { useTheme } from './hooks/useTheme';
import { useUrlState } from './hooks/useUrlState';
import { I18nProvider, detectLang, useI18n } from './i18n';
import { LANG_NAMES } from './i18n/messages';
import { fetchStations } from './lib/stations';
import { nextTheme } from './lib/theme';
import { LANGS, addRecent, hasJourney, toggleJourney, toggleStation, type Lang, type Prefs } from './lib/storage';
import type { Station } from './lib/types';

export default function App() {
  const [prefs, updatePrefs] = usePrefs();
  const lang = prefs.lang ?? detectLang();
  return (
    <I18nProvider lang={lang}>
      <Shell prefs={prefs} updatePrefs={updatePrefs} />
    </I18nProvider>
  );
}

function Shell({ prefs, updatePrefs }: { prefs: Prefs; updatePrefs: (fn: (p: Prefs) => Prefs) => void }) {
  const { t, lang } = useI18n();
  const theme = useTheme(prefs.theme);
  const { state, retry } = useAsync('stations', fetchStations);
  const stations = useMemo(() => (state.status === 'ready' ? state.data : []), [state]);
  const byCode = useMemo(() => new Map(stations.map((s) => [s.code, s])), [stations]);
  const codeByName = useMemo(() => new Map(stations.map((s) => [s.name, s.code])), [stations]);

  const [selection, setSelection] = useUrlState();
  const from = selection.from ? (byCode.get(selection.from) ?? null) : null;
  const to = selection.to ? (byCode.get(selection.to) ?? null) : null;
  const brokenLink = state.status === 'ready' && ((selection.from && !from) || (selection.to && !to));

  // Remember what was looked at.
  useEffect(() => {
    if (from) updatePrefs((p) => addRecent(p, from.code, to?.code ?? null));
  }, [from?.code, to?.code]); // updatePrefs is stable; from/to objects are keyed by code

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = from ? `${from.name}${to ? ` → ${to.name}` : ''} · ${t('appTitle')}` : t('appTitle');
  }, [lang, from, to, t]);

  const suggestions = useMemo(() => {
    const codes = [...prefs.stations, ...prefs.recents.flatMap(([a, b]) => (b ? [a, b] : [a]))];
    return [...new Set(codes)]
      .map((c) => byCode.get(c))
      .filter((s): s is Station => !!s)
      .slice(0, 6);
  }, [prefs, byCode]);

  const isFavourite = from ? (to ? hasJourney(prefs, from.code, to.code) : prefs.stations.includes(from.code)) : false;
  const toggleFavourite = () => {
    if (!from) return;
    updatePrefs((p) => (to ? toggleJourney(p, from.code, to.code) : toggleStation(p, from.code)));
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setSelection({ from: null, to: null, at: null })}
          className="flex items-center gap-2.5 rounded-lg text-left"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-ink">
            <TrainFront size={20} aria-hidden />
          </span>
          <span>
            <span className="block text-lg leading-tight font-bold">{t('appTitle')}</span>
            <span className="block text-xs text-muted">{t('appSubtitle')}</span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label={theme === 'dark' ? t('themeToLight') : t('themeToDark')}
            title={theme === 'dark' ? t('themeToLight') : t('themeToDark')}
            onClick={() => updatePrefs((p) => ({ ...p, theme: nextTheme(theme) }))}
            className="flex size-9 items-center justify-center rounded-lg border border-line bg-surface text-muted hover:bg-surface-2 hover:text-ink"
          >
            {theme === 'dark' ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
          </button>
          <label className="sr-only" htmlFor="lang">
            {t('language')}
          </label>
          <select
            id="lang"
            value={lang}
            onChange={(e) => updatePrefs((p) => ({ ...p, lang: e.target.value as Lang }))}
            className="h-9 rounded-lg border border-line bg-surface px-2 text-sm font-medium"
          >
            {LANGS.map((l) => (
              <option key={l} value={l}>
                {LANG_NAMES[l]}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="mb-4 rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1 space-y-3">
            <StationPicker
              label={t('from')}
              placeholder={t('fromPlaceholder')}
              stations={stations}
              value={from}
              suggestions={suggestions}
              excludeCode={to?.code}
              disabled={state.status !== 'ready'}
              onSelect={(s) => setSelection({ from: s?.code ?? null, to: s ? selection.to : null })}
            />
            <StationPicker
              label={t('to')}
              placeholder={t('toPlaceholder')}
              stations={stations}
              value={to}
              suggestions={suggestions}
              excludeCode={from?.code}
              disabled={state.status !== 'ready' || !from}
              onSelect={(s) => setSelection({ to: s?.code ?? null })}
            />
          </div>
          <button
            type="button"
            aria-label={t('swap')}
            title={t('swap')}
            disabled={!from || !to}
            onClick={() => setSelection({ from: to!.code, to: from!.code })}
            className="mb-1.5 flex size-10 shrink-0 items-center justify-center rounded-xl border border-line text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-40"
          >
            <ArrowUpDown size={18} aria-hidden />
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <fieldset className="flex items-center gap-2">
            <legend className="sr-only">{t('when')}</legend>
            <button
              type="button"
              aria-pressed={selection.at === null}
              onClick={() => setSelection({ at: null })}
              className={`h-9 rounded-lg px-3 text-sm font-semibold ${selection.at === null ? 'bg-ink text-bg' : 'border border-line hover:bg-surface-2'}`}
            >
              {t('now')}
            </button>
            <label className="flex items-center gap-2 text-sm text-muted">
              <span className="hidden sm:inline">{t('leaveAt')}</span>
              <input
                type="time"
                aria-label={t('leaveAt')}
                value={selection.at ?? ''}
                onChange={(e) => setSelection({ at: e.target.value || null })}
                className={`tabular h-9 rounded-lg border bg-surface px-2 text-sm font-medium text-ink ${selection.at ? 'border-ink' : 'border-line'}`}
              />
            </label>
          </fieldset>
          {from && (
            <button
              type="button"
              aria-pressed={isFavourite}
              aria-label={isFavourite ? t('removeFavourite') : t('saveFavourite')}
              onClick={toggleFavourite}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold ${isFavourite ? 'bg-accent-soft text-accent' : 'border border-line text-muted hover:bg-surface-2 hover:text-ink'}`}
            >
              <Star size={16} fill={isFavourite ? 'currentColor' : 'none'} aria-hidden />
              <span className="hidden sm:inline" aria-hidden>
                {isFavourite ? t('removeFavourite') : t('saveFavourite')}
              </span>
            </button>
          )}
        </div>
      </div>

      <main className="flex-1">
        {brokenLink && (
          <p role="alert" className="mb-4 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">
            {t('stationNotFound')}
          </p>
        )}
        {state.status === 'error' ? (
          <div role="alert" className="rounded-2xl border border-line bg-surface p-6 text-center">
            <AlertTriangle className="mx-auto mb-2 text-danger" aria-hidden />
            <p className="mb-4 text-sm">{t('errorStations')}</p>
            <button
              type="button"
              onClick={retry}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink"
            >
              <RefreshCw size={16} aria-hidden />
              {t('retry')}
            </button>
          </div>
        ) : state.status !== 'ready' ? (
          <p role="status" className="py-10 text-center text-sm text-muted">
            {t('loadingStations')}
          </p>
        ) : from ? (
          <TrainResults from={from} to={to} at={selection.at} codeByName={codeByName} />
        ) : (
          <HomePanel prefs={prefs} stations={stations} byCode={byCode} onPick={(a, b) => setSelection({ from: a, to: b })} />
        )}
      </main>

      <footer className="mt-8 text-center text-xs text-muted">{t('footer')}</footer>
    </div>
  );
}
