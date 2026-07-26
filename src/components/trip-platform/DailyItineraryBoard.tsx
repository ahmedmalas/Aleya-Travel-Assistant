import { useState } from 'react';
import { ITINERARY_CATEGORIES, type ItineraryCategory, type TripStop } from '../../store/tripDomain';
import { useSharedTripStore } from '../../store/TripStoreContext';
import {
  EmptyState,
  Field,
  Panel,
  PrimaryButton,
  SecondaryButton,
  StatusBanner,
  inputClassName,
} from './shared/ui';

const blankStop = (currency: string): Omit<TripStop, 'id' | 'day' | 'order'> => ({
  title: '',
  notes: '',
  date: '',
  startTime: '',
  endTime: '',
  location: '',
  category: 'other',
  cost: 0,
  currency,
  bookingReference: '',

  locked: false,
  travellerIds: [],
  itemStatus: 'planned' as const,
  latitude: '',
  longitude: '',
  supplierDetails: '',
  reminderAt: '',
  aiGenerated: false,
});

export function DailyItineraryBoard() {
  const {
    trip,
    itineraryDays,
    itineraryConflicts,
    itineraryTotalCost,
    addStop,
    updateStopDetails,
    deleteStop,
    duplicateStop,
    reorderStop,
    toggleStopLock,
    canUndo,
    canRedo,
    undo,
    redo,
  } = useSharedTripStore();
  const [draft, setDraft] = useState(blankStop(trip.currency));
  const [editDraft, setEditDraft] = useState<TripStop | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const handleAdd = () => {
    if (!draft.title.trim()) {
      setFeedback('Title is required for a new itinerary item.');
      return;
    }
    let day: number | undefined;
    if (draft.date && trip.departureDate) {
      day =
        Math.max(
          1,
          Math.floor(
            (new Date(`${draft.date}T00:00:00Z`).getTime() -
              new Date(`${trip.departureDate}T00:00:00Z`).getTime()) /
              (24 * 60 * 60 * 1000),
          ) + 1,
        );
    }
    addStop({ ...draft, day });
    setDraft(blankStop(trip.currency));
    setFeedback('Itinerary item added.');
  };

  const handleSaveEdit = () => {
    if (!editDraft) {
      return;
    }
    updateStopDetails(editDraft.id, editDraft);
    setEditDraft(null);
    setFeedback('Itinerary item updated.');
  };

  const handleDropOn = (targetId: string) => {
    if (!dragId || dragId === targetId) {
      return;
    }
    const ordered = [...trip.stops].sort((a, b) => (a.day === b.day ? a.order - b.order : a.day - b.day));
    const from = ordered.findIndex((stop) => stop.id === dragId);
    const to = ordered.findIndex((stop) => stop.id === targetId);
    if (from < 0 || to < 0 || from === to) {
      setDragId(null);
      return;
    }
    const direction = to > from ? 'down' : 'up';
    for (let index = 0; index < Math.abs(to - from); index += 1) {
      reorderStop(dragId, direction);
    }
    setDragId(null);
    setFeedback('Itinerary order updated.');
  };

  return (
    <Panel
      title="Day-by-day itinerary"
      description="Plan each day with times, locations, costs, and conflict detection."
      actions={
        <>
          <SecondaryButton type="button" disabled={!canUndo} onClick={() => undo()}>
            Undo
          </SecondaryButton>
          <SecondaryButton type="button" disabled={!canRedo} onClick={() => redo()}>
            Redo
          </SecondaryButton>
        </>
      }
    >
      {feedback ? <StatusBanner kind="info" message={feedback} /> : null}
      <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-300">
            Daily planner total:{' '}
            <span className="font-semibold text-white">
              {itineraryTotalCost.toFixed(2)} {trip.currency}
            </span>
          </p>
          {itineraryConflicts.length > 0 ? (
            <p className="text-sm text-amber-200">{itineraryConflicts.length} overlap conflict(s)</p>
          ) : (
            <p className="text-sm text-emerald-200">No time overlaps detected</p>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Title" htmlFor="stop-title">
          <input id="stop-title" className={inputClassName} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        </Field>
        <Field label="Date" htmlFor="stop-date">
          <input id="stop-date" type="date" className={inputClassName} value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
        </Field>
        <Field label="Start" htmlFor="stop-start">
          <input id="stop-start" type="time" className={inputClassName} value={draft.startTime} onChange={(e) => setDraft({ ...draft, startTime: e.target.value })} />
        </Field>
        <Field label="End" htmlFor="stop-end">
          <input id="stop-end" type="time" className={inputClassName} value={draft.endTime} onChange={(e) => setDraft({ ...draft, endTime: e.target.value })} />
        </Field>
        <Field label="Location" htmlFor="stop-location">
          <input id="stop-location" className={inputClassName} value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
        </Field>
        <Field label="Category" htmlFor="stop-category">
          <select
            id="stop-category"
            className={inputClassName}
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value as ItineraryCategory })}
          >
            {ITINERARY_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Cost" htmlFor="stop-cost">
          <input id="stop-cost" type="number" min={0} className={inputClassName} value={draft.cost} onChange={(e) => setDraft({ ...draft, cost: Number(e.target.value) })} />
        </Field>
        <Field label="Booking reference" htmlFor="stop-ref">
          <input id="stop-ref" className={inputClassName} value={draft.bookingReference} onChange={(e) => setDraft({ ...draft, bookingReference: e.target.value })} />
        </Field>
        <Field label="Latitude" htmlFor="stop-lat">
          <input id="stop-lat" className={inputClassName} value={draft.latitude} onChange={(e) => setDraft({ ...draft, latitude: e.target.value })} />
        </Field>
        <Field label="Longitude" htmlFor="stop-lon">
          <input id="stop-lon" className={inputClassName} value={draft.longitude} onChange={(e) => setDraft({ ...draft, longitude: e.target.value })} />
        </Field>
        <Field label="Supplier details" htmlFor="stop-supplier">
          <input id="stop-supplier" className={inputClassName} value={draft.supplierDetails} onChange={(e) => setDraft({ ...draft, supplierDetails: e.target.value })} />
        </Field>
        <div className="md:col-span-2 xl:col-span-4">
          <Field label="Notes" htmlFor="stop-notes">
            <textarea id="stop-notes" className={inputClassName} rows={2} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </Field>
        </div>
      </div>
      <div className="mt-3">
        <PrimaryButton type="button" onClick={handleAdd}>
          Add itinerary item
        </PrimaryButton>
      </div>

      <div className="mt-6 space-y-4">
        {itineraryDays.length === 0 ? (
          <EmptyState title="No itinerary items yet" body="Add your first activity to start building a day-by-day plan." />
        ) : (
          itineraryDays.map((day) => (
            <section key={day.date} className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-medium text-white">
                  {day.date.startsWith('day-') ? `Day ${day.day}` : day.date} · Day {day.day}
                </h4>
                <p className="text-sm text-slate-300">
                  Day total: {day.totalCost.toFixed(2)} {trip.currency}
                </p>
              </div>
              {day.conflicts.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-amber-200">
                  {day.conflicts.map((conflict) => (
                    <li key={`${conflict.leftId}-${conflict.rightId}`}>{conflict.message}</li>
                  ))}
                </ul>
              ) : null}
              <ul className="mt-3 space-y-3">
                {day.items.map((stop) => (
                  <li
                    key={stop.id}
                    draggable
                    onDragStart={() => setDragId(stop.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => handleDropOn(stop.id)}
                    className="rounded-xl border border-white/10 bg-slate-950/50 p-3"
                  >
                    {editDraft?.id === stop.id ? (
                      <div className="grid gap-2 md:grid-cols-2">
                        <input className={inputClassName} value={editDraft.title} onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })} />
                        <input className={inputClassName} value={editDraft.location} onChange={(e) => setEditDraft({ ...editDraft, location: e.target.value })} />
                        <input type="date" className={inputClassName} value={editDraft.date} onChange={(e) => setEditDraft({ ...editDraft, date: e.target.value })} />
                        <input type="time" className={inputClassName} value={editDraft.startTime} onChange={(e) => setEditDraft({ ...editDraft, startTime: e.target.value })} />
                        <input type="time" className={inputClassName} value={editDraft.endTime} onChange={(e) => setEditDraft({ ...editDraft, endTime: e.target.value })} />
                        <input type="number" className={inputClassName} value={editDraft.cost} onChange={(e) => setEditDraft({ ...editDraft, cost: Number(e.target.value) })} />
                        <textarea className={`${inputClassName} md:col-span-2`} value={editDraft.notes} onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })} />
                        <div className="flex gap-2 md:col-span-2">
                          <PrimaryButton type="button" onClick={handleSaveEdit}>
                            Save
                          </PrimaryButton>
                          <SecondaryButton type="button" onClick={() => setEditDraft(null)}>
                            Cancel
                          </SecondaryButton>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-slate-100">
                            {stop.title}
                            {stop.locked ? ' · locked' : ''}
                            {stop.aiGenerated ? ' · AI suggestion' : ''}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {[
                              stop.startTime && stop.endTime ? `${stop.startTime}–${stop.endTime}` : null,
                              stop.location,
                              stop.category,
                              stop.itemStatus,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                          <p className="mt-1 text-sm text-slate-300">{stop.notes || 'No notes'}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Cost {stop.cost.toFixed(2)} {stop.currency}
                            {stop.bookingReference ? ` · Ref ${stop.bookingReference}` : ''}
                            {stop.supplierDetails ? ` · ${stop.supplierDetails}` : ''}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <SecondaryButton type="button" onClick={() => reorderStop(stop.id, 'up')}>
                            Up
                          </SecondaryButton>
                          <SecondaryButton type="button" onClick={() => reorderStop(stop.id, 'down')}>
                            Down
                          </SecondaryButton>
                          <SecondaryButton
                            type="button"
                            onClick={() => {
                              toggleStopLock(stop.id);
                              setFeedback(stop.locked ? 'Item unlocked.' : 'Item locked.');
                            }}
                          >
                            {stop.locked ? 'Unlock' : 'Lock'}
                          </SecondaryButton>
                          <SecondaryButton type="button" onClick={() => setEditDraft(stop)} disabled={stop.locked}>
                            Edit
                          </SecondaryButton>
                          <SecondaryButton type="button" onClick={() => duplicateStop(stop.id)}>
                            Duplicate
                          </SecondaryButton>
                          <SecondaryButton type="button" onClick={() => deleteStop(stop.id)} disabled={stop.locked}>
                            Delete
                          </SecondaryButton>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </Panel>
  );
}
