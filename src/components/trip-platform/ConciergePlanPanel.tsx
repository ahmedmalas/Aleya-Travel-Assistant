import { useMemo, useState } from 'react';
import { useSharedTripStore } from '../../store/TripStoreContext';
import { Field, Panel, PrimaryButton, SecondaryButton, StatusBanner, inputClassName } from './shared/ui';

type ConciergeMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  recommendation?: { title: string; detail: string };
};

type ConciergeWorkspace = {
  goals: string;
  constraints: string;
  pace: string;
  mustDo: string;
  avoid: string;
  restaurants: string;
  transport: string;
  accessibility: string;
  family: string;
  occasions: string;
  backupPlans: string;
  emergencyAlternatives: string;
  bookingChecklist: string;
  unresolved: string;
  approvalState: 'draft' | 'pending' | 'approved';
};

const emptyWorkspace = (): ConciergeWorkspace => ({
  goals: '',
  constraints: '',
  pace: 'balanced',
  mustDo: '',
  avoid: '',
  restaurants: '',
  transport: '',
  accessibility: '',
  family: '',
  occasions: '',
  backupPlans: '',
  emergencyAlternatives: '',
  bookingChecklist: '',
  unresolved: '',
  approvalState: 'draft',
});

function buildResponse(question: string, tripName: string, destination: string, workspace: ConciergeWorkspace): ConciergeMessage {
  const q = question.toLowerCase();
  let title = 'Trip planning suggestion';
  let detail =
    'I can help organise flights, stays, itinerary days, transport, dining, and local activities. Live supplier inventory is not connected — recommendations are planning guidance only.';

  if (q.includes('flight') || q.includes('airport')) {
    title = 'Flight planning';
    detail = `For ${destination || 'your trip'}, set origin/destination with airport autocomplete, pick dates on the calendar, then save the search to the Flights workspace. Compare options externally and store the chosen segment here.`;
  } else if (q.includes('hotel') || q.includes('stay') || q.includes('accommodation')) {
    title = 'Hotel planning';
    detail = `Use Hotels to capture destination, check-in/out, guests, and preferences for ${tripName || 'this trip'}. Save the plan, then attach a confirmation once you book.`;
  } else if (q.includes('itinerary') || q.includes('day') || q.includes('schedule')) {
    title = 'Itinerary creation';
    detail = `Open Itinerary or AI Planning. Pace preference: ${workspace.pace || 'balanced'}. Must-do: ${workspace.mustDo || 'none listed yet'}.`;
  } else if (q.includes('restaurant') || q.includes('food') || q.includes('dining')) {
    title = 'Dining ideas';
    detail = `Restaurant notes: ${workspace.restaurants || 'none yet'}. Shortlist neighbourhood restaurants near ${destination || 'your base'} and add dinner blocks to the itinerary. Not a live reservation system.`;
  } else if (q.includes('transfer') || q.includes('taxi') || q.includes('transport') || q.includes('train')) {
    title = 'Transport planning';
    detail = `Transport notes: ${workspace.transport || 'none yet'}. Use Transport / Move services to capture pickup, drop-off, mode, and timing.`;
  } else if (q.includes('accessib')) {
    title = 'Accessibility planning';
    detail = `Accessibility requirements: ${workspace.accessibility || 'none listed'}. Prefer step-free transfers, rest buffers, and accessible lodging notes.`;
  } else if (q.includes('family')) {
    title = 'Family requirements';
    detail = `Family notes: ${workspace.family || 'none listed'}. Keep transitions short and include shared downtime.`;
  } else if (q.includes('backup') || q.includes('emergency')) {
    title = 'Backup / emergency alternatives';
    detail = `Backup plans: ${workspace.backupPlans || 'none'}. Emergency alternatives: ${workspace.emergencyAlternatives || 'none'}.`;
  } else if (q.includes('cruise')) {
    title = 'Cruise planning';
    detail = 'Record sailing window, ports, cabin preferences, and budget in Travel services → Cruises, then add sea days to the itinerary.';
  } else if (q.includes('budget') || q.includes('cost') || q.includes('money')) {
    title = 'Budget organisation';
    detail = 'Track estimates in Budget and mark planned vs confirmed spend. No live fare quotes are shown here.';
  } else if (q.includes('nearby') || q.includes('activity') || q.includes('things to do')) {
    title = 'Nearby recommendations';
    detail = `Based on ${destination || 'your destination'}, add morning/afternoon activity blocks, keep travel times realistic, and pin places in Maps. Avoid list: ${workspace.avoid || 'none'}.`;
  }

  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    text: detail,
    recommendation: { title, detail },
  };
}

