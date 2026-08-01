import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal restaurant-preference extraction boundary.
 *
 * Phase 18F: captures a concise dining preference when restaurants are already
 * requested (`currentState.restaurantsRequested === true`). Deterministic and
 * local — emits only a normalized restaurantPreference string, never false or
 * null clears. Bare cuisine/style answers require the restaurants-requested
 * gate so unrelated food mentions do not claim ownership.
 */
export class RestaurantPreferenceConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    if (input.currentState.restaurantsRequested !== true) {
      return {
        stateUpdate: {},
      };
    }
    const preference = extractRestaurantPreference(input.message);
    if (preference === null) {
      return {
        stateUpdate: {},
      };
    }
    return {
      stateUpdate: {
        restaurantPreference: preference,
      },
    };
  }
}

/** Trim edges without String.prototype.trim (architecture boundary). */
function edgeTrim(value: string): string {
  return value.replace(/^\s+|\s+$/g, '');
}

/**
 * Ordered preference matchers → normalized stored value.
 * First match wins. Conservative catalogue only.
 */
const PREFERENCE_RULES: ReadonlyArray<{
  pattern: RegExp;
  value: string;
}> = [
  {
    pattern:
      /\bfamily[\s-]?friendly\s+restaurants?\b|\bfamily[\s-]?friendly\s+(?:dining|food)\b/i,
    value: 'family-friendly restaurants',
  },
  {
    pattern: /\bfine\s+dining\b/i,
    value: 'fine dining',
  },
  {
    pattern: /\bcasual\s+dining\b|\bsomething\s+casual\b|\bcasual\s+food\b/i,
    value: 'casual dining',
  },
  {
    pattern: /\blocal\s+cuisine\b|\bprefer\s+local\s+cuisine\b|\blocal\s+food\b/i,
    value: 'local cuisine',
  },
  {
    pattern: /\bhalal\s+(?:food|restaurants?|dining)\b|\bhalal\b/i,
    value: 'halal food',
  },
  {
    pattern:
      /\bvegetarian\s+(?:food|meals?|restaurants?|dining)\b|\bvegetarian\b/i,
    value: 'vegetarian food',
  },
  {
    pattern:
      /\b(?:looking\s+for|want(?:ing)?|would\s+like|prefer|like)\s+seafood\b|\bseafood\b/i,
    value: 'seafood',
  },
  {
    pattern: /\bitalian(?:\s+(?:food|cuisine|restaurants?))?\b/i,
    value: 'Italian',
  },
  {
    pattern: /\bjapanese(?:\s+(?:food|cuisine|restaurants?))?\b/i,
    value: 'Japanese',
  },
  {
    pattern: /\bthai(?:\s+(?:food|cuisine|restaurants?))?\b/i,
    value: 'Thai',
  },
  {
    pattern: /\bchinese(?:\s+(?:food|cuisine|restaurants?))?\b/i,
    value: 'Chinese',
  },
  {
    pattern: /\bmexican(?:\s+(?:food|cuisine|restaurants?))?\b/i,
    value: 'Mexican',
  },
  {
    pattern: /\bindian(?:\s+(?:food|cuisine|restaurants?))?\b/i,
    value: 'Indian',
  },
  {
    pattern: /\bfrench(?:\s+(?:food|cuisine|restaurants?))?\b/i,
    value: 'French',
  },
  {
    pattern: /\bgreek(?:\s+(?:food|cuisine|restaurants?))?\b/i,
    value: 'Greek',
  },
  {
    pattern: /\bkorean(?:\s+(?:food|cuisine|restaurants?))?\b/i,
    value: 'Korean',
  },
  {
    pattern: /\bvietnamese(?:\s+(?:food|cuisine|restaurants?))?\b/i,
    value: 'Vietnamese',
  },
];

function extractRestaurantPreference(message: string): string | null {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return null;
  }
  if (/\?/.test(text)) {
    return null;
  }
  for (const rule of PREFERENCE_RULES) {
    if (rule.pattern.test(text)) {
      return rule.value;
    }
  }
  return null;
}
