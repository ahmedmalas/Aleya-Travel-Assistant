/**
 * Phase 17G — shared deterministic passenger-count repair cue matching.
 *
 * Private to conversation-core extraction. Does not parse general count
 * statements; only the narrow repair families:
 *   Actually[,]? {count} {noun}
 *   Not {oldCount} {noun}, {newCount} {noun}
 *   Change the {fieldName} count to {newCount}
 */

/** Trim edges without String.prototype.trim (architecture boundary). */
function edgeTrim(value: string): string {
  return value.replace(/^\s+|\s+$/g, '');
}

const COUNT_TOKEN = String.raw`(\d+|one|two|three|four|five|six|seven|eight|nine|ten)`;

/**
 * "Actually, 3 adults" / "Actually 2 children" — whole-message repair only,
 * so contextual "Actually, the hotel allows 3 adults" stays unmatched.
 */
export function matchActuallyPassengerCountRepair(
  message: string,
  nounPattern: string,
): string | null {
  const match = edgeTrim(message).match(
    new RegExp(
      String.raw`^actually,?\s+${COUNT_TOKEN}\s+${nounPattern}[.!?]*$`,
      'i',
    ),
  );
  const captured = match?.[1];
  return typeof captured === 'string' ? captured : null;
}

/**
 * "Not 2 adults, 3 adults" — returns only the new count token.
 */
export function matchContrastPassengerCountRepair(
  message: string,
  nounPattern: string,
): string | null {
  const match = edgeTrim(message).match(
    new RegExp(
      String.raw`^not\s+${COUNT_TOKEN}\s+${nounPattern},\s*${COUNT_TOKEN}\s+${nounPattern}[.!?]*$`,
      'i',
    ),
  );
  const captured = match?.[2];
  return typeof captured === 'string' ? captured : null;
}

/**
 * "Change the adult count to 3" / "Change the children count to 2".
 */
export function matchChangeFieldCountToRepair(
  message: string,
  fieldNamePattern: string,
): string | null {
  const match = edgeTrim(message).match(
    new RegExp(
      String.raw`\bchange\s+the\s+${fieldNamePattern}\s+count\s+to\s+${COUNT_TOKEN}\b`,
      'i',
    ),
  );
  const captured = match?.[1];
  return typeof captured === 'string' ? captured : null;
}

/**
 * Try the three Phase 17G repair families for one passenger noun/field.
 * `parseCountToken` is the field extractor's existing ≥1 parser.
 */
export function extractPassengerCountRepairToken(
  message: string,
  nounPattern: string,
  fieldNamePattern: string,
  parseCountToken: (raw: string) => number | null,
): number | null {
  const actuallyToken = matchActuallyPassengerCountRepair(message, nounPattern);
  if (actuallyToken !== null) {
    return parseCountToken(actuallyToken);
  }

  const contrastToken = matchContrastPassengerCountRepair(message, nounPattern);
  if (contrastToken !== null) {
    return parseCountToken(contrastToken);
  }

  const changeToken = matchChangeFieldCountToRepair(message, fieldNamePattern);
  if (changeToken !== null) {
    return parseCountToken(changeToken);
  }

  return null;
}
