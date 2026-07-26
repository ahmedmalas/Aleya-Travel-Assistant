import { detectItineraryConflicts, type ItineraryConflict } from './platformCalculations';
import type {
  CalendarViewMode,
  CollaborationRole,
  GlobalSearchHit,
  TripDocument,
  TripTemplate,
  VaultFilterKey,
  VaultSortKey,
  VaultTrip,
} from './vaultDomain';
import type { TripStop } from './tripDomain';

export type DocumentExpiryReminder = {
  documentId: string;
  tripId: string;
  tripName: string;
  title: string;
  expiryDate: string;
  daysUntilExpiry: number;
  severity: 'expired' | 'urgent' | 'soon' | 'ok';
};

export type PermissionMatrix = Record<
  CollaborationRole,
  {
    canEditTrip: boolean;
    canManageMembers: boolean;
    canDeleteTrip: boolean;
    canExport: boolean;
    canManageDocuments: boolean;
  }
>;

export const PERMISSION_MATRIX: PermissionMatrix = {
  owner: {
    canEditTrip: true,
    canManageMembers: true,
    canDeleteTrip: true,
    canExport: true,
    canManageDocuments: true,
  },
  editor: {
    canEditTrip: true,
    canManageMembers: false,
    canDeleteTrip: false,
    canExport: true,
    canManageDocuments: true,
  },
  viewer: {
    canEditTrip: false,
    canManageMembers: false,
    canDeleteTrip: false,
    canExport: true,
    canManageDocuments: false,
  },
};

const normalize = (value: string): string => value.toLowerCase().trim();

