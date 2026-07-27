import type { TravelServiceKind } from '../types';
import type { ExtractionPatch, ServiceOps } from './types';
import { markChanged } from './shared';

const SERVICE_FRAGMENT: Array<{ kind: TravelServiceKind; re: RegExp }> = [
  { kind: 'car_hire', re: /\b(?:car hire|rental car|hire car|rent(?:al)? car|vehicle hire|the rental|the car)\b/i },
  { kind: 'accommodation', re: /\b(?:hotels?|resorts?|accommodation|lodging|the hotel|the stay)\b/i },
  { kind: 'flights', re: /\b(?:flights?|airfare|the flights?)\b/i },
  { kind: 'transfers', re: /\b(?:transfers?|airport transfer|taxi|rideshare)\b/i },
  { kind: 'activities', re: /\b(?:activit(?:y|ies)|experiences?|tours?)\b/i },
];

function detectServicesInFragment(fragment: string): TravelServiceKind[] {
  const hits: TravelServiceKind[] = [];
  for (const { kind, re } of SERVICE_FRAGMENT) {
    if (re.test(fragment)) hits.push(kind);
  }
  return hits;
}

/** Split on independent actions; keep same-op coordinated lists intact. */
function splitServiceClauses(text: string): string[] {
  return text
    .split(
      /\s*(?:,|;|\.(?=\s|$)|!|\?|\bbut\b|\bthen\b|\bwhile\b|\bhowever\b)\s*|\s*\band\s+(?=(?:also\s+)?(?:add|include|get(?:\s+me)?|book|keep|retain|still\s+(?:need|want)|leave|remove|forget|cancel|don'?t|do\s+not|without|no)\b)/i,
    )
    .map((part) => part.trim())
    .filter(Boolean);
}

type ServiceClauseIntent = 'remove' | 'add' | 'keep' | 'neutral';

function classifyServiceClauseIntent(clause: string): ServiceClauseIntent {
  const t = clause.toLowerCase();
  if (/\b(?:keep|retain|still (?:need|want)|leave)\b/.test(t)) return 'keep';
  if (
    /\b(?:no|without|remove|forget|don'?t need|do not need|do not include|cancel)\b/.test(t) ||
    /\b(?:not needed|anymore|off|removed)\b/.test(t) ||
    /\bstay with (?:family|friends|relatives)\b/.test(t)
  ) {
    return 'remove';
  }
  if (/\b(?:add(?:\s+it)?(?:\s+back)?|include|get(?:\s+me)?|book)\b/.test(t)) return 'add';
  return 'neutral';
}

function isServiceListContinuation(clause: string): boolean {
  let rest = clause;
  for (const { re } of SERVICE_FRAGMENT) {
    rest = rest.replace(new RegExp(re.source, 'gi'), ' ');
  }
  rest = rest
    .replace(/\b(?:the|a|an|and|also|plus|too|as\s+well|please)\b/gi, ' ')
    .replace(/[,&\s]+/g, '')
    .trim();
  return rest.length === 0;
}

export function extractServiceOperations(text: string): ServiceOps {
  const ops = new Map<TravelServiceKind, 'remove' | 'add' | 'keep'>();
  let lastRemoved: TravelServiceKind | undefined;
  let activeIntent: Exclude<ServiceClauseIntent, 'neutral'> | undefined;

  for (const clause of splitServiceClauses(text)) {
    const intent = classifyServiceClauseIntent(clause);
    const services = detectServicesInFragment(clause);
    const effectiveIntent: ServiceClauseIntent =
      intent !== 'neutral'
        ? intent
        : services.length && activeIntent && isServiceListContinuation(clause)
          ? activeIntent
          : 'neutral';

    if (intent !== 'neutral') activeIntent = intent;

    if (!services.length) {
      if (effectiveIntent === 'add' && /\badd(?:\s+it)?(?:\s+back)?\b/i.test(clause) && lastRemoved) {
        ops.set(lastRemoved, 'add');
      }
      continue;
    }

    for (const service of services) {
      if (effectiveIntent === 'remove') {
        ops.set(service, 'remove');
        lastRemoved = service;
      } else if (effectiveIntent === 'keep') {
        ops.set(service, 'keep');
      } else if (effectiveIntent === 'add') {
        ops.set(service, 'add');
      }
    }
  }

  if (/\bstay with (?:family|friends|relatives)\b/i.test(text)) {
    const current = ops.get('accommodation');
    if (current !== 'add' && current !== 'keep') ops.set('accommodation', 'remove');
  }

  const removeServices: TravelServiceKind[] = [];
  const addServices: TravelServiceKind[] = [];
  for (const [service, op] of ops) {
    if (op === 'remove') removeServices.push(service);
    if (op === 'add' || op === 'keep') addServices.push(service);
  }
  return { removeServices, addServices };
}

export function extractRequestedServices(text: string): TravelServiceKind[] {
  const t = text.toLowerCase();
  const services: TravelServiceKind[] = [];
  if (/\bflights?\b|\bflying\b|\bfly\b|\bairfare\b/.test(t)) services.push('flights');
  const stayWithFamily = /\bstay with (?:family|friends|relatives)\b/.test(t);
  if (
    /\bhotels?\b|\bresorts?\b|\baccommodation\b|\blodging\b/.test(t) ||
    (/\bstay\b/.test(t) && !stayWithFamily)
  ) {
    services.push('accommodation');
  }
  if (/\bcar hire\b|\brent(?:al)? car\b|\bhire a car\b|\brental car\b|\bvehicle hire\b/.test(t)) {
    services.push('car_hire');
  }
  if (/\btransfer\b|\bairport transfer\b|\btaxi\b|\brideshare\b/.test(t)) services.push('transfers');
  if (/\bactivit(?:y|ies)\b|\bexperience\b|\btour\b/.test(t)) services.push('activities');
  return Array.from(new Set(services));
}

export function extractServicesPatch(
  text: string,
  options: {
    hasStayArea: boolean;
    hasDuration: boolean;
    hasHotelPrefs: boolean;
    previouslyExcluded: Set<TravelServiceKind>;
  },
): Partial<ExtractionPatch> {
  const patch: Partial<ExtractionPatch> = { changedFields: [] };
  const changed = patch.changedFields!;
  const ops = extractServiceOperations(text);
  const removals = ops.removeServices;

  if (removals.length) {
    patch.removeServices = removals;
    markChanged(changed, 'requestedServices');
  }

  const services = Array.from(
    new Set([
      ...extractRequestedServices(text).filter((s) => !removals.includes(s)),
      ...ops.addServices.filter((s) => !removals.includes(s)),
    ]),
  );

  // Stay area / duration / hotel prefs imply accommodation unless removed or excluded
  const canAddAccommodation =
    !removals.includes('accommodation') && !options.previouslyExcluded.has('accommodation');
  if (
    canAddAccommodation &&
    (options.hasStayArea || options.hasHotelPrefs) &&
    !services.includes('accommodation')
  ) {
    services.push('accommodation');
  }
  if (
    canAddAccommodation &&
    options.hasDuration &&
    !services.includes('accommodation') &&
    !options.previouslyExcluded.has('accommodation')
  ) {
    // Duration alone implies lodging need only when not previously excluded
    services.push('accommodation');
  }

  if (services.length) {
    patch.requestedServices = Array.from(new Set(services));
    markChanged(changed, 'requestedServices');
  }

  return patch;
}
