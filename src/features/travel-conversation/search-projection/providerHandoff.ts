/**
 * Build provider search URLs from one CanonicalSearchProjection.
 * Flights, accommodation, and car hire all receive the same destination and dates.
 */

import type { TravelServiceKind } from '../types';
import type { CanonicalSearchProjection, ProviderSearchOpen } from './types';

const normaliseAirport = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z]/g, '').slice(0, 3);

const compactDate = (value: string) => value.replaceAll('-', '').slice(2);

export type ProviderHandoffOptions = {
  currency?: string;
  cabinClass?: string;
  /** Optional hotel ss= refinement; dates and destination codes stay canonical. */
  accommodationQuery?: string;
};

export type ProviderHandoffResult = {
  searches: ProviderSearchOpen[];
  unavailable: Array<{ service: TravelServiceKind; reason: string }>;
};

export function buildProviderSearches(
  projection: CanonicalSearchProjection,
  services: TravelServiceKind[],
  options?: ProviderHandoffOptions,
): ProviderHandoffResult {
  const currency = options?.currency ?? 'AUD';
  const cabinClass = options?.cabinClass ?? 'economy';
  const adults = projection.adults;
  const target = services.length > 0 ? services : projection.services;
  const searches: ProviderSearchOpen[] = [];
  const unavailable: ProviderHandoffResult['unavailable'] = [];

  const originCode = projection.origin.airportCode;
  const destinationCode = projection.destination.airportCode;
  const destinationLabel =
    projection.destination.label ?? projection.destination.airportCode;
  const departDate = projection.departureDate;
  const returnDate = projection.returnDate;

  for (const service of target) {
    if (service === 'flights') {
      const from = normaliseAirport(originCode ?? '');
      const to = normaliseAirport(destinationCode ?? '');
      if (from.length !== 3 || to.length !== 3 || !departDate) {
        unavailable.push({
          service: 'flights',
          reason: 'Need origin, destination, and departure date codes before opening flights.',
        });
        continue;
      }
      const outbound = compactDate(departDate);
      const inbound = returnDate ? `/${compactDate(returnDate)}` : '';
      searches.push({
        service: 'flights',
        url: `https://www.skyscanner.com.au/transport/flights/${from}/${to}/${outbound}${inbound}/?adultsv2=${adults}&cabinclass=${cabinClass}&currency=${currency}`,
        originCode: from.toUpperCase(),
        destinationCode: to.toUpperCase(),
        departDate,
        returnDate,
        adults,
        travellerSource: projection.travellerSource,
      });
      continue;
    }

    if (service === 'accommodation') {
      const hotelQuery =
        options?.accommodationQuery?.trim() || destinationLabel || '';
      const destination = encodeURIComponent(hotelQuery);
      if (!destination || !departDate) {
        unavailable.push({
          service: 'accommodation',
          reason: 'Need a destination and check-in date for hotel search.',
        });
        continue;
      }
      const checkoutParam = returnDate ? `&checkout=${returnDate}` : '';
      searches.push({
        service: 'accommodation',
        url: `https://www.booking.com/searchresults.html?ss=${destination}&checkin=${departDate}${checkoutParam}&group_adults=${adults}&selected_currency=${currency}`,
        destinationCode,
        destinationLabel: destinationLabel ?? undefined,
        departDate,
        returnDate,
        adults,
        travellerSource: projection.travellerSource,
      });
      continue;
    }

    if (service === 'car_hire') {
      const to = normaliseAirport(destinationCode ?? '');
      if (to.length !== 3 || !departDate) {
        unavailable.push({
          service: 'car_hire',
          reason: 'Need destination and dates for car hire search.',
        });
        continue;
      }
      const outbound = compactDate(departDate);
      const inbound = returnDate ? compactDate(returnDate) : outbound;
      searches.push({
        service: 'car_hire',
        url: `https://www.skyscanner.com.au/carhire/landing.html#/cars/${to}/${to}/${outbound}/${inbound}?adults=${adults}&currency=${currency}`,
        destinationCode: to.toUpperCase(),
        departDate,
        returnDate,
        adults,
        travellerSource: projection.travellerSource,
      });
      continue;
    }

    unavailable.push({
      service,
      reason: `No live provider integration is wired for ${service.replace(/_/g, ' ')} yet.`,
    });
  }

  return { searches, unavailable };
}
