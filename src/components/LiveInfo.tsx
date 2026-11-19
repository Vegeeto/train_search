import { useI18n } from '../i18n';
import type { LiveStatus, Occupancy } from '../lib/types';

export function OccupancyMeter({ occupancy }: { occupancy: Occupancy }) {
  const { t } = useI18n();
  if (!occupancy.level) return null;
  const label = [t('occupancyLow'), t('occupancyMedium'), t('occupancyHigh')][occupancy.level - 1];
  const tone = ['bg-ok', 'bg-warn', 'bg-danger'][occupancy.level - 1];
  const detail =
    occupancy.percent !== null ? t('occupancyDetail', { level: label.toLowerCase(), percent: occupancy.percent }) : `${t('occupancy')}: ${label}`;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted" title={detail}>
      <span className="flex h-3 items-end gap-0.5" aria-hidden>
        {[1, 2, 3].map((bar) => (
          <span key={bar} className={`w-1 rounded-sm ${bar <= occupancy.level! ? tone : 'bg-line'}`} style={{ height: `${bar * 4}px` }} />
        ))}
      </span>
      <span className="sr-only">{detail}</span>
      <span aria-hidden>{label}</span>
    </span>
  );
}

export function LiveInfo({ live }: { live: LiveStatus }) {
  const { t, tn } = useI18n();
  const position = live.stopsAway === 0 ? t('atPlatform') : tn('stopsAway', live.stopsAway);
  const late = live.onTime === false;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${late ? 'bg-warn-soft text-warn' : 'bg-ok-soft text-ok'}`}
      >
        <span className="relative flex size-2" aria-hidden>
          <span className={`absolute inline-flex size-full animate-ping rounded-full opacity-60 motion-reduce:hidden ${late ? 'bg-warn' : 'bg-ok'}`} />
          <span className={`relative inline-flex size-2 rounded-full ${late ? 'bg-warn' : 'bg-ok'}`} />
        </span>
        {position}
        {live.onTime !== null && <span className="font-normal">· {late ? t('delayed') : t('onTime')}</span>}
      </span>
      {live.occupancy && <OccupancyMeter occupancy={live.occupancy} />}
    </div>
  );
}
