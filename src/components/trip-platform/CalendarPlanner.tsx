import { useMemo, useState } from 'react';
import {
  buildItineraryIcs,
  downloadIcsFile,
  EXTERNAL_CALENDAR_ADAPTERS,
  openPrintableItinerary,
} from '../../features/calendar/icsExport';
import { useSharedTripStore } from '../../store/TripStoreContext';
import {
  calendarConflictsForDate,
  listCalendarDays,
  stopsForDate,
  toIsoDate,
} from '../../store/vaultCalculations';
import type { CalendarViewMode } from '../../store/vaultDomain';
import { EmptyState, Panel, PrimaryButton, SecondaryButton, StatusBanner } from './shared/ui';

export function CalendarPlanner() {
  const { trip, itineraryConflicts, rescheduleStopDate } = useSharedTripStore();
  const [mode, setMode] = useState<CalendarViewMode>('week');
  const [anchor, setAnchor] = useState(() => new Date(trip.departureDate || Date.now()));
  const [dragId, setDragId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const days = useMemo(() => listCalendarDays(anchor, mode), [anchor, mode]);

  const shiftAnchor = (delta: number) => {
    const next = new Date(anchor);
    if (mode === 'day') next.setDate(next.getDate() + delta);
    else if (mode === 'week') next.setDate(next.getDate() + delta * 7);
    else next.setMonth(next.getMonth() + delta);
    setAnchor(next);
  };

  return (
    <Panel
      title="Calendar planner"
      description="Month, week, and day views synced with the itinerary. Drag items onto another day to reschedule."
      actions={
        <>
          <SecondaryButton type="button" onClick={() => shiftAnchor(-1)}>
            Previous
          </SecondaryButton>
          <SecondaryButton type="button" onClick={() => setAnchor(new Date())}>
            Today
          </SecondaryButton>
          <SecondaryButton type="button" onClick={() => shiftAnchor(1)}>
            Next
          </SecondaryButton>
          <SecondaryButton
            type="button"
            onClick={() => {
              downloadIcsFile(`${trip.tripName || 'aleya-trip'}.ics`, buildItineraryIcs(trip));
              setFeedback('Downloaded .ics calendar export.');
            }}
          >
            Download .ics
          </SecondaryButton>
          <SecondaryButton
            type="button"
            onClick={() => {
              openPrintableItinerary(trip);
              setFeedback('Opened printable itinerary.');
            }}
          >
            Print itinerary
          </SecondaryButton>
        </>
      }
    >
      {feedback ? <StatusBanner kind="info" message={feedback} /> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {(['month', 'week', 'day'] as CalendarViewMode[]).map((entry) => (
          <PrimaryButton
            key={entry}
            type="button"
            aria-pressed={mode === entry}
            onClick={() => setMode(entry)}
            className={mode === entry ? '' : 'opacity-70'}
          >
            {entry[0]!.toUpperCase() + entry.slice(1)}
          </PrimaryButton>
        ))}
      </div>
      <p className="mt-3 text-sm text-slate-300">
        Anchor {toIsoDate(anchor)} · {itineraryConflicts.length} conflict(s) in trip
      </p>

      <p className="mt-2 text-xs text-slate-500">
        External calendar sync placeholders:{' '}
        {EXTERNAL_CALENDAR_ADAPTERS.map((adapter) => adapter.label).join(', ')} — OAuth not required in this phase.
      </p>

      {trip.stops.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="No itinerary items" body="Add itinerary items to schedule them on the calendar." />
        </div>
      ) : (
        <div
          className={`mt-4 grid gap-2 ${
            mode === 'month' ? 'grid-cols-2 md:grid-cols-7' : mode === 'week' ? 'grid-cols-1 md:grid-cols-7' : 'grid-cols-1'
          }`}
        >
          {days.map((date) => {
            const items = stopsForDate(trip.stops, date);
            const conflicts = calendarConflictsForDate(trip.stops, date);
            const inMonth = new Date(`${date}T00:00:00`).getMonth() === anchor.getMonth();
            return (
              <section
                key={date}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (!dragId) return;
                  rescheduleStopDate(dragId, date);
                  setFeedback(`Moved itinerary item to ${date}.`);
                  setDragId(null);
                }}
                className={`min-h-28 rounded-2xl border p-2 ${
                  inMonth || mode !== 'month'
                    ? 'border-white/10 bg-slate-950/40'
                    : 'border-white/5 bg-slate-950/20 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">{date}</h4>
                  {conflicts.length > 0 ? (
                    <span className="text-[10px] text-amber-200">{conflicts.length} conflict(s)</span>
                  ) : null}
                </div>
                <ul className="mt-2 space-y-1">
                  {items.map((stop) => (
                    <li
                      key={stop.id}
                      draggable
                      onDragStart={() => setDragId(stop.id)}
                      className="cursor-grab rounded-lg border border-white/10 bg-slate-900/80 px-2 py-1 text-xs text-slate-100"
                    >
                      <p className="font-medium">{stop.title}</p>
                      <p className="text-slate-400">
                        {stop.startTime || '--:--'}–{stop.endTime || '--:--'}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
