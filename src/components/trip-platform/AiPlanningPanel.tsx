import { useMemo, useRef, useState, type FormEvent } from 'react';
import type { AiTravelPlan } from '../../features/ai-planning/aiPlanning';
import {
  isSearchActive,
  resetTravelConversation,
  sendTravelMessage,
  useTravelConversation,
  type TravelServiceKind,
} from '../../features/travel-conversation';
import { RequirementsSummary } from '../../features/travel-conversation/ui/RequirementsSummary';
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

const readSavedProfile = () => {
  try {
    const stored = localStorage.getItem(PROFILE_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as { fullName?: string; preferredName?: string; currency?: string }) : {};
  } catch {
    return {};
  }
};

const getTravellerName = () => {
  const profile = readSavedProfile();
  const preferredName = profile.preferredName?.trim();
  if (preferredName) return preferredName;
  const fullName = profile.fullName?.trim();
  return fullName ? fullName.split(/\s+/)[0] : '';
};

const STARTERS = [
  'I want to visit Japan next April',
  'Find me affordable flights to Bali',
  'I need a hotel in Singapore next weekend',
  'Plan a family trip to Queenstown with car hire',
];

export type AiPlanningPanelProps = {
  /** Called when a search session starts or continues. */
  onActivateSearch?: (services: TravelServiceKind[]) => void;
};

