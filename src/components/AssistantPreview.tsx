import { useMemo, useState } from 'react';

type PreviewMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

const STARTERS = [
  'Plan flights and hotels for a 10-day Japan trip',
  'Build a food-focused itinerary with nearby recommendations',
  'Help with transfers, budget, and packing for a family trip',
  'Suggest cruise and leisure options for a coastal break',
];

function respond(question: string): string {
  const q = question.toLowerCase();
  if (q.includes('flight') || q.includes('hotel')) {
    return 'Open Flights and Hotels in the trip platform for live location autocomplete and calendar dates. Save plans to your trip — live inventory is not connected yet, so treat results as planning requirements, not bookings.';
  }
  if (q.includes('itinerary') || q.includes('day')) {
    return 'Use Itinerary Builder to add days, activities, times, locations, and notes. Concierge Plan can drop recommendations into the same itinerary.';
  }
  if (q.includes('cruise') || q.includes('leisure') || q.includes('activity')) {
    return 'Travel services under Explore and Book let you capture cruise, leisure, tours, and adventure preferences, then save them as planning requests.';
  }
  if (q.includes('transfer') || q.includes('taxi') || q.includes('transport') || q.includes('train')) {
    return 'Move services cover taxis, rideshare, trains, buses, ferries, and airport transfers. Capture pickup details and save planned ground transport to your trip.';
  }
  if (q.includes('budget') || q.includes('currency') || q.includes('pack')) {
    return 'Budget Intelligence, packing lists, documents, and the booking organiser are available now for trip organisation. No fake fares or confirmations are shown.';
  }
  if (q.includes('nearby') || q.includes('restaurant') || q.includes('nightlife') || q.includes('beach')) {
    return 'Explore categories cover restaurants, nearby recommendations, beaches, nightlife, family activities, and events. Save shortlists into your itinerary or journal.';
  }
  return 'Travel Buddy helps with flight/hotel planning, itineraries, destination discovery, nearby recommendations, transport, cruises, leisure, budgeting, documents, and concierge-style questions. Open the trip platform below — features are labelled Available now, Planning tool, or Coming soon. Live supplier booking is not claimed.';
}

export function AssistantPreview() {
  const [question, setQuestion] = useState(STARTERS[0]!);
  const [messages, setMessages] = useState<PreviewMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Ask about flights, hotels, itineraries, destinations, nearby ideas, transport, cruises, leisure, budgets, or booking organisation. This preview uses the same planning guidance as the live app — it does not invent live availability or confirm bookings.',
    },
  ]);

  const canAsk = useMemo(() => question.trim().length > 0, [question]);

  const ask = (value = question) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: 'user', text: trimmed },
      { id: crypto.randomUUID(), role: 'assistant', text: respond(trimmed) },
    ]);
    setQuestion('');
  };

  return (
    <div
      id="assistant"
      className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-sky-950/30"
      aria-label="Assistant preview"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm uppercase tracking-[0.32em] text-sky-300">Assistant preview</p>
        <span className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100">
          Available now
        </span>
      </div>
      <p className="mt-3 text-sm text-slate-300">
        Interactive preview of Travel Buddy planning help. Connected to the same workflows in the trip platform below.
      </p>
      <div className="mt-5 max-h-64 space-y-3 overflow-y-auto text-sm text-slate-200">
        {messages.map((message) => (
          <p
            key={message.id}
            className={`rounded-2xl p-4 ${
              message.role === 'user' ? 'bg-slate-900' : 'bg-sky-400/10 text-sky-100'
            }`}
          >
            {message.text}
          </p>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {STARTERS.map((starter) => (
          <button
            key={starter}
            type="button"
            className="rounded-full border border-white/15 px-3 py-1.5 text-left text-xs text-slate-200 hover:border-sky-300/50"
            onClick={() => ask(starter)}
          >
            {starter}
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="assistant-preview-input">
          Ask the assistant
        </label>
        <input
          id="assistant-preview-input"
          className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none ring-sky-300/40 focus:ring-2"
          value={question}
          placeholder="Ask about flights, hotels, itineraries…"
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') ask();
          }}
        />
        <button
          type="button"
          disabled={!canAsk}
          className="rounded-full bg-sky-400/20 px-4 py-2 text-sm text-sky-100 transition hover:bg-sky-400/30 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => ask()}
        >
          Ask
        </button>
      </div>
      <a
        href="#trip-platform"
        className="mt-4 inline-flex text-sm text-sky-300 underline-offset-4 hover:underline"
      >
        Open trip platform to use Flights, Hotels, Itineraries, and Concierge Plan
      </a>
    </div>
  );
}
