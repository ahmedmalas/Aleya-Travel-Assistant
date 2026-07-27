import { useCanonicalTravelState } from './canonicalStore';
import { projectRequirementsSummary } from './projectors';

/** Live requirements card bound to the canonical ConversationState. */
export function RequirementsSummary() {
  const state = useCanonicalTravelState();
  const view = projectRequirementsSummary(state);
  const hasAnything =
    view.origin ||
    view.destination ||
    view.departing ||
    view.returning ||
    view.accommodation ||
    view.duration ||
    view.services.length > 0;

  if (!hasAnything) return null;

  const rows: Array<{ label: string; value: string }> = [];
  if (view.origin) rows.push({ label: 'From', value: view.origin });
  if (view.destination) rows.push({ label: 'To', value: view.destination });
  if (view.departing) rows.push({ label: 'Departing', value: view.departing });
  if (view.returning) rows.push({ label: 'Returning', value: view.returning });
  if (view.accommodation) rows.push({ label: 'Accommodation', value: view.accommodation });
  if (view.duration) rows.push({ label: 'Duration', value: view.duration });
  if (view.serviceLabels.length) {
    rows.push({
      label: 'Services',
      value: view.serviceLabels.join(', '),
    });
  }

  return (
    <aside
      className="border-b border-white/10 bg-slate-950/50 px-5 py-4 md:px-7"
      aria-label="Saved travel requirements"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Saved requirements</p>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="flex gap-2 text-sm">
            <dt className="shrink-0 text-slate-400">{row.label}:</dt>
            <dd className="font-medium text-slate-100">{row.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
