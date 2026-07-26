import { useMemo, useRef, useState, type FormEvent } from 'react';
import type { AiPlanMode, AiTravelPlan } from '../../features/ai-planning/aiPlanning';
import { detectUserCurrency } from '../../lib/currency';
import { useSharedTripStore } from '../../store/TripStoreContext';
import { PrimaryButton, SecondaryButton, StatusBanner } from './shared/ui';

type ChatMessage = {
  id: string;
  role: 'user' | 'aleya';
  text: string;
  createdAt: string;
  plan?: AiTravelPlan;
};

const PROFILE_STORAGE_KEY = 'aleya-travel:user-profile:v1';
const createId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

const getTravellerCurrency = () => {
  try {
    const stored = localStorage.getItem(PROFILE_STORAGE_KEY);
    const savedCurrency = stored ? (JSON.parse(stored) as { currency?: string }).currency : '';
    return savedCurrency?.trim().toUpperCase() || detectUserCurrency();
  } catch {
    return detectUserCurrency();
  }
};

const inferMode = (message: string): AiPlanMode => {
  const value = message.toLowerCase();
  if (/family|children|kids|child|parents/.test(value)) return 'family';
  if (/accessible|accessibility|wheelchair|mobility|step-free/.test(value)) return 'accessible';
  if (/business|work|meeting|conference/.test(value)) return 'business';
  if (/romantic|honeymoon|anniversary|couple/.test(value)) return 'romantic';
  if (/adventure|hike|outdoor|active|thrill/.test(value)) return 'adventure';
  if (/cheap|budget|low cost|save money|affordable/.test(value)) return 'low-cost';
  if (/luxury|premium|five star|first class/.test(value)) return 'luxury';
  if (/relax|slow|easy|rest|quiet|light|leisure/.test(value)) return 'leisure';
  return 'complete';
};

const isGreeting = (message: string) => /^(hi|hello|hey|good morning|good afternoon|good evening|hiya|hi aleya|hello aleya)[!,.\s]*$/i.test(message.trim());
const isThanks = (message: string) => /^(thanks|thank you|thankyou|cheers|great|perfect|okay thanks)[!,.\s]*$/i.test(message.trim());
const isCapabilityQuestion = (message: string) => /what can you do|how can you help|who are you|what are you/i.test(message);
const hasPlanningIntent = (message: string) => /\b(plan|build|create|make|design|organise|organize|prepare|revise|change|improve)\b.*\b(trip|holiday|vacation|journey|itinerary|travel|honeymoon|weekend)\b|\b(itinerary|trip plan|travel plan)\b/i.test(message);
const hasDestination = (message: string, destination: string) => destination.trim().length > 0 || /\b(?:to|in|visit|visiting|going to)\s+[a-z][a-z\s-]{2,}/i.test(message);

const formatPlanReply = (plan: AiTravelPlan, request: string) => {
  const budget = `${plan.budgetSuggestion.amount.toLocaleString('en-AU')} ${plan.budgetSuggestion.currency}`;
  return `I’ve prepared a ${plan.days.length}-day starting plan based on “${request}”, using an estimated budget of ${budget}. Have a look and tell me what you want changed.`;
};

const STARTERS = [
  'I want to visit Japan next April',
  'Find me affordable flights to Bali',
  'Do Australians need a visa for Vietnam?',
  'Build a luxury Europe itinerary in AUD',
];

