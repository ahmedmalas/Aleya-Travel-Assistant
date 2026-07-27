import { PLACES } from './places';
import type { ConversationState, TravelServiceKind } from './types';

export type RequirementsSummaryView = {
  origin?: string;
  destination?: string;
  departing?: string;
  departingIso?: string;
  returning?: string;
  returningIso?: string;
  accommodation?: string;
  duration?: string;
  durationNights?: number;
  services: TravelServiceKind[];
  serviceLabels: string[];
};

export type SearchFormProjection = {
  originCode?: string;
  destinationCode?: string;
  originLabel?: string;
  destinationLabel?: string;
  departDate?: string;
  returnDate?: string;
  adults: number;
};

function serviceLabel(service: TravelServiceKind): string {
  return service.replace(/_/g, ' ');
}

function formatAuDate(iso?: string): string | undefined {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function iataForPlace(name?: string): string | undefined {
  if (!name) return undefined;
  const lower = name.trim().toLowerCase();
  const hit = PLACES.find(
    (p) => p.name.toLowerCase() === lower || p.aliases.some((a) => a === lower),
  );
  return hit?.iata;
}

/**
 * Canonical projection used by UI summary AND compose acknowledgements.
 * Clarification must never invent a parallel view of the trip.
 */
export function projectRequirementsSummary(state: ConversationState): RequirementsSummaryView {
  const departingIso = state.departureDate?.value.isoDate;
  const returningIso = state.returnDate?.value.isoDate;
  const nights = state.durationNights?.value;
  return {
    origin: state.origin?.value,
    destination: state.destination?.value,
    departing: formatAuDate(departingIso) ?? state.departureDate?.value.label,
    departingIso,
    returning: formatAuDate(returningIso) ?? state.returnDate?.value.label,
    returningIso,
    accommodation: state.accommodationArea?.value,
    duration:
      nights != null ? `${nights} night${nights === 1 ? '' : 's'}` : undefined,
    durationNights: nights,
    services: [...state.requestedServices],
    serviceLabels: state.requestedServices.map(serviceLabel),
  };
}

/** Search / flight form fields derived from the same ConversationState. */
export function projectSearchForm(state: ConversationState): SearchFormProjection {
  const originLabel = state.origin?.value;
  const destinationLabel = state.destination?.value;
  return {
    originLabel,
    destinationLabel,
    originCode: iataForPlace(originLabel),
    destinationCode: iataForPlace(destinationLabel),
    departDate: state.departureDate?.value.isoDate,
    returnDate: state.returnDate?.value.isoDate,
    adults: Math.max(1, state.travellers?.value.adults ?? 1),
  };
}

/** Compact lead fragments for compose ("I’ve got …"). */
export function summarizeKnownFromProjection(view: RequirementsSummaryView): string[] {
  const bits: string[] = [];
  if (view.origin) bits.push(`origin ${view.origin}`);
  if (view.destination) bits.push(`destination ${view.destination}`);
  if (view.departingIso) bits.push(`departing ${view.departing ?? view.departingIso}`);
  else if (view.departing) bits.push(`around ${view.departing}`);
  if (view.returning) bits.push(`returning ${view.returning}`);
  if (view.accommodation) bits.push(`stay in ${view.accommodation}`);
  if (view.duration) bits.push(view.duration);
  if (view.serviceLabels.length) bits.push(`services: ${view.serviceLabels.join(', ')}`);
  return bits;
}
