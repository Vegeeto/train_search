import { ArrowRight, History, LocateFixed, MapPin, Star } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useI18n } from '../i18n';
import { nearestStations, type NearbyStation } from '../lib/geo';
import type { Prefs } from '../lib/storage';
import type { Station } from '../lib/types';
import { LineBadge } from './LineBadge';

interface Props {
  prefs: Prefs;
  stations: Station[];
  byCode: Map<string, Station>;
  onPick: (from: string, to: string | null) => void;
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

const rowButton =
  'flex w-full items-center gap-2 rounded-xl border border-line px-3 py-2.5 text-left text-sm font-medium hover:bg-surface-2';

function Pair({ from, to }: { from: Station; to: Station | null }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-1.5">
      <span className="truncate">{from.name}</span>
      {to && (
        <>
          <ArrowRight size={14} className="shrink-0 text-muted" aria-hidden />
          <span className="truncate">{to.name}</span>
        </>
      )}
    </span>
  );
}

type GeoState = { status: 'idle' } | { status: 'locating' } | { status: 'error'; message: string } | { status: 'done'; list: NearbyStation[] };

export function HomePanel({ prefs, stations, byCode, onPick }: Props) {
  const { t, formatNumber } = useI18n();
  const [geo, setGeo] = useState<GeoState>({ status: 'idle' });

  const journeys = prefs.journeys.filter(([a, b]) => byCode.has(a) && byCode.has(b));
  const favStations = prefs.stations.map((c) => byCode.get(c)).filter((s): s is Station => !!s);
  const recents = prefs.recents.filter(([a, b]) => byCode.has(a) && (b === null || byCode.has(b)));

  const locate = () => {
    if (!('geolocation' in navigator)) {
      setGeo({ status: 'error', message: t('locationUnsupported') });
      return;
    }
    setGeo({ status: 'locating' });
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeo({ status: 'done', list: nearestStations(stations, pos.coords.latitude, pos.coords.longitude, 3) }),
      () => setGeo({ status: 'error', message: t('locationError') }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const distance = (m: number) =>
    m < 1000
      ? formatNumber(Math.round(m / 10) * 10, { style: 'unit', unit: 'meter' })
      : formatNumber(m / 1000, { style: 'unit', unit: 'kilometer', maximumFractionDigits: 1 });

  return (
    <div className="space-y-4">
      {(journeys.length > 0 || favStations.length > 0) && (
        <Section icon={<Star size={16} className="text-accent" aria-hidden />} title={t('favourites')}>
          {journeys.length > 0 && (
            <ul className="space-y-2" aria-label={t('favouriteJourneys')}>
              {journeys.map(([a, b]) => (
                <li key={`${a}>${b}`}>
                  <button type="button" className={rowButton} onClick={() => onPick(a, b)}>
                    <Pair from={byCode.get(a)!} to={byCode.get(b)!} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {favStations.length > 0 && (
            <ul className={`flex flex-wrap gap-2 ${journeys.length ? 'mt-3' : ''}`} aria-label={t('favouriteStations')}>
              {favStations.map((s) => (
                <li key={s.code}>
                  <button
                    type="button"
                    onClick={() => onPick(s.code, null)}
                    className="inline-flex h-9 items-center rounded-full border border-line px-3 text-sm font-medium hover:bg-surface-2"
                  >
                    {s.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      <Section icon={<MapPin size={16} className="text-accent" aria-hidden />} title={t('nearby')}>
        {geo.status === 'done' ? (
          <ul className="space-y-2">
            {geo.list.map(({ station, meters }) => (
              <li key={station.code}>
                <button type="button" className={rowButton} onClick={() => onPick(station.code, null)}>
                  <span className="min-w-0 flex-1 truncate">{station.name}</span>
                  <span className="hidden gap-1 sm:flex">
                    {station.lines.slice(0, 3).map((l) => (
                      <LineBadge key={l.name} {...l} size="sm" />
                    ))}
                  </span>
                  <span className="tabular shrink-0 text-xs text-muted">{distance(meters)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <>
            <button
              type="button"
              onClick={locate}
              disabled={geo.status === 'locating'}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-60"
            >
              <LocateFixed size={16} aria-hidden />
              {geo.status === 'locating' ? t('locating') : t('useLocation')}
            </button>
            {geo.status === 'error' && (
              <p role="alert" className="mt-2 text-sm text-danger">
                {geo.message}
              </p>
            )}
          </>
        )}
      </Section>

      {recents.length > 0 && (
        <Section icon={<History size={16} className="text-muted" aria-hidden />} title={t('recents')}>
          <ul className="space-y-2">
            {recents.map(([a, b]) => (
              <li key={`${a}>${b ?? ''}`}>
                <button type="button" className={rowButton} onClick={() => onPick(a, b)}>
                  <Pair from={byCode.get(a)!} to={b ? byCode.get(b)! : null} />
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <p className="px-1 text-sm text-muted">{t('homeHint')}</p>
    </div>
  );
}
