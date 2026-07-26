import type { DraftPlan, TripBriefInput, TripPace } from './models';

function toMidnightTime(dateIso: string): number {
  return new Date(`${dateIso}T00:00:00`).getTime();
}

export function getTripDurationDays(startDate: string, endDate: string): number {
  const startMs = toMidnightTime(startDate);
  const endMs = toMidnightTime(endDate);
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((endMs - startMs) / dayMs) + 1;
  return Math.max(diffDays, 1);
}

function getTripPace(durationDays: number, interestsCount: number): TripPace {
  if (durationDays <= 3 || interestsCount >= 5) return 'packed';
  if (durationDays >= 9 && interestsCount <= 2) return 'light';
  return 'balanced';
}

function getPillars(input: TripBriefInput): string[] {
  return input.interests
    .map((interest) => `${interest[0]!.toUpperCase()}${interest.slice(1)} focus`)
    .slice(0, 4);
}

function buildSuggestedDays(input: TripBriefInput, durationDays: number): string[] {
  const interests = input.interests.length > 0 ? input.interests : (['culture'] as const);
  const days: string[] = [];
  for (let i = 0; i < durationDays; i += 1) {
    const interest = interests[i % interests.length]!;
    const label = `${interest[0]!.toUpperCase()}${interest.slice(1)}`;
    if (i === 0) days.push(`Arrive in ${input.destination.trim()} · settle in`);
    else if (i === durationDays - 1) days.push(`Wrap-up day · ${label} highlight`);
    else days.push(`Day ${i + 1}: ${label} exploration`);
  }
  return days;
}

export function mapTripBriefToDraftPlan(input: TripBriefInput): DraftPlan {
  const durationDays = getTripDurationDays(input.startDate, input.endDate);
  const tripPace = getTripPace(durationDays, input.interests.length);
  const pillars = getPillars(input);

  return {
    title: `${durationDays}-day draft plan for ${input.destination.trim()}`,
    destination: input.destination.trim(),
    durationDays,
    travelers: input.travelers,
    budgetStyle: input.budgetStyle,
    tripPillars: pillars,
    dailyPace: tripPace,
    nextSteps: [
      'Compare flight windows and best arrival times.',
      'Shortlist neighbourhoods by budget style and trip interests.',
      'Draft a day-by-day itinerary with transport buffers.',
      'Estimate daily budget range for meals, activities, and local travel.',
    ],
    assumptions: [
      'This is an early draft plan based only on your brief.',
      'No live provider inventory or pricing is connected yet.',
      input.notes.trim()
        ? `Planner note captured: ${input.notes.trim()}`
        : 'No additional traveler notes were provided.',
    ],
    suggestedDays: buildSuggestedDays(input, durationDays),
  };
}