export function AiPlanningPanel() {
  const { trip, generateAndPreviewAiPlan, applyAiTravelPlan, saveItineraryVersion, restoreItineraryVersion, canEditTrip } = useSharedTripStore();
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: createId(),
      role: 'aleya',
      text: `Hi${trip.travellers?.[0]?.name ? ` ${trip.travellers[0].name}` : ''}. How can I help with your travel today?`,
      createdAt: new Date().toISOString(),
    },
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const versions = useMemo(() => trip.itineraryVersions ?? [], [trip.itineraryVersions]);

  const reply = (text: string, plan?: AiTravelPlan) => {
    setMessages((current) => [...current, { id: createId(), role: 'aleya', text, createdAt: new Date().toISOString(), plan }]);
    window.setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);
  };

  const sendMessage = (event?: FormEvent) => {
    event?.preventDefault();
    const request = input.trim();
    if (!request) return;

    setMessages((current) => [...current, { id: createId(), role: 'user', text: request, createdAt: new Date().toISOString() }]);
    setInput('');
    setFeedback(null);

    if (isGreeting(request)) {
      reply(`Hi${trip.travellers?.[0]?.name ? ` ${trip.travellers[0].name}` : ''}! What are we working on today—flights, hotels, visas, an itinerary, or another travel question?`);
      return;
    }
    if (isThanks(request)) {
      reply('You’re welcome. What would you like to do next?');
      return;
    }
    if (isCapabilityQuestion(request)) {
      reply('I can help you research destinations, compare travel options, understand visa requirements, plan an itinerary, work within a budget, organise bookings, and revise plans through normal conversation.');
      return;
    }
    if (!hasPlanningIntent(request)) {
      reply('I understand. Tell me a little more about what you need, and I’ll help without creating an itinerary unless you ask me to.');
      return;
    }
    if (!hasDestination(request, trip.destination ?? '')) {
      reply('Absolutely. Which destination or countries are you considering? You can also include your dates, departure city, travellers, budget and preferred pace.');
      return;
    }

    const travellerCurrency = getTravellerCurrency();
    const generated = generateAndPreviewAiPlan(inferMode(request));
    const plan: AiTravelPlan = {
      ...generated,
      budgetSuggestion: { ...generated.budgetSuggestion, currency: travellerCurrency },
    };
    reply(formatPlanReply(plan, request), plan);
  };

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-sky-950/50 shadow-2xl shadow-sky-950/30" aria-labelledby="aleya-assistant-title">
      <header className="border-b border-white/10 px-5 py-5 md:px-7">
        <h2 id="aleya-assistant-title" className="text-3xl font-bold text-white">Aleya AI Assistant</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">Ask naturally. Aleya will listen first and only create plans when you request one.</p>
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
                    {message.plan.days.slice(0, 4).map((day) => <div key={day.day} className="rounded-2xl border border-white/10 bg-slate-950/35 p-3"><p className="font-medium text-white">{day.title}</p><p className="mt-1 text-xs text-slate-400">{day.items.map((item) => item.title).join(' · ')}</p></div>)}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <PrimaryButton type="button" disabled={!canEditTrip} onClick={() => setFeedback(applyAiTravelPlan(message.plan!, { replaceUnlocked: true, saveVersion: true }).message)}>Add this plan to my trip</PrimaryButton>
                    <SecondaryButton type="button" onClick={() => { setInput('Please revise this plan: '); document.getElementById('aleya-chat-input')?.focus(); }}>Ask for changes</SecondaryButton>
                  </div>
                </div>
              ) : null}
            </div>
          </article>
        ))}
        <div ref={chatEndRef} />
      </div>

      {messages.length === 1 ? <div className="px-5 pb-4 md:px-7"><p className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-400">Try asking</p><div className="flex flex-wrap gap-2">{STARTERS.map((starter) => <button key={starter} type="button" onClick={() => { setInput(starter); window.setTimeout(() => document.getElementById('aleya-chat-input')?.focus(), 0); }} className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-2 text-left text-xs text-slate-200 hover:border-sky-300 hover:text-white">{starter}</button>)}</div></div> : null}

      <form onSubmit={sendMessage} className="border-t border-white/10 bg-slate-950/70 p-4 md:p-5">
        <label className="sr-only" htmlFor="aleya-chat-input">Message Aleya</label>
        <div className="flex items-end gap-3 rounded-3xl border border-white/15 bg-slate-950 px-4 py-3 focus-within:border-sky-300/70 focus-within:ring-2 focus-within:ring-sky-300/20">
          <textarea id="aleya-chat-input" rows={2} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder="Message Aleya…" className="min-h-12 flex-1 resize-none bg-transparent text-sm leading-6 text-white outline-none placeholder:text-slate-500" />
          <button type="submit" disabled={!input.trim()} className="rounded-full bg-sky-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-40">Send</button>
        </div>
      </form>

      {versions.length > 0 ? <details className="border-t border-white/10 px-5 py-4 md:px-7"><summary className="cursor-pointer text-sm font-medium text-slate-300">Previous itinerary versions ({versions.length})</summary><ul className="mt-3 space-y-2">{versions.map((version) => <li key={version.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-slate-300"><span>{version.label} · {new Date(version.createdAt).toLocaleString('en-AU')} · {version.stops.length} items</span><SecondaryButton type="button" disabled={!canEditTrip} onClick={() => { restoreItineraryVersion(version.id); setFeedback(`Restored ${version.label}.`); }}>Restore</SecondaryButton></li>)}</ul></details> : <div className="border-t border-white/10 px-5 py-3 text-right md:px-7"><button type="button" disabled={!canEditTrip} onClick={() => { saveItineraryVersion('Saved by traveller'); setFeedback('Your current itinerary has been saved.'); }} className="text-xs text-slate-400 hover:text-sky-200 disabled:opacity-40">Save current itinerary</button></div>}
    </section>
  );
}
