import type { ConversationState, TravelServiceKind } from '../types';
import { getActiveSearchSession, setActiveSearchSession } from './runtime';
import type {
  ActiveSearchSession,
  SearchFilterPatch,
  SearchResultItem,
} from './types';

export function getSearchMemory(): ActiveSearchSession | null {
  return getActiveSearchSession();
}

export function isSearchActive(): boolean {
  return Boolean(getActiveSearchSession());
}

export function resetSearchMemory(): void {
  setActiveSearchSession(null);
}

export function endSearchSession(): void {
  setActiveSearchSession(null);
}

function placeholderResults(
  services: TravelServiceKind[],
  state: ConversationState,
  filters: SearchFilterPatch,
): SearchResultItem[] {
  const dest = state.destination?.value ?? 'your destination';
  const area = filters.accommodation?.area ?? state.accommodationArea?.value;
  const items: SearchResultItem[] = [];

  if (services.includes('flights') || services.length === 0) {
    const from = state.origin?.value ?? 'Origin';
    items.push(
      {
        id: 'flight-1',
        service: 'flights',
        label: 'first flight option',
        summary: `${from} → ${dest}`,
        planningNote: 'Planning placeholder — live fares come from providers.',
      },
      {
        id: 'flight-2',
        service: 'flights',
        label: 'second flight option',
        summary: `${from} → ${dest} (earlier arrival window)`,
        planningNote: 'Planning placeholder — live fares come from providers.',
      },
      {
        id: 'flight-3',
        service: 'flights',
        label: 'third flight option',
        summary: `${from} → ${dest}`,
        planningNote: 'Planning placeholder — live fares come from providers.',
      },
    );
  }

  if (services.includes('accommodation') || services.length === 0) {
    const where = area ? ` near ${area}` : ` in ${dest}`;
    items.push(
      {
        id: 'hotel-1',
        service: 'accommodation',
        label: 'first hotel option',
        summary: `Stay${where}`,
        planningNote: 'Planning placeholder — live rates come from providers.',
      },
      {
        id: 'hotel-2',
        service: 'accommodation',
        label: 'second hotel option',
        summary: `Stay${where}`,
        planningNote: 'Planning placeholder — live rates come from providers.',
      },
      {
        id: 'hotel-3',
        service: 'accommodation',
        label: 'third hotel option',
        summary: `Stay${where}`,
        planningNote: 'Planning placeholder — live rates come from providers.',
      },
    );
  }

  if (services.includes('car_hire')) {
    items.push(
      {
        id: 'car-1',
        service: 'car_hire',
        label: 'first car hire option',
        summary: `Car hire in ${dest}`,
        planningNote: 'Planning placeholder — live rates come from providers.',
      },
      {
        id: 'car-2',
        service: 'car_hire',
        label: 'second car hire option',
        summary: `Car hire in ${dest}`,
        planningNote: 'Planning placeholder — live rates come from providers.',
      },
    );
  }

  return items;
}

export function startSearchSession(
  state: ConversationState,
  services: TravelServiceKind[],
): ActiveSearchSession {
  const session: ActiveSearchSession = {
    id: `search-${Date.now()}`,
    startedAt: new Date().toISOString(),
    conversationId: state.conversationId,
    providersQueried: [...services],
    filters: {},
    results: placeholderResults(services, state, {}),
    focusService: undefined,
  };
  setActiveSearchSession(session);
  return session;
}

export function refineSearchSession(
  state: ConversationState,
  services: TravelServiceKind[],
  filters: SearchFilterPatch,
): ActiveSearchSession {
  const prev = getActiveSearchSession();
  const mergedFilters: SearchFilterPatch = {
    accommodation: { ...prev?.filters.accommodation, ...filters.accommodation },
    flights: { ...prev?.filters.flights, ...filters.flights },
    carHire: { ...prev?.filters.carHire, ...filters.carHire },
  };
  const queried = Array.from(
    new Set([...(prev?.providersQueried ?? []), ...services]),
  ) as TravelServiceKind[];
  const session: ActiveSearchSession = {
    id: prev?.id ?? `search-${Date.now()}`,
    startedAt: prev?.startedAt ?? new Date().toISOString(),
    conversationId: state.conversationId,
    providersQueried: queried,
    filters: mergedFilters,
    results: placeholderResults(queried, state, mergedFilters),
    focusService: services[0] ?? prev?.focusService,
    selected: prev?.selected,
  };
  setActiveSearchSession(session);
  return session;
}

export function selectResult(
  service: TravelServiceKind,
  ordinal: number,
): SearchResultItem | undefined {
  const session = getActiveSearchSession();
  if (!session) return undefined;
  const ofService = session.results.filter((r) => r.service === service);
  const item = ofService[ordinal - 1];
  if (!item) return undefined;
  setActiveSearchSession({
    ...session,
    selected: { service, id: item.id, label: item.label },
  });
  return item;
}
