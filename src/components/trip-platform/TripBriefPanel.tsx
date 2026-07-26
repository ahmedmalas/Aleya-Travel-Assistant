import { useMemo, useState } from 'react';
import {
  budgetStyles,
  defaultTripBrief,
  interestTags,
  type DraftPlan,
  type InterestTag,
  type TripBriefInput,
  type TripBriefValidationErrors,
} from '../../features/trip-brief/models';
import { mapTripBriefToDraftPlan } from '../../features/trip-brief/tripBrief.mapper';
import { hasTripBriefErrors, validateTripBrief } from '../../features/trip-brief/tripBrief.validation';
import { useSharedTripStore } from '../../store/TripStoreContext';
import { DatePickerField, todayIso } from '../ui/DatePickerField';
import { LocationAutocomplete } from '../ui/LocationAutocomplete';
import { Field, Panel, PrimaryButton, SecondaryButton, StatusBanner, inputClassName } from './shared/ui';

function toLabel(value: string): string {
  return `${value[0]!.toUpperCase()}${value.slice(1)}`;
}

export function TripBriefPanel() {
  const { applyDraftPlanToActiveTrip, cloudRuntime, authState } = useSharedTripStore();
  const [brief, setBrief] = useState<TripBriefInput>(defaultTripBrief);
  const [errors, setErrors] = useState<TripBriefValidationErrors>({});
  const [plan, setPlan] = useState<DraftPlan | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const today = useMemo(() => todayIso(), []);

  const updateInterest = (interest: InterestTag, checked: boolean) => {
    setBrief((current) => ({
      ...current,
      interests: checked
        ? [...current.interests, interest]
        : current.interests.filter((item) => item !== interest),
    }));
  };

  const generate = () => {
    const nextErrors = validateTripBrief(brief);
    setErrors(nextErrors);
    if (hasTripBriefErrors(nextErrors)) {
      setFeedback('Fix the brief fields before generating a draft plan.');
      return;
    }
    setPlan(mapTripBriefToDraftPlan(brief));
    setFeedback('Draft plan generated locally from your brief.');
  };

  const apply = () => {
    if (!plan) return;
    const result = applyDraftPlanToActiveTrip(plan, brief);
    setFeedback(result.message);
  };

  return (
    <Panel
      title="Trip brief → draft plan"
      description="Capture traveler intent and generate a structured planning baseline. No live inventory or LLM calls — deterministic mapping only."
    >
      {feedback ? <StatusBanner kind="info" message={feedback} /> : null}
      <p className="mt-3 text-sm text-slate-300">
        Cloud:{' '}
        <span className="text-white">{cloudRuntime.clientConfigured ? 'configured' : 'local cache'}</span>
        {' · '}
        Session: <span className="text-white">{authState.mode}</span>
        {cloudRuntime.remoteMigrationsApplied ? ' · schema applied' : ' · schema pending'}
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Field label="Destination" htmlFor="brief-destination">
            <LocationAutocomplete
              id="brief-destination"
              mode="place"
              placeholder="e.g. Tokyo, Japan"
              value={brief.destination}
              onChange={(value) => setBrief({ ...brief, destination: value })}
            />
            {errors.destination ? <span className="mt-1 block text-xs text-rose-300">{errors.destination}</span> : null}
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Start date" htmlFor="brief-start">
              <DatePickerField
                id="brief-start"
                value={brief.startDate}
                min={today}
                onChange={(next) => {
                  setBrief((current) => ({
                    ...current,
                    startDate: next,
                    endDate: current.endDate && next && current.endDate < next ? next : current.endDate,
                  }));
                }}
              />
              {errors.startDate ? <span className="mt-1 block text-xs text-rose-300">{errors.startDate}</span> : null}
            </Field>
            <Field label="End date" htmlFor="brief-end">
              <DatePickerField
                id="brief-end"
                value={brief.endDate}
                min={brief.startDate || today}
                onChange={(next) => setBrief({ ...brief, endDate: next })}
              />
              {errors.endDate ? <span className="mt-1 block text-xs text-rose-300">{errors.endDate}</span> : null}
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Travelers" htmlFor="brief-travelers">
              <input
                id="brief-travelers"
                type="number"
                min={1}
                className={inputClassName}
                value={brief.travelers}
                onChange={(e) => setBrief({ ...brief, travelers: Number(e.target.value) })}
              />
              {errors.travelers ? <span className="mt-1 block text-xs text-rose-300">{errors.travelers}</span> : null}
            </Field>
            <Field label="Budget style" htmlFor="brief-budget">
              <select
                id="brief-budget"
                className={inputClassName}
                value={brief.budgetStyle}
                onChange={(e) =>
                  setBrief({ ...brief, budgetStyle: e.target.value as TripBriefInput['budgetStyle'] })
                }
              >
                {budgetStyles.map((style) => (
                  <option key={style} value={style}>
                    {toLabel(style)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <fieldset>
            <legend className="text-sm text-slate-200">Interests</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {interestTags.map((tag) => (
                <label
                  key={tag}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                >
                  <input
                    type="checkbox"
                    checked={brief.interests.includes(tag)}
                    onChange={(e) => updateInterest(tag, e.target.checked)}
                  />
                  <span>{toLabel(tag)}</span>
                </label>
              ))}
            </div>
            {errors.interests ? <span className="mt-1 block text-xs text-rose-300">{errors.interests}</span> : null}
          </fieldset>
          <Field label="Notes (optional)" htmlFor="brief-notes">
            <textarea
              id="brief-notes"
              rows={3}
              className={inputClassName}
              value={brief.notes}
              onChange={(e) => setBrief({ ...brief, notes: e.target.value })}
            />
          </Field>
          <PrimaryButton type="button" onClick={generate}>
            Generate draft plan
          </PrimaryButton>
        </div>

        <div>
          {!plan ? (
            <div className="rounded-2xl border border-dashed border-white/20 bg-slate-900/40 p-6 text-sm text-slate-300">
              Submit a trip brief to generate your first draft plan.
            </div>
          ) : (
            <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-300">Draft plan</p>
              <h3 className="mt-3 text-xl font-semibold text-white">{plan.title}</h3>
              <p className="mt-2 text-sm text-slate-300">
                {plan.travelers} traveler{plan.travelers === 1 ? '' : 's'} · {toLabel(plan.budgetStyle)} ·{' '}
                {toLabel(plan.dailyPace)} pace
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <section>
                  <h4 className="text-xs uppercase tracking-[0.2em] text-sky-200">Pillars</h4>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-200">
                    {plan.tripPillars.map((pillar) => (
                      <li key={pillar}>{pillar}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h4 className="text-xs uppercase tracking-[0.2em] text-sky-200">Next steps</h4>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-200">
                    {plan.nextSteps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                </section>
              </div>
              <section className="mt-4">
                <h4 className="text-xs uppercase tracking-[0.2em] text-sky-200">Suggested days</h4>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-200">
                  {plan.suggestedDays.map((day) => (
                    <li key={day}>{day}</li>
                  ))}
                </ol>
              </section>
              <div className="mt-5 flex flex-wrap gap-2">
                <PrimaryButton type="button" onClick={apply}>
                  Apply to active trip
                </PrimaryButton>
                <SecondaryButton type="button" onClick={() => setPlan(null)}>
                  Clear draft
                </SecondaryButton>
              </div>
            </article>
          )}
        </div>
      </div>
    </Panel>
  );
}
