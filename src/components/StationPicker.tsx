import { X } from 'lucide-react';
import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useI18n } from '../i18n';
import { searchStations } from '../lib/search';
import type { Station } from '../lib/types';
import { LineBadge } from './LineBadge';

interface Props {
  label: string;
  placeholder: string;
  stations: Station[];
  value: Station | null;
  onSelect: (station: Station | null) => void;
  /** Offered when the field is focused but empty (favourites, recents…). */
  suggestions?: Station[];
  excludeCode?: string | null;
  disabled?: boolean;
}

/** Accessible combobox (WAI-ARIA 1.2 pattern) with accent-insensitive search. */
export function StationPicker({ label, placeholder, stations, value, onSelect, suggestions = [], excludeCode, disabled }: Props) {
  const { t } = useI18n();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState<string | null>(null); // null = not editing
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const options = useMemo(() => {
    const list = query?.trim() ? searchStations(stations, query, 8) : suggestions;
    return list.filter((s) => s.code !== excludeCode);
  }, [query, stations, suggestions, excludeCode]);

  const choose = (station: Station) => {
    onSelect(station);
    setQuery(null);
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && options[active]) {
        e.preventDefault();
        choose(options[active]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery(null);
    }
  };

  const showList = open && (options.length > 0 || !!query?.trim());
  const listId = `${id}-list`;

  return (
    <div className="relative">
      <label htmlFor={`${id}-input`} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={`${id}-input`}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && options[active] ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          placeholder={placeholder}
          value={query ?? value?.name ?? ''}
          onFocus={(e) => {
            setOpen(true);
            setActive(0);
            e.currentTarget.select();
          }}
          onBlur={() => {
            setOpen(false);
            setQuery(null);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          className="h-12 w-full rounded-xl border border-line bg-surface px-3.5 pr-10 text-base font-medium text-ink placeholder:font-normal placeholder:text-muted focus:border-accent focus:outline-none disabled:opacity-60"
        />
        {(value || query) && !disabled && (
          <button
            type="button"
            aria-label={`${t('clearField')} ${label}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQuery(null);
              onSelect(null);
              inputRef.current?.focus();
            }}
            className="absolute inset-y-0 right-1 my-auto flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
          >
            <X size={18} aria-hidden />
          </button>
        )}
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute z-20 mt-1.5 max-h-80 w-full overflow-auto rounded-xl border border-line bg-surface py-1 shadow-lg"
        >
          {options.length === 0 ? (
            <li className="px-3.5 py-3 text-sm text-muted">{t('noMatches')}</li>
          ) : (
            options.map((station, i) => (
              <li
                key={station.code}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(station)}
                className={`flex cursor-pointer items-center justify-between gap-3 px-3.5 py-2.5 ${i === active ? 'bg-surface-2' : ''}`}
              >
                <span className="truncate font-medium">{station.name}</span>
                <span className="flex shrink-0 flex-wrap justify-end gap-1">
                  {station.lines.slice(0, 4).map((l) => (
                    <LineBadge key={l.name} {...l} size="sm" />
                  ))}
                  {station.lines.length > 4 && <span className="text-xs text-muted">+{station.lines.length - 4}</span>}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