export const filterAndSortVaultTrips = (
  trips: VaultTrip[],
  options: {
    query?: string;
    filter?: VaultFilterKey;
    sort?: VaultSortKey;
  } = {},
): VaultTrip[] => {
  const query = normalize(options.query ?? '');
  const filter = options.filter ?? 'all';
  const sort = options.sort ?? 'lastOpened';

  let next = [...trips];
  if (filter === 'favourites') {
    next = next.filter((trip) => trip.favourite);
  } else if (filter === 'archived') {
    next = next.filter((trip) => trip.status === 'archived');
  } else if (filter === 'draft') {
    next = next.filter((trip) => trip.status === 'draft');
  } else if (filter === 'active') {
    next = next.filter((trip) => trip.status === 'active');
  } else if (filter === 'upcoming') {
    next = next.filter((trip) => trip.status === 'upcoming');
  } else if (filter === 'completed') {
    next = next.filter((trip) => trip.status === 'completed');
  } else if (filter === 'cancelled') {
    next = next.filter((trip) => trip.status === 'cancelled');
  }

  if (query) {
    next = next.filter((trip) => {
      const haystack = [
        trip.tripName,
        trip.destination,
        trip.notes,
        trip.purpose,
        trip.status,
        trip.travelStyle,
        ...(trip.tags ?? []),
        ...(trip.destinationsList ?? []),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }

  next.sort((left, right) => {
    if (sort === 'name') return left.tripName.localeCompare(right.tripName);
    if (sort === 'departure') return (left.departureDate || '9999').localeCompare(right.departureDate || '9999');
    if (sort === 'updated') return right.updatedAt.localeCompare(left.updatedAt);
    if (sort === 'favourite') {
      if (left.favourite !== right.favourite) return left.favourite ? -1 : 1;
      return right.lastOpenedAt.localeCompare(left.lastOpenedAt);
    }
    return right.lastOpenedAt.localeCompare(left.lastOpenedAt);
  });

  return next;
};

export const searchVault = (trips: VaultTrip[], query: string): GlobalSearchHit[] => {
  const tokens = normalize(query)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (tokens.length === 0) {
    return [];
  }

  const matches = (text: string): boolean => {
    const value = normalize(text);
    return tokens.every((token) => value.includes(token));
  };

  const hits: GlobalSearchHit[] = [];
  for (const trip of trips) {
    if (
      matches(
        `${trip.tripName} ${trip.destination} ${trip.notes} ${(trip.tags ?? []).join(' ')} ${(trip.destinationsList ?? []).join(' ')}`,
      )
    ) {
      hits.push({
        id: `trip-${trip.id}`,
        tripId: trip.id,
        tripName: trip.tripName,
        entity: 'trip',
        title: trip.tripName,
        subtitle: trip.destination || 'No destination',
      });
    }
    for (const destination of trip.destinationsList ?? []) {
      if (matches(destination)) {
        hits.push({
          id: `destination-list-${trip.id}-${destination}`,
          tripId: trip.id,
          tripName: trip.tripName,
          entity: 'destination',
          title: destination,
          subtitle: 'Trip destination',
        });
      }
    }
    for (const profile of trip.destinations ?? []) {
      if (
        matches(
          `${profile.name} ${profile.country} ${profile.city} ${profile.practicalNotes} ${profile.safetyNotes}`,
        )
      ) {
        hits.push({
          id: `destination-${trip.id}-${profile.id}`,
          tripId: trip.id,
          tripName: trip.tripName,
          entity: 'destination',
          title: profile.name,
          subtitle: profile.country || 'Destination profile',
        });
      }
    }
    for (const stop of trip.stops) {
      if (matches(`${stop.title} ${stop.location} ${stop.notes} ${stop.bookingReference} ${stop.supplierDetails}`)) {
        hits.push({
          id: `stop-${trip.id}-${stop.id}`,
          tripId: trip.id,
          tripName: trip.tripName,
          entity: 'itinerary',
          title: stop.title,
          subtitle: `${stop.date || `Day ${stop.day}`} · ${stop.location || 'No location'}`,
        });
      }
    }
    for (const booking of trip.bookings) {
      if (matches(`${booking.title} ${booking.provider} ${booking.confirmationNumber} ${booking.location}`)) {
        hits.push({
          id: `booking-${trip.id}-${booking.id}`,
          tripId: trip.id,
          tripName: trip.tripName,
          entity: 'booking',
          title: booking.title,
          subtitle: `${booking.type} · ${booking.provider || 'No provider'}`,
        });
      }
    }
    for (const expense of trip.expenses) {
      if (matches(`${expense.title} ${expense.category} ${expense.notes}`)) {
        hits.push({
          id: `expense-${trip.id}-${expense.id}`,
          tripId: trip.id,
          tripName: trip.tripName,
          entity: 'expense',
          title: expense.title,
          subtitle: `${expense.category} · ${expense.amount.toFixed(2)} ${expense.currency}`,
        });
      }
    }
    for (const list of trip.packingLists) {
      for (const item of list.items) {
        if (matches(`${item.name} ${item.category} ${item.customCategory} ${list.name}`)) {
          hits.push({
            id: `packing-${trip.id}-${item.id}`,
            tripId: trip.id,
            tripName: trip.tripName,
            entity: 'packing',
            title: item.name,
            subtitle: `${list.name} · ${item.category}`,
          });
        }
      }
    }
    for (const traveller of trip.travellers) {
      if (
        matches(
          `${traveller.name} ${traveller.preferredName} ${traveller.nationality} ${traveller.loyaltyPrograms} ${traveller.homeAirport} ${traveller.travelPreferences}`,
        )
      ) {
        hits.push({
          id: `traveller-${trip.id}-${traveller.id}`,
          tripId: trip.id,
          tripName: trip.tripName,
          entity: 'traveller',
          title: traveller.preferredName || traveller.name,
          subtitle: traveller.nationality || 'Traveller profile',
        });
      }
    }
    for (const entry of trip.journalEntries ?? []) {
      if (matches(`${entry.title} ${entry.notes} ${entry.highlights} ${entry.locationName}`)) {
        hits.push({
          id: `note-${trip.id}-${entry.id}`,
          tripId: trip.id,
          tripName: trip.tripName,
          entity: 'note',
          title: entry.title || 'Trip note',
          subtitle: 'Journal note',
        });
      }
    }
    for (const transport of trip.groundTransport ?? []) {
      if (
        matches(
          `${transport.mode} ${transport.provider} ${transport.notes} ${transport.pickupLocation} ${transport.dropoffLocation}`,
        )
      ) {
        hits.push({
          id: `service-${trip.id}-${transport.id}`,
          tripId: trip.id,
          tripName: trip.tripName,
          entity: 'service',
          title: `${transport.mode} · ${transport.provider || 'provider tbd'}`,
          subtitle: 'Ground transport planning',
        });
      }
    }
    for (const document of trip.documents) {
      if (matches(`${document.title} ${document.type} ${document.holderName} ${document.issuingCountry}`)) {
        hits.push({
          id: `document-${trip.id}-${document.id}`,
          tripId: trip.id,
          tripName: trip.tripName,
          entity: 'document',
          title: document.title,
          subtitle: `${document.type} · exp ${document.expiryDate || 'n/a'}`,
        });
      }
    }
  }
  return hits.slice(0, 100);
};

export const daysUntilDate = (isoDate: string, today = new Date()): number | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const target = new Date(`${isoDate}T00:00:00`);
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
};

export const collectDocumentExpiryReminders = (
  trips: VaultTrip[],
  today = new Date(),
): DocumentExpiryReminder[] => {
  const reminders: DocumentExpiryReminder[] = [];
  for (const trip of trips) {
    for (const document of trip.documents) {
      const days = daysUntilDate(document.expiryDate, today);
      if (days === null) continue;
      const severity: DocumentExpiryReminder['severity'] =
        days < 0 ? 'expired' : days <= 14 ? 'urgent' : days <= 60 ? 'soon' : 'ok';
      if (severity === 'ok') continue;
      reminders.push({
        documentId: document.id,
        tripId: trip.id,
        tripName: trip.tripName,
        title: document.title,
        expiryDate: document.expiryDate,
        daysUntilExpiry: days,
        severity,
      });
    }
  }
  return reminders.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
};

export const canPerform = (role: CollaborationRole, action: keyof PermissionMatrix['owner']): boolean =>
  PERMISSION_MATRIX[role][action];

export const startOfWeek = (date: Date): Date => {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
};

export const toIsoDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const listCalendarDays = (anchor: Date, mode: CalendarViewMode): string[] => {
  if (mode === 'day') {
    return [toIsoDate(anchor)];
  }
  if (mode === 'week') {
    const start = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return toIsoDate(day);
    });
  }
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = new Date(year, month, 1);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return toIsoDate(day);
  });
};

export const stopsForDate = (stops: TripStop[], date: string): TripStop[] =>
  stops
    .filter((stop) => stop.date === date)
    .sort((a, b) => {
      if (a.startTime && b.startTime && a.startTime !== b.startTime) {
        return a.startTime.localeCompare(b.startTime);
      }
      return a.order - b.order;
    });

export const calendarConflictsForDate = (stops: TripStop[], date: string): ItineraryConflict[] =>
  detectItineraryConflicts(stopsForDate(stops, date));

export const filterTemplates = (templates: TripTemplate[], query: string): TripTemplate[] => {
  const normalized = normalize(query);
  if (!normalized) return templates;
  return templates.filter((template) =>
    `${template.name} ${template.description}`.toLowerCase().includes(normalized),
  );
};

export const summarizeDocuments = (documents: TripDocument[]) => ({
  total: documents.length,
  withExpiry: documents.filter((doc) => Boolean(doc.expiryDate)).length,
  withAttachments: documents.filter((doc) => Boolean(doc.attachmentName)).length,
});
