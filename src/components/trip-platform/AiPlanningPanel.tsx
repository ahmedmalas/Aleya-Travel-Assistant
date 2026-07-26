import { useMemo, useRef, useState, type FormEvent } from 'react';
import type { AiPlanMode, AiTravelPlan } from '../../features/ai-planning/aiPlanning';
import { useSharedTripStore } from '../../store/TripStoreContext';
import { PrimaryButton, SecondaryButton, StatusBanner } from './shared/ui';

type ChatMessage = {
  id: string;
  role: 'user' | 'aleya';
  text: string;
  createdAt: string;
  plan?: AiTravelPlan;
};

const createId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

const inferMode = (message: string): AiPlanMode => {
  const value = message.toLowerCase();
  if (/revise|change|replace|remove|swap|update|different|less|more|shorter|longer/.test(value)) return 'revise';
  if (/relax|slow|easy|rest|quiet|light/.test(value)) return 'relaxed';
  if (/busy|full|packed|maximum|everything|complete|whole trip|day by day/.test(value)) return 'complete';
  return 'complete';
};

const needsTripDetails = (message: string, destination: string) => {
  const value = message.trim().toLowerCase();
  const hasTravelIntent = /plan|trip|holiday|vacation|itinerary|travel|go to|visit|honeymoon|weekend/.test(value);
  const hasPlace = destination.trim().length > 0 || /\b(?:to|in|visit)\s+[a-z][a-z\s-]{2,}/i.test(message);
  return hasTravelIntent && !hasPlace;
};

const formatPlanReply = (plan: AiTravelPlan, request: string) => {
  const days = plan.days.length;
  const activities = plan.days.reduce((total, day) => total + day.items.length, 0);
  const budget = `${plan.budgetSuggestion.amount.toLocaleString('en-AU')} ${plan.budgetSuggestion.currency}`;
  return `I’ve created a ${days}-day plan based on “${request}”. It includes ${activities} scheduled ideas with an estimated planning budget of ${budget}. Review it below, ask me to change anything, or add it to your trip.`;
};

const STARTERS = [
  'Plan a two-week Japan trip in October',
  'Build a luxury family holiday within $12,000 AUD',
  'Make my itinerary more relaxed',
  'What should I organise before departure?',
];

