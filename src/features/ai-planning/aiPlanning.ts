import type { TripData, TripStop } from '../../store/tripDomain';

export type AiPlanMode =
  | 'complete'
  | 'family'
  | 'accessible'
  | 'business'
  | 'leisure'
  | 'romantic'
  | 'adventure'
  | 'low-cost'
  | 'luxury';

export type AiDayPlan = {
  day: number;
  date: string;
  title: string;
  pace: 'relaxed' | 'balanced' | 'packed';
  items: Array<{
    title: string;
    category: TripStop['category'];
    startTime: string;
    endTime: string;
    location: string;
    notes: string;
    estimatedCost: number;
  }>;
};

export type AiTravelPlan = {
  id: string;
  generatedAt: string;
  mode: AiPlanMode;
  label: string;
  source: 'mock-ai';
  disclaimer: string;
  destinationSuggestions: string[];
  packingRecommendations: string[];
  budgetSuggestion: { currency: string; amount: number; notes: string };
  transportSuggestions: string[];
  weatherPlaceholder: string;
  restaurantSuggestions: string[];
  activityRecommendations: string[];
  travelTimeEstimates: string[];
  days: AiDayPlan[];
};

const MODE_COPY: Record<AiPlanMode, { label: string; pace: AiDayPlan['pace']; multiplier: number }> = {
  complete: { label: 'Complete itinerary', pace: 'balanced', multiplier: 1 },
  family: { label: 'Family-friendly plan', pace: 'relaxed', multiplier: 0.9 },
  accessible: { label: 'Accessibility-aware plan', pace: 'relaxed', multiplier: 1 },
  business: { label: 'Business-trip plan', pace: 'packed', multiplier: 1.1 },
  leisure: { label: 'Leisure plan', pace: 'balanced', multiplier: 1 },
  romantic: { label: 'Romantic plan', pace: 'relaxed', multiplier: 1.2 },
  adventure: { label: 'Adventure plan', pace: 'packed', multiplier: 1.05 },
  'low-cost': { label: 'Low-cost plan', pace: 'balanced', multiplier: 0.65 },
  luxury: { label: 'Luxury plan', pace: 'relaxed', multiplier: 1.8 },
};

const addDays = (iso: string, offset: number): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

