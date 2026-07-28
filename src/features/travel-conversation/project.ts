import type { ConversationState, TravelServiceKind } from './types';

/**
 * Requirements summary projection for the chat UI only.
 * Live search projection lives in ./search-projection (sole authority).
 */

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
  excludedServices: TravelServiceKind[];
};

function serviceLabel(service: TravelServiceKind): string {
  return service.replace(/_/g, ' ');
}

function formatAu(iso?: string): string | undefined {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
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

function departureDisplay(state: ConversationState): { label?: string; iso?: string } {
  const dep = state.departureDate?.value;
  if (!dep) return {};
  if (dep.kind === 'exact') return { label: formatAu(dep.isoDate), iso: dep.isoDate };
  if (dep.kind === 'approximate') {
    const prefix =
      dep.period === 'mid' ? 'mid-' : dep.period === 'early' ? 'early ' : 'late ';
    const month = monthName(dep.month);
    return {
      label: dep.period === 'mid' ? `${prefix}${month} ${dep.year}` : `${prefix}${month} ${dep.year}`,
    };
  }
  return { label: dep.label };
}

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
    excludedServices: [...state.excludedServices],
  };
}

export function summarizeKnown(state: ConversationState): string[] {
  const view = projectRequirementsSummary(state);
  const bits: string[] = [];
  if (view.origin) bits.push(`origin ${view.origin}`);
  if (view.destination) bits.push(`destination ${view.destination}`);
  if (view.departing) bits.push(`departing ${view.departing}`);
  if (view.returning) {
    bits.push(`returning ${view.returning.replace(/^returning\s+/i, '')}`);
  }
  if (view.accommodation) bits.push(`stay in ${view.accommodation}`);
  if (view.duration) bits.push(view.duration);
  if (view.serviceLabels.length) bits.push(`services: ${view.serviceLabels.join(', ')}`);
  return bits;
}
