/**
 * Live search activation from chat — projects canonical requirements into
 * provider searches for every selected service. No manual re-entry.
 */

import type { TravelServiceKind } from '../types';
import { projectSearchForm, projectSearchRequest } from '../project';
import type { ConversationState } from '../types';

export type LiveSearchResult = {
  opened: TravelServiceKind[];
  unavailable: Array<{ service: TravelServiceKind; reason: string }>;
};

const normaliseAirport = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z]/g, '').slice(0, 3);

const compactDate = (value: string) => value.replaceAll('-', '').slice(2);

function openUrl(url: string): void {
  if (typeof window === 'undefined') return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Run live provider searches for the given services using saved requirements.
 * Flights → Skyscanner. Accommodation → Booking.com. Car hire → Skyscanner cars.
 */
export function runLiveSearchFromState(
  state: ConversationState,
  services: TravelServiceKind[],
  options?: { currency?: string; cabinClass?: string },
): LiveSearchResult {
  const form = projectSearchForm(state);
  const request = projectSearchRequest(state);
  const currency = options?.currency ?? 'AUD';
  const cabinClass = options?.cabinClass ?? 'economy';
  const adults = form.adults ?? 1;
  const target = services.length > 0 ? services : request.services;
  const opened: TravelServiceKind[] = [];
  const unavailable: LiveSearchResult['unavailable'] = [];

  for (const service of target) {
    if (service === 'flights') {
      const from = normaliseAirport(form.originCode ?? '');
      const to = normaliseAirport(form.destinationCode ?? '');
      const departDate = form.departDate;
      if (from.length !== 3 || to.length !== 3 || !departDate) {
        unavailable.push({
          service: 'flights',
          reason: 'Need origin, destination, and departure date codes before opening flights.',
        });
        continue;
      }
      const outbound = compactDate(departDate);
      const inbound = form.returnDate ? `/${compactDate(form.returnDate)}` : '';
      openUrl(
        `https://www.skyscanner.com.au/transport/flights/${from}/${to}/${outbound}${inbound}/?adultsv2=${adults}&cabinclass=${cabinClass}&currency=${currency}`,
      );
      opened.push('flights');
      continue;
    }

    if (service === 'accommodation') {
      const destination = encodeURIComponent(
        state.accommodationArea?.value || state.destination?.value || '',
      );
      const checkIn = form.departDate;
      const checkOut = form.returnDate;
      if (!destination || !checkIn) {
        unavailable.push({
          service: 'accommodation',
          reason: 'Need a destination and check-in date for hotel search.',
        });
        continue;
      }
      const checkoutParam = checkOut ? `&checkout=${checkOut}` : '';
      openUrl(
        `https://www.booking.com/searchresults.html?ss=${destination}&checkin=${checkIn}${checkoutParam}&group_adults=${adults}&selected_currency=${currency}`,
      );
      opened.push('accommodation');
      continue;
    }

    if (service === 'car_hire') {
      const to = normaliseAirport(form.destinationCode ?? '');
      const departDate = form.departDate;
      if (to.length !== 3 || !departDate) {
        unavailable.push({
          service: 'car_hire',
          reason: 'Need destination and dates for car hire search.',
        });
        continue;
      }
      const outbound = compactDate(departDate);
      const inbound = form.returnDate ? compactDate(form.returnDate) : outbound;
      openUrl(
        `https://www.skyscanner.com.au/carhire/landing.html#/cars/${to}/${to}/${outbound}/${inbound}?adults=${adults}&currency=${currency}`,
      );
      opened.push('car_hire');
      continue;
    }

    unavailable.push({
      service,
      reason: `No live provider integration is wired for ${service.replace(/_/g, ' ')} yet.`,
    });
  }

  // Scroll flight form into view when flights were searched (projected fields already bound).
  if (typeof document !== 'undefined' && opened.includes('flights')) {
    document.getElementById('flight-search')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }

  return { opened, unavailable };
}
