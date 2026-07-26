import { useMemo, useState } from 'react';
import { AI_PLAN_MODES, type AiPlanMode, type AiTravelPlan } from '../../features/ai-planning/aiPlanning';
import { useSharedTripStore } from '../../store/TripStoreContext';
import { EmptyState, Field, Panel, PrimaryButton, SecondaryButton, StatusBanner, inputClassName } from './shared/ui';

export function AiPlanningPanel() {
  const {
    trip,
    generateAndPreviewAiPlan,
    applyAiTravelPlan,
    saveItineraryVersion,
    restoreItineraryVersion,
    canEditTrip,
  } = useSharedTripStore();
  const [mode, setMode] = useState<AiPlanMode>('complete');
  const [preview, setPreview] = useState<AiTravelPlan | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const versions = useMemo(() => trip.itineraryVersions ?? [], [trip.itineraryVersions]);

  return (
    <Panel
      title="AI travel planning"
      description="Generate and revise itineraries with a secure mock AI abstraction. Outputs are planning guidance only — never live inventory."
    >
      {feedback ? <StatusBanner kind="info" message={feedback} /> : null}
      <StatusBanner
        kind="info"
        message="AI-generated recommendations and mock provider results are clearly labelled and are not confirmed bookings."
      />

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <Field label="Plan mode" htmlFor="ai-plan-mode">
          <select
            id="ai-plan-mode"
            className={inputClassName}
            value={mode}
            onChange={(event) => setMode(event.target.value as AiPlanMode)}
          >
            {AI_PLAN_MODES.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </Field>
        <PrimaryButton
          type="button"
          onClick={() => {
            const plan = generateAndPreviewAiPlan(mode);
            setPreview(plan);
            setFeedback(`Preview ready: ${plan.label}`);
          }}
        >
          Generate preview
        </PrimaryButton>
        <SecondaryButton
          type="button"
          disabled={!canEditTrip}
          onClick={() => {
            saveItineraryVersion('Manual checkpoint');
            setFeedback('Saved current itinerary as a version checkpoint.');
          }}
        >
          Save version
        </SecondaryButton>
      </div>

      {preview ? (
        <article className="mt-4 space-y-3 rounded-2xl border border-amber-300/30 bg-amber-500/10 p-4 text-sm text-amber-50">
          <p className="font-medium text-white">
            {preview.label} · source {preview.source}
          </p>
          <p>{preview.disclaimer}</p>
          <p>Budget suggestion: {preview.budgetSuggestion.amount} {preview.budgetSuggestion.currency}</p>
          <p>{preview.weatherPlaceholder}</p>
          <ul className="list-disc space-y-1 pl-5">
            {preview.activityRecommendations.slice(0, 3).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <PrimaryButton
              type="button"
              disabled={!canEditTrip}
              onClick={() => {
                const result = applyAiTravelPlan(preview, { replaceUnlocked: true, saveVersion: true });
                setFeedback(result.message);
              }}
            >
              Apply (keep locked items)
            </PrimaryButton>
            <SecondaryButton type="button" onClick={() => setPreview(null)}>
              Dismiss preview
            </SecondaryButton>
          </div>
          <div className="space-y-2">
            {preview.days.map((day) => (
              <div key={day.day} className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                <p className="font-medium text-white">
                  {day.title} · {day.pace}
                </p>
                <ul className="mt-1 text-xs text-slate-300">
                  {day.items.map((item) => (
                    <li key={`${day.day}-${item.title}`}>
                      {item.startTime}–{item.endTime} · {item.title}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </article>
      ) : (
        <div className="mt-4">
          <EmptyState title="No AI preview yet" body="Choose a mode and generate a mock plan for this trip." />
        </div>
      )}

      <section className="mt-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-300">Itinerary versions</h3>
        {versions.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">No saved versions yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {versions.map((version) => (
              <li
                key={version.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm"
              >
                <span>
                  {version.label} · {version.source} · {new Date(version.createdAt).toLocaleString()} ·{' '}
                  {version.stops.length} item(s)
                </span>
                <SecondaryButton
                  type="button"
                  disabled={!canEditTrip}
                  onClick={() => {
                    restoreItineraryVersion(version.id);
                    setFeedback(`Restored ${version.label}.`);
                  }}
                >
                  Restore
                </SecondaryButton>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Panel>
  );
}