export function ConciergePlanPanel() {
  const { activeVaultTrip, addStop, canEditTrip, updateVaultTripMeta } = useSharedTripStore();
  const [question, setQuestion] = useState('');
  const [workspace, setWorkspace] = useState<ConciergeWorkspace>(() => {
    try {
      const match = /\[concierge-workspace\]([\s\S]*?)\[\/concierge-workspace\]/.exec(activeVaultTrip.notes || '');
      if (match?.[1]) return { ...emptyWorkspace(), ...(JSON.parse(match[1]) as ConciergeWorkspace) };
    } catch {
      // ignore
    }
    return emptyWorkspace();
  });
  const [messages, setMessages] = useState<ConciergeMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Ask about flights, hotels, itineraries, transport, dining, accessibility, family needs, backups, or budgets. Recommendations are planning guidance — not confirmed bookings.',
    },
  ]);
  const [feedback, setFeedback] = useState<string | null>(null);

  const contextLabel = useMemo(
    () =>
      [activeVaultTrip.tripName, activeVaultTrip.destination].filter(Boolean).join(' · ') || 'No active trip details yet',
    [activeVaultTrip.destination, activeVaultTrip.tripName],
  );

  const persistWorkspace = () => {
    const stripped = (activeVaultTrip.notes || '').replace(
      /\[concierge-workspace\][\s\S]*?\[\/concierge-workspace\]/g,
      '',
    );
    const notes = `${stripped.trim()}\n\n[concierge-workspace]${JSON.stringify(workspace)}[/concierge-workspace]`.trim();
    updateVaultTripMeta(activeVaultTrip.id, { notes });
    setFeedback('Concierge workspace saved to trip notes.');
  };

  const ask = () => {
    const trimmed = question.trim();
    if (!trimmed) return;
    const userMessage: ConciergeMessage = { id: crypto.randomUUID(), role: 'user', text: trimmed };
    const assistant = buildResponse(trimmed, activeVaultTrip.tripName, activeVaultTrip.destination, workspace);
    setMessages((current) => [...current, userMessage, assistant]);
    setQuestion('');
    setFeedback(null);
  };

  const saveRecommendation = (message: ConciergeMessage) => {
    if (!message.recommendation || !canEditTrip) return;
    addStop({
      title: message.recommendation.title,
      location: activeVaultTrip.destination || 'To decide',
      date: activeVaultTrip.departureDate || '',
      category: 'activity',
      notes: `${message.recommendation.detail}\n\n(Source: Concierge Plan recommendation — not a confirmed booking.)`,
      currency: activeVaultTrip.currency,
      aiGenerated: true,
    });
    setFeedback('Recommendation saved into the itinerary as a planning item.');
  };

  return (
    <Panel
      title="Concierge Plan"
      description="Full concierge workspace: goals, constraints, must-dos, dining/transport/accessibility planning, backups, checklist, and approvals. Recommendations are planning-only."
    >
      <p className="mb-3 text-xs uppercase tracking-[0.16em] text-slate-400">Trip context: {contextLabel}</p>
      {feedback ? <StatusBanner kind="success" message={feedback} /> : null}

      <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(
          [
            ['goals', 'Traveller goals'],
            ['constraints', 'Travel constraints'],
            ['pace', 'Preferred pace'],
            ['mustDo', 'Must-do activities'],
            ['avoid', 'Avoid list'],
            ['restaurants', 'Restaurant planning'],
            ['transport', 'Transport planning'],
            ['accessibility', 'Accessibility planning'],
            ['family', 'Family requirements'],
            ['occasions', 'Special occasions'],
            ['backupPlans', 'Backup plans'],
            ['emergencyAlternatives', 'Emergency alternatives'],
            ['bookingChecklist', 'Booking checklist'],
            ['unresolved', 'Unresolved decisions'],
          ] as Array<[keyof ConciergeWorkspace, string]>
        ).map(([key, label]) => (
          <Field key={key} label={label} htmlFor={`concierge-${key}`}>
            <textarea
              id={`concierge-${key}`}
              className={`${inputClassName} min-h-20`}
              value={String(workspace[key] ?? '')}
              onChange={(event) => setWorkspace({ ...workspace, [key]: event.target.value })}
            />
          </Field>
        ))}
        <Field label="Approval state" htmlFor="concierge-approval">
          <select
            id="concierge-approval"
            className={inputClassName}
            value={workspace.approvalState}
            onChange={(event) =>
              setWorkspace({ ...workspace, approvalState: event.target.value as ConciergeWorkspace['approvalState'] })
            }
          >
            <option value="draft">Draft</option>
            <option value="pending">Pending approval</option>
            <option value="approved">Approved</option>
          </select>
        </Field>
      </section>
      <PrimaryButton type="button" onClick={persistWorkspace} disabled={!canEditTrip}>
        Save concierge workspace
      </PrimaryButton>

      <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
        {messages.map((message) => (
          <article
            key={message.id}
            className={`rounded-2xl p-3 text-sm ${
              message.role === 'user' ? 'bg-slate-900 text-slate-100' : 'bg-sky-400/10 text-sky-50'
            }`}
          >
            <p>{message.text}</p>
            {message.recommendation && canEditTrip ? (
              <SecondaryButton className="mt-3" type="button" onClick={() => saveRecommendation(message)}>
                Convert recommendation to itinerary item
              </SecondaryButton>
            ) : null}
          </article>
        ))}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
        <Field label="Ask the concierge" htmlFor="concierge-question">
          <input
            id="concierge-question"
            className={inputClassName}
            value={question}
            placeholder="e.g. Help me plan an accessible family day with backup options"
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') ask();
            }}
          />
        </Field>
        <div className="flex items-end">
          <PrimaryButton type="button" onClick={ask}>
            Ask
          </PrimaryButton>
        </div>
      </div>
    </Panel>
  );
}
