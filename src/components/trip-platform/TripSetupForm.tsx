import { useEffect, useState } from 'react';
import {
  SUPPORTED_CURRENCIES,
  TRIP_PURPOSES,
  type TripSetupErrors,
  type TripSetupInput,
} from '../../store/tripDomain';
import { useSharedTripStore } from '../../store/TripStoreContext';
import { DatePickerField, todayIso } from '../ui/DatePickerField';
import { LocationAutocomplete } from '../ui/LocationAutocomplete';
import { Field, Panel, PrimaryButton, SecondaryButton, StatusBanner, inputClassName } from './shared/ui';

export function TripSetupForm() {
  const { trip, saveTripSetup, createDraftTrip, startNewTripDraft, canEditTrip } = useSharedTripStore();
  const [form, setForm] = useState<TripSetupInput>({
    tripName: trip.tripName,
    destination: trip.destination,
    departureDate: trip.departureDate,
    returnDate: trip.returnDate,
    travellerCount: trip.travellerCount,
    purpose: trip.purpose,
    budget: trip.budget,
    currency: trip.currency,
    notes: trip.notes,
    status: trip.status,
  });
  const [errors, setErrors] = useState<TripSetupErrors>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      tripName: trip.tripName,
      destination: trip.destination,
      departureDate: trip.departureDate,
      returnDate: trip.returnDate,
      travellerCount: trip.travellerCount,
      purpose: trip.purpose,
      budget: trip.budget,
      currency: trip.currency,
      notes: trip.notes,
      status: trip.status,
    });
  }, [trip]);

  const updateField = <K extends keyof TripSetupInput>(key: K, value: TripSetupInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSave = (asDraft: boolean) => {
    const result = asDraft
      ? createDraftTrip(form)
      : saveTripSetup({ ...form, status: form.status === 'draft' ? 'active' : form.status });
    setErrors(result.errors);
    setFeedback(result.ok ? (asDraft ? 'Draft trip saved locally.' : 'Trip details saved.') : 'Please fix the highlighted fields.');
  };

  return (
    <Panel
      title="Create or edit trip"
      description="Set up the core trip details. Everything saves into the existing local-first trip store."
      actions={
        <>
          <SecondaryButton type="button" disabled={!canEditTrip} onClick={() => startNewTripDraft()}>
            New blank trip
          </SecondaryButton>
          <SecondaryButton type="button" disabled={!canEditTrip} onClick={() => handleSave(true)}>
            Save draft
          </SecondaryButton>
          <PrimaryButton type="button" disabled={!canEditTrip} onClick={() => handleSave(false)}>
            Save trip
          </PrimaryButton>
        </>
      }
    >
      {feedback ? <StatusBanner kind={Object.keys(errors).length ? 'error' : 'success'} message={feedback} /> : null}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Trip name" htmlFor="trip-name" error={errors.tripName}>
          <input
            id="trip-name"
            className={inputClassName}
            value={form.tripName}
            onChange={(event) => updateField('tripName', event.target.value)}
          />
        </Field>
        <Field label="Destination" htmlFor="destination" error={errors.destination}>
          <LocationAutocomplete
            id="destination"
            mode="place"
            value={form.destination}
            onChange={(value) => updateField('destination', value)}
            placeholder="City, region, or landmark"
          />
        </Field>
        <Field label="Departure date" htmlFor="departure-date" error={errors.departureDate}>
          <DatePickerField
            id="departure-date"
            value={form.departureDate}
            min={todayIso()}
            onChange={(next) => {
              updateField('departureDate', next);
              if (form.returnDate && next && form.returnDate < next) updateField('returnDate', next);
            }}
          />
        </Field>
        <Field label="Return date" htmlFor="return-date" error={errors.returnDate}>
          <DatePickerField
            id="return-date"
            value={form.returnDate}
            min={form.departureDate || todayIso()}
            onChange={(next) => updateField('returnDate', next)}
          />
        </Field>
        <Field label="Traveller count" htmlFor="traveller-count" error={errors.travellerCount}>
          <input
            id="traveller-count"
            type="number"
            min={1}
            className={inputClassName}
            value={form.travellerCount}
            onChange={(event) => updateField('travellerCount', Number(event.target.value))}
          />
        </Field>
        <Field label="Trip purpose" htmlFor="purpose" error={errors.purpose}>
          <select
            id="purpose"
            className={inputClassName}
            value={form.purpose}
            onChange={(event) => updateField('purpose', event.target.value as TripSetupInput['purpose'])}
          >
            {TRIP_PURPOSES.map((purpose) => (
              <option key={purpose} value={purpose}>
                {purpose}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Budget" htmlFor="budget" error={errors.budget}>
          <input
            id="budget"
            type="number"
            min={0}
            step="0.01"
            className={inputClassName}
            value={form.budget}
            onChange={(event) => updateField('budget', Number(event.target.value))}
          />
        </Field>
        <Field label="Currency" htmlFor="currency" error={errors.currency}>
          <select
            id="currency"
            className={inputClassName}
            value={form.currency}
            onChange={(event) => updateField('currency', event.target.value)}
          >
            {SUPPORTED_CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </Field>
        <div className="md:col-span-2">
          <Field label="Notes" htmlFor="notes">
            <textarea
              id="notes"
              rows={4}
              className={inputClassName}
              value={form.notes}
              onChange={(event) => updateField('notes', event.target.value)}
            />
          </Field>
        </div>
      </div>
    </Panel>
  );
}
