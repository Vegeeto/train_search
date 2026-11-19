import { useMemo, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n';
import { compareLines } from '../lib/stations';
import type { Departure, Journey } from '../lib/types';
import { LineBadge } from './LineBadge';
import { DepartureRow, JourneyRow } from './TrainRows';

const PAGE = 10;

interface Props {
  title: string;
  status?: ReactNode;
  now: number;
  countdown: boolean;
  emptyMessage: string;
  filteredEmptyMessage: string;
}

function LineFilter({
  lines,
  selected,
  onToggle,
  onAll,
}: {
  lines: { name: string; color: string; textColor: string }[];
  selected: Set<string>;
  onToggle: (name: string) => void;
  onAll: () => void;
}) {
  const { t } = useI18n();
  if (lines.length < 2) return null;
  const chip = 'inline-flex h-8 items-center rounded-full border px-2.5 text-sm font-semibold transition-colors';
  return (
    <div role="group" aria-label={t('linesFilter')} className="flex gap-1.5 overflow-x-auto px-4 pb-3 [scrollbar-width:none]">
      <button
        type="button"
        aria-pressed={selected.size === 0}
        onClick={onAll}
        className={`${chip} ${selected.size === 0 ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-ink hover:bg-surface-2'}`}
      >
        {t('allLines')}
      </button>
      {lines.map((line) => {
        const on = selected.has(line.name);
        return (
          <button
            key={line.name}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(line.name)}
            className={`${chip} gap-1.5 ${on ? 'border-ink bg-surface-2' : 'border-line bg-surface hover:bg-surface-2'}`}
          >
            <LineBadge {...line} size="sm" />
          </button>
        );
      })}
    </div>
  );
}

function Panel<T extends Departure | Journey>({
  items,
  render,
  title,
  status,
  emptyMessage,
  filteredEmptyMessage,
}: Omit<Props, 'now' | 'countdown'> & { items: T[]; render: (item: T) => ReactNode }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(PAGE);

  const lines = useMemo(() => {
    const map = new Map<string, { name: string; color: string; textColor: string }>();
    for (const { stop } of items) if (!map.has(stop.line)) map.set(stop.line, { name: stop.line, color: stop.color, textColor: stop.textColor });
    return [...map.values()].sort((a, b) => compareLines(a.name, b.name));
  }, [items]);

  // Drop filters for lines that no longer appear (e.g. after changing station).
  const active = useMemo(() => new Set([...selected].filter((l) => lines.some((x) => x.name === l))), [selected, lines]);
  const filtered = active.size ? items.filter((i) => active.has(i.stop.line)) : items;
  const shown = filtered.slice(0, limit);

  return (
    <section aria-labelledby="results-title" className="overflow-hidden rounded-2xl border border-line bg-surface">
      <header className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
        <h2 id="results-title" className="text-base font-bold">
          {title}
        </h2>
        {status}
      </header>
      <LineFilter
        lines={lines}
        selected={active}
        onAll={() => setSelected(new Set())}
        onToggle={(name) =>
          setSelected((prev) => {
            const next = new Set([...prev].filter((l) => lines.some((x) => x.name === l)));
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
          })
        }
      />
      {shown.length === 0 ? (
        <p className="border-t border-line px-4 py-8 text-center text-sm text-muted">{items.length ? filteredEmptyMessage : emptyMessage}</p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">{shown.map(render)}</ul>
      )}
      {filtered.length > limit && (
        <div className="border-t border-line p-2">
          <button
            type="button"
            onClick={() => setLimit((n) => n + PAGE)}
            className="h-10 w-full rounded-lg text-sm font-semibold text-accent hover:bg-accent-soft"
          >
            {t('showMore')}
          </button>
        </div>
      )}
    </section>
  );
}

export function DeparturesPanel({ departures, now, countdown, ...rest }: Props & { departures: Departure[] }) {
  return (
    <Panel
      {...rest}
      items={departures}
      render={(d) => <DepartureRow key={`${d.stop.stopId}-${d.stop.departure}-${d.stop.line}-${d.stop.headsign}`} departure={d} now={now} countdown={countdown} />}
    />
  );
}

export function JourneysPanel({ journeys, now, countdown, ...rest }: Props & { journeys: Journey[] }) {
  return (
    <Panel
      {...rest}
      items={journeys}
      render={(j) => <JourneyRow key={`${j.stop.stopId}-${j.stop.departure}-${j.stop.line}-${j.stop.headsign}`} journey={j} now={now} countdown={countdown} />}
    />
  );
}
