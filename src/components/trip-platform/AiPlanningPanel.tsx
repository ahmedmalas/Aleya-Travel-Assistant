import { useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { AiTravelPlan } from '../../features/ai-planning/aiPlanning';
import {
  createInitialConversationCoreState,
  processConversationTurn,
  type ConversationCoreState,
} from '../../features/conversation-core';
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
const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

const readSavedProfile = () => {
  try {
    const stored = localStorage.getItem(PROFILE_STORAGE_KEY);
    return stored
      ? (JSON.parse(stored) as {
          fullName?: string;
          preferredName?: string;
          currency?: string;
        })
      : {};
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

export function AiPlanningPanel() {
  const { trip, applyAiTravelPlan, saveItineraryVersion, restoreItineraryVersion, canEditTrip } =
    useSharedTripStore();
  const travellerName = getTravellerName();
  const greeting = travellerName
    ? `Hi ${travellerName}. How can I help with your travel today?`
    : 'Hi. How can I help with your travel today?';
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [coreState, setCoreState] = useState<ConversationCoreState>(() =>
    createInitialConversationCoreState({
      conversationId: createId(),
      now: new Date(),
    }),
  );
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: createId(),
      role: 'aleya',
      text: greeting,
      createdAt: new Date().toISOString(),
    },
  ]);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const pendingScrollMessageIdRef = useRef<string | null>(null);
  const versions = useMemo(() => trip.itineraryVersions ?? [], [trip.itineraryVersions]);

  useLayoutEffect(() => {
    const messageId = pendingScrollMessageIdRef.current;
    if (!messageId) return;
    const pane = chatScrollRef.current;
    if (!pane) return;

    const alignNewestReply = () => {
      const target = pane.querySelector(
        `[data-message-id="${messageId}"]`,
      ) as HTMLElement | null;
      if (!target) return false;
      const paneRect = pane.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const nextTop = pane.scrollTop + (targetRect.top - paneRect.top) - 8;
      pane.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
      return true;
    };

    alignNewestReply();
    const raf = window.requestAnimationFrame(() => {
      alignNewestReply();
      pendingScrollMessageIdRef.current = null;
    });
    return () => window.cancelAnimationFrame(raf);
  }, [messages]);

  const reply = (text: string, plan?: AiTravelPlan) => {
    const id = createId();
    pendingScrollMessageIdRef.current = id;
    setMessages((current) => [
      ...current,
      {
        id,
        role: 'aleya',
        text,
        createdAt: new Date().toISOString(),
        plan,
      },
    ]);
  };

  const runEngineTurn = (request: string) => {
    const result = processConversationTurn({
      message: request,
      state: coreState,
    });
    setCoreState(result.state);
    reply(result.reply);
    return result;
  };

  const sendMessage = (event?: FormEvent) => {
    event?.preventDefault();
    const request = input.trim();
    if (!request || busy) return;

    setMessages((current) => [
      ...current,
      { id: createId(), role: 'user', text: request, createdAt: new Date().toISOString() },
    ]);
    setInput('');
    setFeedback(null);
    setBusy(true);

    try {
      runEngineTurn(request);
    } catch (error) {
      reply(
        error instanceof Error
          ? error.message
          : 'Something went wrong while processing your request.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-sky-950/50 shadow-2xl shadow-sky-950/30"
      aria-labelledby="aleya-assistant-title"
      data-testid="aleya-planning-panel"
      data-conversation-boundary="conversation-core"
    >
      <header className="border-b border-white/10 px-5 py-5 md:px-7">
        <h2 id="aleya-assistant-title" className="text-3xl font-bold text-white">
          Aleya AI Assistant
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Conversation intelligence is being rebuilt from first principles. The previous engine has
          been removed; this panel talks only to the empty conversation-core boundary.
        </p>
        <aside
          className="mt-4 rounded-xl border border-amber-400/40 bg-amber-950/40 px-3 py-3 font-mono text-[11px] leading-5 text-amber-100"
          data-testid="conversation-core-boundary"
          aria-label="Conversation core boundary"
        >
          <p>Boundary: conversation-core</p>
          <p>Status: {coreState.status}</p>
          <p>Turn count: {coreState.turnCount}</p>
          <p>Conversation: {coreState.conversationId}</p>
          <p>Persistence: disabled</p>
        </aside>
      </header>

      {feedback ? (
        <div className="px-5 pt-4 md:px-7">
          <StatusBanner kind="info" message={feedback} />
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
            data-message-id={message.id}
            data-testid={message.role === 'aleya' ? 'aleya-message' : 'user-message'}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-3xl ${
                message.role === 'user'
                  ? 'rounded-3xl rounded-br-md bg-sky-400 px-5 py-3 text-slate-950'
                  : 'rounded-3xl rounded-bl-md border border-white/10 bg-white/[0.05] px-5 py-4 text-slate-100'
              }`}
            >
              {message.role === 'aleya' ? (
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">
                  Aleya
                </p>
              ) : null}
              <p className="whitespace-pre-wrap text-sm leading-6" data-testid="chat-bubble-text">
                {message.text}
              </p>
              {message.plan ? (
                <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-slate-950/50 p-3">
                      <p className="text-xs text-slate-400">Days</p>
                      <p className="mt-1 text-xl font-semibold text-white">
                        {message.plan.days.length}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-950/50 p-3">
                      <p className="text-xs text-slate-400">Estimated budget</p>
                      <p className="mt-1 font-semibold text-white">
                        {message.plan.budgetSuggestion.amount.toLocaleString('en-AU')}{' '}
                        {message.plan.budgetSuggestion.currency}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-950/50 p-3">
                      <p className="text-xs text-slate-400">Plan style</p>
                      <p className="mt-1 font-semibold capitalize text-white">
                        {message.plan.label}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {message.plan.days.slice(0, 4).map((day) => (
                      <div
                        key={day.day}
                        className="rounded-2xl border border-white/10 bg-slate-950/35 p-3"
                      >
                        <p className="font-medium text-white">{day.title}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {day.items.map((item) => item.title).join(' · ')}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <PrimaryButton
                      type="button"
                      disabled={!canEditTrip}
                      onClick={() =>
                        setFeedback(
                          applyAiTravelPlan(message.plan!, {
                            replaceUnlocked: true,
                            saveVersion: true,
                          }).message,
                        )
                      }
                    >
                      Add this plan to my trip
                    </PrimaryButton>
                    <SecondaryButton
                      type="button"
                      onClick={() => {
                        setInput('Please revise this plan: ');
                        document.getElementById('aleya-chat-input')?.focus();
                      }}
                    >
                      Ask for changes
                    </SecondaryButton>
                  </div>
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      <form onSubmit={sendMessage} className="border-t border-white/10 bg-slate-950/70 p-4 md:p-5">
        <label className="sr-only" htmlFor="aleya-chat-input">
          Message Aleya
        </label>
        <div className="flex items-end gap-3 rounded-3xl border border-white/15 bg-slate-950 px-4 py-3 focus-within:border-sky-300/70 focus-within:ring-2 focus-within:ring-sky-300/20">
          <textarea
            id="aleya-chat-input"
            rows={2}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Message Aleya…"
            className="min-h-12 flex-1 resize-none bg-transparent text-sm leading-6 text-white outline-none placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || busy}
            className="rounded-full bg-sky-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? '…' : 'Send'}
          </button>
        </div>
        <button
          type="button"
          className="mt-2 text-xs text-slate-500 hover:text-sky-200"
          onClick={() => {
            setCoreState(
              createInitialConversationCoreState({
                conversationId: createId(),
                now: new Date(),
              }),
            );
            setMessages([
              {
                id: createId(),
                role: 'aleya',
                text: greeting,
                createdAt: new Date().toISOString(),
              },
            ]);
            setFeedback('Started a fresh empty conversation-core session.');
          }}
        >
          Reset conversation session
        </button>
      </form>

      {versions.length > 0 ? (
        <details className="border-t border-white/10 px-5 py-4 md:px-7">
          <summary className="cursor-pointer text-sm font-medium text-slate-300">
            Previous itinerary versions ({versions.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {versions.map((version) => (
              <li
                key={version.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-slate-300"
              >
                <span>
                  {version.label} · {new Date(version.createdAt).toLocaleString('en-AU')} ·{' '}
                  {version.stops.length} items
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
        </details>
      ) : (
        <div className="border-t border-white/10 px-5 py-3 text-right md:px-7">
          <button
            type="button"
            disabled={!canEditTrip}
            onClick={() => {
              saveItineraryVersion('Saved by traveller');
              setFeedback('Your current itinerary has been saved.');
            }}
            className="text-xs text-slate-400 hover:text-sky-200 disabled:opacity-40"
          >
            Save current itinerary
          </button>
        </div>
      )}
    </section>
  );
}