export function AiPlanningPanel({ onActivateSearch }: AiPlanningPanelProps = {}) {
  const { trip, applyAiTravelPlan, saveItineraryVersion, restoreItineraryVersion, canEditTrip } = useSharedTripStore();
  const travelState = useTravelConversation();
  const travellerName = getTravellerName();
  const greeting = travellerName ? `Hi ${travellerName}. How can I help with your travel today?` : 'Hi. How can I help with your travel today?';
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: createId(),
      role: 'aleya',
      text: greeting,
      createdAt: new Date().toISOString(),
    },
  ]);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const versions = useMemo(() => trip.itineraryVersions ?? [], [trip.itineraryVersions]);
  const searchReady =
    (travelState.phase === 'ready' || travelState.phase === 'locked') && !isSearchActive();
  const sessionActive = isSearchActive();

  /** Keep the user in chat — scroll only inside the chat pane, never the page. */
  const scrollChatToEnd = () => {
    const pane = chatScrollRef.current;
    if (!pane) return;
    pane.scrollTo({ top: pane.scrollHeight, behavior: 'smooth' });
  };

  const reply = (text: string, plan?: AiTravelPlan) => {
    setMessages((current) => [...current, { id: createId(), role: 'aleya', text, createdAt: new Date().toISOString(), plan }]);
    window.setTimeout(scrollChatToEnd, 0);
  };

  const runEngineTurn = (request: string) => {
    const result = sendTravelMessage({
      message: request,
      travellerName,
    });
    if (result.activateSearch || result.continueSearch) {
      onActivateSearch?.(result.servicesToSearch);
    }
    reply(result.reply);
    return result;
  };

  const sendMessage = async (event?: FormEvent) => {
    event?.preventDefault();
    const request = input.trim();
    if (!request || busy) return;

    setMessages((current) => [...current, { id: createId(), role: 'user', text: request, createdAt: new Date().toISOString() }]);
    setInput('');
    setFeedback(null);
    setBusy(true);

    try {
      runEngineTurn(request);
    } catch (error) {
      reply(error instanceof Error ? error.message : 'Something went wrong while processing your request.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-sky-950/50 shadow-2xl shadow-sky-950/30"
      aria-labelledby="aleya-assistant-title"
      data-testid="aleya-planning-panel"
    >
      <header className="border-b border-white/10 px-5 py-5 md:px-7">
        <h2 id="aleya-assistant-title" className="text-3xl font-bold text-white">Aleya AI Assistant</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">Every request goes through the travel conversation engine — one shared requirements state for chat, summary, and search. Itineraries only when you ask.</p>
      </header>

      {feedback ? <div className="px-5 pt-4 md:px-7"><StatusBanner kind="info" message={feedback} /></div> : null}

      <RequirementsSummary />

      {sessionActive ? (
        <div
          className="border-b border-white/10 bg-emerald-950/30 px-5 py-2 md:px-7"
          data-testid="search-session-active-banner"
        >
          <p className="text-xs font-medium text-emerald-200">
            Live search in progress — ask naturally to refine hotels, flights, or cars.
          </p>
        </div>
      ) : null}

      <div
        ref={chatScrollRef}
        className="max-h-[680px] min-h-[420px] space-y-5 overflow-y-auto px-4 py-6 md:px-7"
        aria-live="polite"
        data-testid="aleya-chat-scroll"
      >
        {messages.map((message) => (
          <article
            key={message.id}
            data-testid={message.role === 'aleya' ? 'aleya-message' : 'user-message'}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-3xl ${message.role === 'user' ? 'rounded-3xl rounded-br-md bg-sky-400 px-5 py-3 text-slate-950' : 'rounded-3xl rounded-bl-md border border-white/10 bg-white/[0.05] px-5 py-4 text-slate-100'}`}>
              {message.role === 'aleya' ? <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Aleya</p> : null}
              <p className="whitespace-pre-wrap text-sm leading-6" data-testid="chat-bubble-text">{message.text}</p>
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

      {searchReady ? (
        <div className="border-t border-white/10 px-5 py-3 md:px-7" data-testid="search-handoff-actions">
          <p className="mb-2 text-xs text-slate-400">
            Requirements are ready. Stay in chat, or continue to search when you want.
          </p>
          <PrimaryButton
            type="button"
            data-testid="continue-to-search"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              try {
                setMessages((current) => [
                  ...current,
                  {
                    id: createId(),
                    role: 'user',
                    text: 'Yes please',
                    createdAt: new Date().toISOString(),
                  },
                ]);
                runEngineTurn('Yes please');
              } finally {
                setBusy(false);
              }
            }}
          >
            Continue to search
          </PrimaryButton>
        </div>
      ) : null}

      <form onSubmit={sendMessage} className="border-t border-white/10 bg-slate-950/70 p-4 md:p-5">
        <label className="sr-only" htmlFor="aleya-chat-input">Message Aleya</label>
        <div className="flex items-end gap-3 rounded-3xl border border-white/15 bg-slate-950 px-4 py-3 focus-within:border-sky-300/70 focus-within:ring-2 focus-within:ring-sky-300/20">
          <textarea id="aleya-chat-input" rows={2} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="Message Aleya…" className="min-h-12 flex-1 resize-none bg-transparent text-sm leading-6 text-white outline-none placeholder:text-slate-500" />
          <button type="submit" disabled={!input.trim() || busy} className="rounded-full bg-sky-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-40">{busy ? '…' : 'Send'}</button>
        </div>
        <button
          type="button"
          className="mt-2 text-xs text-slate-500 hover:text-sky-200"
          onClick={() => {
            resetTravelConversation();
            setMessages([
              {
                id: createId(),
                role: 'aleya',
                text: greeting,
                createdAt: new Date().toISOString(),
              },
            ]);
            setFeedback('Started a fresh requirements conversation.');
          }}
        >
          Clear saved requirements
        </button>
      </form>

      {versions.length > 0 ? <details className="border-t border-white/10 px-5 py-4 md:px-7"><summary className="cursor-pointer text-sm font-medium text-slate-300">Previous itinerary versions ({versions.length})</summary><ul className="mt-3 space-y-2">{versions.map((version) => <li key={version.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-slate-300"><span>{version.label} · {new Date(version.createdAt).toLocaleString('en-AU')} · {version.stops.length} items</span><SecondaryButton type="button" disabled={!canEditTrip} onClick={() => { restoreItineraryVersion(version.id); setFeedback(`Restored ${version.label}.`); }}>Restore</SecondaryButton></li>)}</ul></details> : <div className="border-t border-white/10 px-5 py-3 text-right md:px-7"><button type="button" disabled={!canEditTrip} onClick={() => { saveItineraryVersion('Saved by traveller'); setFeedback('Your current itinerary has been saved.'); }} className="text-xs text-slate-400 hover:text-sky-200 disabled:opacity-40">Save current itinerary</button></div>}
    </section>
  );
}
