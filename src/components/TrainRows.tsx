import { ArrowRight, Flag } from 'lucide-react';
import { useI18n } from '../i18n';
import { formatClock, minutesUntil } from '../lib/time';
import type { Departure, Journey } from '../lib/types';
import { LineBadge } from './LineBadge';
import { LiveInfo } from './LiveInfo';

/** Big right-hand figure: minutes to go (live mode) or the clock time (planning mode). */
function WhenCell({ departure, now, countdown, late }: { departure: number; now: number; countdown: boolean; late: boolean }) {
  const { t } = useI18n();
  const clock = formatClock(departure);
  if (!countdown) {
    return <div className="tabular text-right text-xl font-bold">{clock}</div>;
  }
  const passed = departure < now - 30;
  const minutes = minutesUntil(departure, now);
  // Past an hour a countdown ("283 min") is harder to read than the time itself.
  if (minutes >= 60) {
    return <div className="tabular text-right text-xl font-bold">{clock}</div>;
  }
  return (
    <div className="text-right">
      <div className={`tabular text-xl font-bold leading-tight ${passed && late ? 'text-warn' : ''}`}>
        {passed ? (late ? t('delayed') : t('now')) : minutes === 0 ? t('now') : t('inMinutes', { n: minutes })}
      </div>
      <div className={`tabular text-xs text-muted ${passed ? 'line-through' : ''}`}>
        {passed ? t('scheduledPassed', { time: clock }) : clock}
      </div>
    </div>
  );
}

function LastTag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-semibold text-danger">
      <Flag size={11} aria-hidden />
      {label}
    </span>
  );
}

export function DepartureRow({ departure, now, countdown }: { departure: Departure; now: number; countdown: boolean }) {
  const { t } = useI18n();
  const { stop, live } = departure;
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <LineBadge name={stop.line} color={stop.color} textColor={stop.textColor} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold leading-tight">{stop.headsign}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          {stop.platform && <span>{t('platform', { p: stop.platform })}</span>}
          {departure.isLast && <LastTag label={t('lastTrain')} />}
        </div>
        {live && <LiveInfo live={live} />}
      </div>
      <WhenCell departure={stop.departure} now={now} countdown={countdown} late={live?.onTime === false} />
    </li>
  );
}

export function JourneyRow({ journey, now, countdown }: { journey: Journey; now: number; countdown: boolean }) {
  const { t } = useI18n();
  const { stop, arrival, live } = journey;
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <LineBadge name={stop.line} color={stop.color} textColor={stop.textColor} />
      <div className="min-w-0 flex-1">
        <div className="tabular flex items-center gap-1.5 font-semibold leading-tight">
          {formatClock(stop.departure)}
          <ArrowRight size={14} className="text-muted" aria-label="→" />
          {formatClock(arrival.arrival)}
          <span className="ml-1 font-normal text-muted">· {t('rideMinutes', { n: Math.round(journey.duration / 60) })}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span className="truncate">{t('towards', { name: stop.headsign })}</span>
          {stop.platform && <span>· {t('platform', { p: stop.platform })}</span>}
          {journey.isLast && <LastTag label={t('lastDirect')} />}
        </div>
        {live && <LiveInfo live={live} />}
      </div>
      <WhenCell departure={stop.departure} now={now} countdown={countdown} late={live?.onTime === false} />
    </li>
  );
}
