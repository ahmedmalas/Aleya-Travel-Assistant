import { useMemo, useState } from 'react';
import { processConversationTurn } from '../../features/conversation-core';
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

  const ask = async () => {
    const trimmed = question.trim();
    if (!trimmed) return;
    const userMessage: ConciergeMessage = { id: crypto.randomUUID(), role: 'user', text: trimmed };
    setQuestion('');
    setFeedback(null);
    const result = processConversationTurn({
      message: trimmed,
      conversationId: crypto.randomUUID(),
      now: new Date(),
    });
    const assistant: ConciergeMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      text: result.reply,
      recommendation: {
        title: 'Conversation engine not assembled',
        detail: result.reply,
      },
    };
    setMessages((current) => [...current, userMessage, assistant]);
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
              if (event.key === 'Enter') void ask();
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
