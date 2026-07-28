import type { ConversationState, TravelServiceKind } from '../types';
import { getSearchSession, setSearchSession } from './memory';
import type { ActiveSearchSession, SearchResultItem } from './types';

export function endSearchSession(): void {
  setSearchSession(null);
}

function placeholders(
  services: TravelServiceKind[],
  state: ConversationState,
  filters: Record<string, string>,
): SearchResultItem[] {
  const dest = state.destination?.value ?? 'your destination';
  const area = filters.area ?? state.accommodationArea?.value;
  const items: SearchResultItem[] = [];

  if (services.includes('flights')) {
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
        summary: `${from} → ${dest} (earlier arrival)`,
        planningNote: 'Planning placeholder — live fares come from providers.',
      },
    );
  }

  if (services.includes('accommodation')) {
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
    );
  }

  if (services.includes('car_hire')) {
    items.push({
      id: 'car-1',
      service: 'car_hire',
      label: 'first car hire option',
      summary: `Car hire in ${dest}`,
      planningNote: 'Planning placeholder — live rates come from providers.',
    });
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
    results: placeholders(services, state, {}),
  };
  setSearchSession(session);
  return session;
}

export function refineSearchSession(
  state: ConversationState,
  services: TravelServiceKind[],
  filters: Record<string, string>,
): ActiveSearchSession {
  const prev = getSearchSession();
  const merged = { ...(prev?.filters ?? {}), ...filters };
  const queried = Array.from(
    new Set([...(prev?.providersQueried ?? []), ...services]),
  ) as TravelServiceKind[];
  const session: ActiveSearchSession = {
    id: prev?.id ?? `search-${Date.now()}`,
    startedAt: prev?.startedAt ?? new Date().toISOString(),
    conversationId: state.conversationId,
    providersQueried: queried,
    filters: merged,
    results: placeholders(queried, state, merged),
    focusService: services[0] ?? prev?.focusService,
    selected: prev?.selected,
  };
  setSearchSession(session);
  return session;
}

export function selectResult(
  service: TravelServiceKind,
  ordinal: number,
): SearchResultItem | undefined {
  const session = getSearchSession();
  if (!session) return undefined;
  const ofService = session.results.filter((r) => r.service === service);
  const item = ofService[ordinal - 1];
  if (!item) return undefined;
  setSearchSession({
    ...session,
    selected: { service, id: item.id, label: item.label },
  });
  return item;
}
