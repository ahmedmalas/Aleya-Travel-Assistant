import { useEffect, useMemo, useRef, useState } from 'react';
import { inputClassName } from '../trip-platform/shared/ui';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function parseIso(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Australian-friendly display DD/MM/YYYY from ISO YYYY-MM-DD. */
export function formatAuDate(iso: string): string {
  const date = parseIso(iso);
  if (!date) return iso ? iso : '';
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}/${m}/${date.getFullYear()}`;
}

export function todayIso(): string {
  return toIso(new Date());
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function buildMonthGrid(month: Date): Array<Date | null> {
  const first = startOfMonth(month);
  const startOffset = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < startOffset; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export type DatePickerFieldProps = {
  id: string;
  value: string;
  onChange: (isoDate: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  placeholder?: string;
  'aria-label'?: string;
};

export function DatePickerField({
  id,
  value,
  onChange,
  min,
  max,
  disabled,
  placeholder = 'DD/MM/YYYY',
  'aria-label': ariaLabel,
}: DatePickerFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = parseIso(value);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(selected ?? new Date()));

  useEffect(() => {
    if (selected) setVisibleMonth(startOfMonth(selected));
  }, [value]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const cells = useMemo(() => buildMonthGrid(visibleMonth), [visibleMonth]);
  const minDate = min ? parseIso(min) : null;
  const maxDate = max ? parseIso(max) : null;
  const monthLabel = visibleMonth.toLocaleString('en-AU', { month: 'long', year: 'numeric' });

  const isDisabledDay = (date: Date) => {
    const iso = toIso(date);
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    if (!min && !max) return false;
    void iso;
    return false;
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`${inputClassName} text-left ${!value ? 'text-slate-400' : ''}`}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
        }}
      >
        {value ? formatAuDate(value) : placeholder}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Choose date"
          className="absolute z-40 mt-1 w-[288px] rounded-2xl border border-white/15 bg-slate-950/95 p-3 shadow-2xl shadow-black/50"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-sm text-slate-200 hover:bg-white/10"
              onClick={() => setVisibleMonth((month) => addMonths(month, -1))}
              aria-label="Previous month"
            >
              ‹
            </button>
            <p className="text-sm font-medium text-white">{monthLabel}</p>
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-sm text-slate-200 hover:bg-white/10"
              onClick={() => setVisibleMonth((month) => addMonths(month, 1))}
              aria-label="Next month"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-wide text-slate-400">
            {WEEKDAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((date, index) => {
              if (!date) return <span key={`empty-${index}`} />;
              const iso = toIso(date);
              const selectedDay = value === iso;
              const disabledDay = isDisabledDay(date);
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={disabledDay}
                  className={`rounded-lg px-1 py-2 text-sm ${
                    selectedDay
                      ? 'bg-sky-400/30 text-sky-50'
                      : disabledDay
                        ? 'cursor-not-allowed text-slate-600'
                        : 'text-slate-100 hover:bg-white/10'
                  }`}
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between gap-2">
            <button
              type="button"
              className="text-xs text-slate-400 hover:text-slate-200"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className="text-xs text-sky-300 hover:text-sky-100"
              onClick={() => {
                const today = todayIso();
                if (!min || today >= min) {
                  onChange(today);
                  setOpen(false);
                }
              }}
            >
              Today
            </button>
          </div>
        </div>
      ) : null}
      <input type="hidden" name={id} value={value} readOnly />
    </div>
  );
}
