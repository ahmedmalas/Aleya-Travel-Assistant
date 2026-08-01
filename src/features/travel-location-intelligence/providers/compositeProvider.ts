import type {
  LocationResolutionContext,
  LocationResolutionResult,
  NearbyRequest,
  ResolvedTravelPlace,
} from '../types';
import type { TravelLocationProvider } from './contracts';
import { LocalTravelLocationProvider } from './localProvider';
import { RemoteTravelLocationProvider } from './remoteProvider';
import { getCachedLocationResults, setCachedLocationResults } from '../cache';
import { rankLocationResults } from '../rank';

/**
 * Composite provider: deterministic local first, remote when local is insufficient.
 * Remote failures never throw — conversation continues on local/empty results.
 */
export class CompositeTravelLocationProvider implements TravelLocationProvider {
  readonly id = 'composite';

  constructor(
    private readonly local: TravelLocationProvider = new LocalTravelLocationProvider(),
    private readonly remote: TravelLocationProvider = new RemoteTravelLocationProvider(),
  ) {}

  resolveSync(
    query: string,
    context?: LocationResolutionContext,
  ): LocationResolutionResult[] {
    const cached = getCachedLocationResults(query, context);
    if (cached) return cached;
    const local =
      this.local.resolveSync?.(query, context) ??
      ([] as LocationResolutionResult[]);
    const ranked = rankLocationResults(local, context);
    if (ranked.length) setCachedLocationResults(query, context, ranked);
    return ranked;
  }

  async resolve(
    query: string,
    context?: LocationResolutionContext,
  ): Promise<LocationResolutionResult[]> {
    const cached = getCachedLocationResults(query, context);
    if (cached) return cached;

    let local: LocationResolutionResult[] = [];
    try {
      local = this.local.resolveSync?.(query, context) ?? (await this.local.resolve(query, context));
    } catch {
      local = [];
    }

    const strongLocal = local.filter((r) => r.score >= 0.85);
    if (strongLocal.length === 1 && strongLocal[0]!.place.matchType !== 'fuzzy') {
      const ranked = rankLocationResults(strongLocal, context);
      setCachedLocationResults(query, context, ranked);
      return ranked;
    }

    let remote: LocationResolutionResult[] = [];
    try {
      remote = await this.remote.resolve(query, context);
    } catch {
      remote = [];
    }

    const merged = dedupeResults([...local, ...remote]);
    const ranked = rankLocationResults(merged, context);
    setCachedLocationResults(query, context, ranked);
    return ranked;
  }

  async autocomplete(
    query: string,
    context?: LocationResolutionContext,
  ): Promise<LocationResolutionResult[]> {
    return this.resolve(query, { ...context, maxResults: 10 });
  }

  async nearby(
    place: ResolvedTravelPlace,
    request: NearbyRequest,
  ): Promise<LocationResolutionResult[]> {
    if (this.local.nearby) return this.local.nearby(place, request);
    return [];
  }
}

function dedupeResults(results: LocationResolutionResult[]): LocationResolutionResult[] {
  const seen = new Set<string>();
  const out: LocationResolutionResult[] = [];
  for (const row of results) {
    const key = `${row.place.canonicalName.toLowerCase()}|${row.place.countryCode ?? ''}|${row.place.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

let defaultProvider: CompositeTravelLocationProvider | null = null;

export function getDefaultLocationProvider(): CompositeTravelLocationProvider {
  if (!defaultProvider) defaultProvider = new CompositeTravelLocationProvider();
  return defaultProvider;
}

export function setDefaultLocationProviderForTests(
  provider: CompositeTravelLocationProvider | null,
): void {
  defaultProvider = provider;
}
