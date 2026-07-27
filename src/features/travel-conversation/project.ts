import { iataForPlace } from './lexicon';
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

export type SearchRequestProjection = {
  origin?: string;
  destination?: string;
  departDate?: string;
  returnDate?: string;
  services: TravelServiceKind[];
  adults: number;
};

function serviceLabel(service: TravelServiceKind): string {
  return service.replace(/_/g, ' ');
}

function formatAu(iso?: string): string | undefined {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function departureDisplay(state: ConversationState): { label?: string; iso?: string } {
  const dep = state.departureDate?.value;
  if (!dep) return {};
  if (dep.kind === 'exact') return { label: formatAu(dep.isoDate), iso: dep.isoDate };
  if (dep.kind === 'mid_month') return { label: `mid-${monthName(dep.month)} ${dep.year}` };
  if (dep.kind === 'month_end') return { label: dep.label };
  return { label: dep.label };
}

function monthName(month: number): string {
  return [
    '',
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ][month] ?? '';
}

/** Single projector for UI summary, compose, and acceptance checks. */
export function projectRequirementsSummary(state: ConversationState): RequirementsSummaryView {
  const dep = departureDisplay(state);
  const retIso = state.returnDate?.value.isoDate;
  const nights = state.durationNights?.value;
  return {
    origin: state.origin?.value,
    destination: state.destination?.value,
    departing: dep.label,
    departingIso: dep.iso,
    returning: formatAu(retIso) ?? state.returnDate?.value.label,
    returningIso: retIso,
    accommodation: state.accommodationArea?.value,
    duration: nights != null ? `${nights} night${nights === 1 ? '' : 's'}` : undefined,
    durationNights: nights,
    services: [...state.services],
    serviceLabels: state.services.map(serviceLabel),
  };
}

export function projectSearchForm(state: ConversationState): SearchFormProjection {
  const summary = projectRequirementsSummary(state);
  return {
    originLabel: summary.origin,
    destinationLabel: summary.destination,
    originCode: iataForPlace(summary.origin),
    destinationCode: iataForPlace(summary.destination),
    departDate: summary.departingIso,
    returnDate: summary.returningIso,
    adults: 1,
  };
}

export function projectSearchRequest(state: ConversationState): SearchRequestProjection {
  const form = projectSearchForm(state);
  return {
    origin: form.originCode ?? form.originLabel,
    destination: form.destinationCode ?? form.destinationLabel,
    departDate: form.departDate,
    returnDate: form.returnDate,
    services: [...state.services],
    adults: form.adults,
  };
}

export function summarizeKnown(state: ConversationState): string[] {
  const view = projectRequirementsSummary(state);
  const bits: string[] = [];
  if (view.origin) bits.push(`origin ${view.origin}`);
  if (view.destination) bits.push(`destination ${view.destination}`);
  if (view.departing) bits.push(`departing ${view.departing}`);
  if (view.returning) bits.push(`returning ${view.returning}`);
  if (view.accommodation) bits.push(`stay in ${view.accommodation}`);
  if (view.duration) bits.push(view.duration);
  if (view.serviceLabels.length) bits.push(`services: ${view.serviceLabels.join(', ')}`);
  return bits;
}
