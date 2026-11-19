import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useMemo } from 'react';
import { useAsync } from '../hooks/useAsync';
import { useLiveTrains } from '../hooks/useLiveTrains';
import { useNow } from '../hooks/useNow';
import { useI18n } from '../i18n';
import { departuresFrom } from '../lib/departures';
import { directJourneys } from '../lib/journeys';
import { attachLive } from '../lib/live';
import { formatClock, madridNow, pickedTimeToSeconds, serviceSeconds } from '../lib/time';
import { timetable } from '../lib/timetable';
import type { Departure, Journey, Station } from '../lib/types';
import { DeparturesPanel, JourneysPanel } from './ResultsPanel';

interface Props {
  from: Station;
  to: Station | null;
  /** `HH:MM`, or null for "leaving now". */
  at: string | null;
  codeByName: Map<string, string>;
}

/** How far back to look for late trains still due to leave in live mode. */
const LATE_WINDOW = 20 * 60;

export function TrainResults({ from, to, at, codeByName }: Props) {
  const { t } = useI18n();
  const names = to ? [from.name, to.name] : [from.name];
  const { state, retry } = useAsync(names.join('|'), (signal) => timetable.get(names, signal));
  const clock = useNow(15_000);
  const liveMode = at === null;
  const live = useLiveTrains(liveMode && state.status === 'ready');

  const rows = useMemo(() => ('data' in state && state.data ? state.data : []), [state]);
  const now = serviceSeconds(clock, rows[0]?.date);
  const start = at ? pickedTimeToSeconds(at) : now;

  const all = useMemo<(Departure | Journey)[]>(
    () => (to ? directJourneys(rows, from.name, to.name) : departuresFrom(rows, from.name)),
    [rows, from.name, to],
  );

  const items = useMemo(() => {
    let pool = all.filter((d) => d.stop.departure >= start - (liveMode ? LATE_WINDOW : 0));
    if (liveMode && live.trains.length) pool = attachLive(pool, from.code, live.trains, codeByName, now);
    // Keep anything not yet gone, plus late trains the live feed says are still coming.
    return pool.filter((d) => d.stop.departure >= start - 60 || d.live !== undefined);
  }, [all, start, liveMode, live.trains, from.code, codeByName, now]);

  if (state.status === 'error') {
    return (
      <div role="alert" className="rounded-2xl border border-line bg-surface p-6 text-center">
        <AlertTriangle className="mx-auto mb-2 text-danger" aria-hidden />
        <p className="mb-4 text-sm">{t('errorTimetable')}</p>
        <button
          type="button"
          onClick={retry}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink"
        >
          <RefreshCw size={16} aria-hidden />
          {t('retry')}
        </button>
      </div>
    );
  }

  if (state.status !== 'ready') {
    return (
      <div className="overflow-hidden rounded-2xl border border-line bg-surface" aria-busy="true">
        <p className="sr-only" role="status">
          {t('loading')}
        </p>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex animate-pulse items-center gap-3 border-b border-line px-4 py-4 last:border-0">
            <div className="h-7 w-10 rounded-md bg-surface-2" />
            <div className="h-4 flex-1 rounded bg-surface-2" />
            <div className="h-6 w-14 rounded bg-surface-2" />
          </div>
        ))}
      </div>
    );
  }

  const status = liveMode ? (
    live.failed ? (
      <span className="text-right text-xs text-warn">{t('liveUnavailable')}</span>
    ) : live.updatedAt ? (
      <span className="tabular inline-flex shrink-0 items-center gap-1.5 text-xs text-muted">
        <span className="size-1.5 rounded-full bg-ok" aria-hidden />
        {t('liveUpdated', { time: formatClock(madridNow(live.updatedAt).seconds) })}
      </span>
    ) : null
  ) : null;

  const panelKey = `${from.code}-${to?.code ?? ''}-${at ?? 'now'}`;
  const common = { now, countdown: liveMode, status };

  if (to) {
    return (
      <JourneysPanel
        key={panelKey}
        {...common}
        title={t('journeysTitle')}
        journeys={items as Journey[]}
        emptyMessage={all.length ? t('noMoreDirect') : t('noDirect')}
        filteredEmptyMessage={t('noMoreDirect')}
      />
    );
  }
  return (
    <DeparturesPanel
      key={panelKey}
      {...common}
      title={at ? t('departuresAt', { time: at }) : t('departuresTitle')}
      departures={items as Departure[]}
      emptyMessage={t('noDepartures')}
      filteredEmptyMessage={t('noLineDepartures')}
    />
  );
}