export function AiPlanningPanel() {
  const {
    trip,
    generateAndPreviewAiPlan,
    applyAiTravelPlan,
    saveItineraryVersion,
    restoreItineraryVersion,
    canEditTrip,
  } = useSharedTripStore();
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: createId(),
      role: 'aleya',
      text: `Hi${trip.travellers?.[0]?.name ? ` ${trip.travellers[0].name}` : ''}. Tell me what kind of trip you want, what you would like changed, or anything you need help researching. You can speak naturally—I’ll guide the planning from there.`,
      createdAt: new Date().toISOString(),
    },
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const versions = useMemo(() => trip.itineraryVersions ?? [], [trip.itineraryVersions]);

  const sendMessage = (event?: FormEvent) => {
    event?.preventDefault();
    const request = input.trim();
    if (!request) return;

    const userMessage: ChatMessage = { id: createId(), role: 'user', text: request, createdAt: new Date().toISOString() };
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setFeedback(null);

    if (needsTripDetails(request, trip.destination ?? '')) {
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: 'aleya',
          text: 'Absolutely. Which destination or countries are you considering? You can also include your dates, budget, travellers, preferred pace, accommodation style, interests, dietary needs, and anything you want me to avoid.',
          createdAt: new Date().toISOString(),
        },
      ]);
      window.setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);
      return;
    }

    const mode = inferMode(request);
    const plan = generateAndPreviewAiPlan(mode);
    setMessages((current) => [
      ...current,
      {
        id: createId(),
        role: 'aleya',
        text: formatPlanReply(plan, request),
        createdAt: new Date().toISOString(),
        plan,
      },
    ]);
    window.setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);
  };

  const submitStarter = (starter: string) => {
    setInput(starter);
    window.setTimeout(() => document.getElementById('aleya-chat-input')?.focus(), 0);
  };

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-sky-950/50 shadow-2xl shadow-sky-950/30" aria-labelledby="aleya-assistant-title">
      <header className="border-b border-white/10 px-5 py-5 md:px-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">Your personal travel assistant</p>
            <h2 id="aleya-assistant-title" className="mt-2 text-3xl font-bold text-white">Ask Aleya</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Plan a complete journey, compare ideas, revise an itinerary, work within a budget, prepare documents, or ask a travel question in your own words.</p>
          </div>
          <span className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200">Ready to help</span>
        </div>
      </header>

      {feedback ? <div className="px-5 pt-4 md:px-7"><StatusBanner kind="info" message={feedback} /></div> : null}

      <div className="max-h-[680px] min-h-[420px] space-y-5 overflow-y-auto px-4 py-6 md:px-7" aria-live="polite">
        {messages.map((message) => (
          <article key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-3xl ${message.role === 'user' ? 'rounded-3xl rounded-br-md bg-sky-400 px-5 py-3 text-slate-950' : 'rounded-3xl rounded-bl-md border border-white/10 bg-white/[0.05] px-5 py-4 text-slate-100'}`}>
              {message.role === 'aleya' ? <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Aleya</p> : null}
              <p className="whitespace-pre-wrap text-sm leading-6">{message.text}</p>

              {message.plan ? (
                <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-slate-950/50 p-3"><p className="text-xs text-slate-400">Days</p><p className="mt-1 text-xl font-semibold text-white">{message.plan.days.length}</p></div>
                    <div className="rounded-2xl bg-slate-950/50 p-3"><p className="text-xs text-slate-400">Estimated budget</p><p className="mt-1 font-semibold text-white">{message.plan.budgetSuggestion.amount.toLocaleString('en-AU')} {message.plan.budgetSuggestion.currency}</p></div>
                    <div className="rounded-2xl bg-slate-950/50 p-3"><p className="text-xs text-slate-400">Plan style</p><p className="mt-1 font-semibold capitalize text-white">{message.plan.label}</p></div>
                  </div>

                  <div className="space-y-2">
                    {message.plan.days.slice(0, 4).map((day) => (
                      <div key={day.day} className="rounded-2xl border border-white/10 bg-slate-950/35 p-3">
                        <p className="font-medium text-white">{day.title}</p>
                        <p className="mt-1 text-xs text-slate-400">{day.items.map((item) => item.title).join(' · ')}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <PrimaryButton type="button" disabled={!canEditTrip} onClick={() => {
                      const result = applyAiTravelPlan(message.plan!, { replaceUnlocked: true, saveVersion: true });
                      setFeedback(result.message);
                    }}>Add this plan to my trip</PrimaryButton>
                    <SecondaryButton type="button" onClick={() => {
                      setInput('Please revise this plan: ');
                      document.getElementById('aleya-chat-input')?.focus();
                    }}>Ask for changes</SecondaryButton>
                  </div>
                  <p className="text-xs leading-5 text-slate-400">Recommendations are planning guidance. Prices, availability, schedules, entry rules and bookings must be checked with the relevant official or live provider before purchase.</p>
                </div>
              ) : null}
            </div>
          </article>
        ))}
        <div ref={chatEndRef} />
      </div>

      {messages.length === 1 ? (
        <div className="px-5 pb-4 md:px-7">
          <p className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-400">Try asking</p>
          <div className="flex flex-wrap gap-2">
            {STARTERS.map((starter) => <button key={starter} type="button" onClick={() => submitStarter(starter)} className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-2 text-left text-xs text-slate-200 hover:border-sky-300 hover:text-white">{starter}</button>)}
          </div>
        </div>
      ) : null}

      <form onSubmit={sendMessage} className="border-t border-white/10 bg-slate-950/70 p-4 md:p-5">
        <label className="sr-only" htmlFor="aleya-chat-input">Ask Aleya about your trip</label>
        <div className="flex items-end gap-3 rounded-3xl border border-white/15 bg-slate-950 px-4 py-3 focus-within:border-sky-300/70 focus-within:ring-2 focus-within:ring-sky-300/20">
          <textarea id="aleya-chat-input" rows={2} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              sendMessage();
            }
          }} placeholder="Ask Aleya to plan, research, compare or change anything about your trip…" className="min-h-12 flex-1 resize-none bg-transparent text-sm leading-6 text-white outline-none placeholder:text-slate-500" />
          <button type="submit" disabled={!input.trim()} className="rounded-full bg-sky-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-40">Send</button>
        </div>
        <p className="mt-2 px-2 text-xs text-slate-500">Press Enter to send · Shift + Enter for a new line</p>
      </form>

      {versions.length > 0 ? (
        <details className="border-t border-white/10 px-5 py-4 md:px-7">
          <summary className="cursor-pointer text-sm font-medium text-slate-300">Previous itinerary versions ({versions.length})</summary>
          <ul className="mt-3 space-y-2">
            {versions.map((version) => (
              <li key={version.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-slate-300">
                <span>{version.label} · {new Date(version.createdAt).toLocaleString('en-AU')} · {version.stops.length} items</span>
                <SecondaryButton type="button" disabled={!canEditTrip} onClick={() => {
                  restoreItineraryVersion(version.id);
                  setFeedback(`Restored ${version.label}.`);
                }}>Restore</SecondaryButton>
              </li>
            ))}
          </ul>
        </details>
      ) : (
        <div className="border-t border-white/10 px-5 py-3 text-right md:px-7">
          <button type="button" disabled={!canEditTrip} onClick={() => {
            saveItineraryVersion('Saved by traveller');
            setFeedback('Your current itinerary has been saved.');
          }} className="text-xs text-slate-400 hover:text-sky-200 disabled:opacity-40">Save current itinerary</button>
        </div>
      )}
    </section>
  );
}