const durationDays = (trip: TripData): number => {
  if (!trip.departureDate || !trip.returnDate) return 3;
  const start = new Date(`${trip.departureDate}T00:00:00`).getTime();
  const end = new Date(`${trip.returnDate}T00:00:00`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 3;
  return Math.min(14, Math.max(1, Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1));
};

const styleHint = (mode: AiPlanMode): string => {
  if (mode === 'accessible') return 'Prioritise step-free access, rest breaks, and accessible transport.';
  if (mode === 'family') return 'Keep transitions short and include shared downtime.';
  if (mode === 'business') return 'Protect focus blocks and keep transfers predictable.';
  if (mode === 'adventure') return 'Front-load outdoor activities and build weather buffers.';
  if (mode === 'luxury' || mode === 'romantic') return 'Emphasise dining, atmosphere, and unhurried evenings.';
  if (mode === 'low-cost') return 'Favour free/low-cost highlights and public transport.';
  return 'Balance discovery with recovery time.';
};

/** Secure mock AI abstraction — no external model calls. Clearly labelled for planning only. */
export function generateAiTravelPlan(trip: TripData, mode: AiPlanMode = 'complete'): AiTravelPlan {
  const meta = MODE_COPY[mode];
  const daysCount = durationDays(trip);
  const destination = trip.destination || trip.destinationsList[0] || 'your destination';
  const currency = trip.currency || 'USD';
  const baseBudget = Math.max(trip.budget || 1500, 400) * meta.multiplier;

  const days: AiDayPlan[] = Array.from({ length: daysCount }, (_, index) => {
    const day = index + 1;
    const date = addDays(trip.departureDate, index);
    const morning =
      day === 1
        ? {
            title: `Arrive and settle in ${destination}`,
            category: 'travel' as const,
            startTime: '14:00',
            endTime: '16:00',
            location: destination,
            notes: 'AI suggestion (mock): transfer, check-in, light orientation walk.',
            estimatedCost: Math.round(35 * meta.multiplier),
          }
        : {
            title: `${destination} morning highlight`,
            category: mode === 'adventure' ? ('activity' as const) : ('sightseeing' as const),
            startTime: '09:30',
            endTime: '12:00',
            location: destination,
            notes: `AI suggestion (mock): ${styleHint(mode)}. Not live availability.`,
            estimatedCost: Math.round(40 * meta.multiplier),
          };
    const afternoon = {
      title: mode === 'business' ? 'Focus / meeting block' : `${destination} neighbourhood explore`,
      category: mode === 'business' ? ('other' as const) : ('activity' as const),
      startTime: '13:30',
      endTime: '16:30',
      location: destination,
      notes: 'AI suggestion (mock): allow travel-time buffer between stops.',
      estimatedCost: Math.round(55 * meta.multiplier),
    };
    const evening = {
      title: mode === 'romantic' || mode === 'luxury' ? 'Signature dinner' : 'Local dinner',
      category: 'food' as const,
      startTime: '19:00',
      endTime: '21:00',
      location: destination,
      notes: 'AI suggestion (mock): restaurant shortlist only — not a reservation.',
      estimatedCost: Math.round(70 * meta.multiplier),
    };
    return {
      day,
      date,
      title: `Day ${day} · ${destination}`,
      pace: meta.pace,
      items: [morning, afternoon, evening],
    };
  });

  return {
    id: crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
    mode,
    label: meta.label,
    source: 'mock-ai',
    disclaimer:
      'AI-generated planning guidance (mock abstraction). Not live inventory, weather, or booked services. Refine before saving.',
    destinationSuggestions: [
      destination,
      ...trip.destinationsList.filter((entry) => entry && entry !== destination).slice(0, 3),
      `${destination} day-trip option (placeholder)`,
    ],
    packingRecommendations: [
      'Travel documents and charging kit',
      mode === 'adventure' ? 'Weather layers and sturdy footwear' : 'Comfortable walking shoes',
      mode === 'accessible' ? 'Accessibility aids and medication list' : 'Personal care essentials',
      mode === 'family' ? 'Shared snacks and child entertainment' : 'Reusable water bottle',
    ],
    budgetSuggestion: {
      currency,
      amount: Math.round(baseBudget),
      notes: `Mock budget for a ${meta.label.toLowerCase()} across ${daysCount} day(s). Adjust after confirming real quotes.`,
    },
    transportSuggestions: [
      'Airport transfer or rail into city centre (planning placeholder)',
      'Local transit pass or rideshare budget buffer',
      mode === 'adventure' ? 'Self-drive / hire car contingency' : 'Walking-first neighbourhood hops',
    ],
    weatherPlaceholder: `Weather-aware planning placeholder for ${destination}: confirm forecast closer to departure.`,
    restaurantSuggestions: [
      `Neighbourhood dinner near ${destination} (mock)`,
      mode === 'luxury' || mode === 'romantic' ? 'Reservation-worthy tasting menu shortlist (mock)' : 'Casual local favourite shortlist (mock)',
      'Café with flexible seating for downtime (mock)',
    ],
    activityRecommendations: [
      `Signature attraction in ${destination} (mock)`,
      mode === 'family' ? 'Family-friendly museum or park block (mock)' : 'Cultural or outdoor highlight (mock)',
      mode === 'accessible' ? 'Step-free viewpoint or gallery (mock)' : 'Golden-hour walk (mock)',
    ],
    travelTimeEstimates: [
      'Airport → hotel: 45–75 minutes (placeholder)',
      'Morning highlight → afternoon area: 20–40 minutes (placeholder)',
      'Allow 15-minute buffers between timed activities',
    ],
    days,
  };
}

export function aiPlanToStops(plan: AiTravelPlan, currency: string): TripStop[] {
  const stops: TripStop[] = [];
  let order = 1;
  for (const day of plan.days) {
    for (const item of day.items) {
      stops.push({
        id: crypto.randomUUID(),
        title: item.title,
        day: day.day,
        order: order++,
        notes: `${item.notes}\n\n[${plan.disclaimer}]`,
        date: day.date,
        startTime: item.startTime,
        endTime: item.endTime,
        location: item.location,
        category: item.category,
        cost: item.estimatedCost,
        currency,
        bookingReference: '',
        locked: false,
        travellerIds: [],
        itemStatus: 'planned',
        latitude: '',
        longitude: '',
        supplierDetails: '',
        reminderAt: '',
        aiGenerated: true,
      });
    }
  }
  return stops;
}

export const AI_PLAN_MODES: AiPlanMode[] = [
  'complete',
  'family',
  'accessible',
  'business',
  'leisure',
  'romantic',
  'adventure',
  'low-cost',
  'luxury',
];
