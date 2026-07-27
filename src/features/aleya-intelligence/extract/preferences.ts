import type { ExtractionPatch } from './types';
import { field, markChanged } from './shared';

export function extractBudget(text: string): ExtractionPatch['budget'] | undefined {
  const t = text.toLowerCase();
  // Require currency marker or explicit budget language — never treat years (2026) as amounts.
  const amount = t.match(/\$\s*(\d{3,6})\b|\b(\d{3,6})\s*(aud|usd|eur|gbp)\b/);
  const amountValue = amount ? Number(amount[1] ?? amount[2]) : undefined;
  const currency = amount?.[3]?.toUpperCase();

  if (/\bluxury\b|\bpremium\b/.test(t)) {
    return field({ amount: amountValue, currency, style: 'luxury' });
  }
  if (/\bbudget\b|\bcheap(?:er)?\b|\blow[- ]cost\b|\bless expensive\b/.test(t)) {
    return field({
      amount: amountValue,
      currency,
      style: 'budget',
      relative: /\bcheaper\b|\bless expensive\b/.test(t) ? 'cheaper' : undefined,
    });
  }
  if (amountValue != null) {
    return field({ amount: amountValue, currency, style: 'mid' });
  }
  return undefined;
}

export function extractPreferencesPatch(text: string): Partial<ExtractionPatch> {
  const patch: Partial<ExtractionPatch> = { changedFields: [] };
  const changed = patch.changedFields!;
  const lower = text.toLowerCase();

  const budget = extractBudget(text);
  if (budget) {
    patch.budget = budget;
    markChanged(changed, 'budget');
  }

  if (/\bflexible (?:on|with)?\s*dates?\b|\bdates? are flexible\b|\b\+\/?\-?\s*\d+\s*days?\b/.test(lower)) {
    patch.dateFlexibility = field('flexible');
    markChanged(changed, 'dateFlexibility');
  } else if (/\bexact dates?\b|\bmust (?:be|travel) on\b/.test(lower)) {
    patch.dateFlexibility = field('strict');
    markChanged(changed, 'dateFlexibility');
  }

  const rooms = lower.match(/(\d+)\s*rooms?/);
  const beds = lower.match(/\b(king|queen|twin|double)\s*beds?\b/);
  if (rooms || beds || /\bconnecting rooms?\b/.test(lower)) {
    patch.roomRequirements = field({
      rooms: rooms ? Number(rooms[1]) : undefined,
      beds: beds?.[1],
      connecting: /\bconnecting rooms?\b/.test(lower) || undefined,
    });
    markChanged(changed, 'roomRequirements');
  }

  const airline = text.match(
    /\b(?:prefer|fly(?:ing)?|with)\s+(Qantas|Jetstar|Virgin|Singapore Airlines|Emirates|Cathay)\b/i,
  );
  const cabin = lower.match(/\b(economy|premium economy|business|first)\s*class\b/);
  if (airline || cabin || /\bdirect(?: flights?)? only\b|\bnon[- ]stop\b/.test(lower)) {
    patch.airlinePreferences = field({
      airlines: airline ? [airline[1]!] : undefined,
      cabin: cabin?.[1],
      directOnly: /\bdirect(?: flights?)? only\b|\bnon[- ]stop\b/.test(lower) || undefined,
    });
    markChanged(changed, 'airlinePreferences');
  }

  const stars = lower.match(/(\d)\s*[- ]?star/);
  const niceHotel = /\b(?:nice|good|lovely|quality|decent)\s+hotel\b/.test(lower);
  if (stars || niceHotel || /\bboutique\b|\bnear the beach\b|\bpool\b/.test(lower)) {
    const amenities: string[] = [];
    if (/\bpool\b/.test(lower)) amenities.push('pool');
    if (/\bbeach\b/.test(lower)) amenities.push('beach');
    if (/\bboutique\b/.test(lower)) amenities.push('boutique');
    patch.hotelPreferences = field({
      stars: stars ? Number(stars[1]) : undefined,
      amenities: amenities.length ? amenities : undefined,
      notes: niceHotel ? 'nice hotel' : undefined,
    });
    markChanged(changed, 'hotelPreferences');
  }

  const diet: string[] = [];
  if (/\bvegetarian\b/.test(lower)) diet.push('vegetarian');
  if (/\bvegan\b/.test(lower)) diet.push('vegan');
  if (/\bgluten[- ]free\b/.test(lower)) diet.push('gluten-free');
  if (/\bhalal\b/.test(lower)) diet.push('halal');
  if (/\bkosher\b/.test(lower)) diet.push('kosher');
  if (diet.length) {
    patch.dietaryRequirements = field(diet);
    markChanged(changed, 'dietaryRequirements');
  }

  const access: string[] = [];
  if (/\bwheelchair\b/.test(lower)) access.push('wheelchair');
  if (/\bstep[- ]free\b/.test(lower)) access.push('step-free');
  if (/\baccessible\b/.test(lower)) access.push('accessible');
  if (access.length) {
    patch.accessibility = field(access);
    markChanged(changed, 'accessibility');
  }

  const loyalty = text.match(
    /\b((?:Qantas|Virgin|Marriott|Hilton|Accor)\s*(?:Frequent Flyer|FF|Bonvoy|Honors|Live Limitless)?)\b/gi,
  );
  if (loyalty?.length) {
    patch.loyaltyMemberships = field(Array.from(new Set(loyalty.map((s) => s.trim()))));
    markChanged(changed, 'loyaltyMemberships');
  }

  if (/\bspecial request\b|\banniversary\b|\bhoneymoon setup\b|\blate checkout\b/.test(lower)) {
    const notes: string[] = [];
    if (/\banniversary\b/.test(lower)) notes.push('anniversary');
    if (/\bhoneymoon\b/.test(lower)) notes.push('honeymoon');
    if (/\blate checkout\b/.test(lower)) notes.push('late checkout');
    if (notes.length) {
      patch.specialRequests = field(notes);
      markChanged(changed, 'specialRequests');
    }
  }

  const activityHits = text.match(/\b(?:visit|see|do)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})/g);
  if (activityHits?.length && /\bactivit/i.test(text)) {
    patch.activities = field(activityHits.map((h) => h.replace(/^(visit|see|do)\s+/i, '').trim()));
    markChanged(changed, 'activities');
  }

  if (
    /\bitinerary\b|\bday[- ]by[- ]day\b|\bdaily schedule\b|\bbuild (?:me )?an? itinerary\b|\bcreate (?:an? )?itinerary\b/.test(
      lower,
    )
  ) {
    patch.explicitItineraryIntent = true;
    markChanged(changed, 'explicitItineraryIntent');
  }

  return patch;
}
