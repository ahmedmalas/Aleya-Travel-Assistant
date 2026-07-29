import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal four-wheel-driving-requested extraction boundary.
 *
 * Phase 7Q: recognises only narrow, explicit four-wheel-driving requests in the
 * current message. Deterministic and local — emits only true, never false or
 * null, and ignores prior conversation state.
 */
export class FourWheelDrivingRequestedConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    if (!hasExplicitFourWheelDrivingRequest(input.message)) {
      return {
        stateUpdate: {},
      };
    }
    return {
      stateUpdate: {
        fourWheelDriveRequested: true,
      },
    };
  }
}

/** Trim edges without String.prototype.trim (architecture boundary). */
function edgeTrim(value: string): string {
  return value.replace(/^\s+|\s+$/g, '');
}

function hasFourWheelDrivingCue(message: string): boolean {
  return (
    /\bfour[\s-]?wheel\s+driving\b/i.test(message) ||
    /\b4[\s-]?wheel\s+driving\b/i.test(message) ||
    /\b4wd\b/i.test(message)
  );
}

function isBlockedFourWheelDrivingRequestMessage(message: string): boolean {
  if (/\?/.test(message)) {
    return true;
  }
  if (/\bkeep\b/i.test(message) || /\bforget\b/i.test(message)) {
    return true;
  }
  if (/\bremove\b/i.test(message)) {
    return true;
  }
  if (/\binstead\b/i.test(message) || /\bactually\b/i.test(message)) {
    return true;
  }
  if (
    /\b(?:do\s+not|don't)\b/i.test(message) ||
    /\bno\s+(?:four[\s-]?wheel\s+driving|4[\s-]?wheel\s+driving|4wd)\b/i.test(
      message,
    ) ||
    /\bnot\b/i.test(message) ||
    /\bwithout\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:4x4|suv|awd|ute|off[\s-]?road|off[\s-]?roading)\b/i.test(message) &&
    !hasFourWheelDrivingCue(message)
  ) {
    return true;
  }
  if (
    /\b(?:hire|rent)\s+(?:a\s+|an\s+)?(?:4wd|four[\s-]?wheel)\b/i.test(
      message,
    )
  ) {
    return true;
  }
  if (
    /\b(?:remote[\s-]?area|scenic|easy|beginner[\s-]?friendly|family(?:[\s-]?friendly)?|guided|mountain|forest)\s+(?:four[\s-]?wheel\s+driving|4[\s-]?wheel\s+driving|4wd)\b/i.test(
      message,
    ) ||
    /\b(?:four[\s-]?wheel\s+driving|4[\s-]?wheel\s+driving|4wd)\s+(?:tracks?|routes?|trails?|tours?|adventures?|options)\b/i.test(
      message,
    )
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_FOUR_WHEEL_DRIVING_REQUEST_CUES: readonly RegExp[] = [
  /\b(?:book|need|include|add|show|find)\s+(?:me\s+)?(?:some\s+|a\s+)?(?:four[\s-]?wheel\s+driving|4[\s-]?wheel\s+driving|4wd)\b/i,
  /\bi\s+need\s+(?:four[\s-]?wheel\s+driving|4[\s-]?wheel\s+driving|4wd)\b/i,
  /\bfour[\s-]?wheel\s+driving\b/i,
  /\b4[\s-]?wheel\s+driving\b/i,
  /\b4wd\b/i,
];

function hasExplicitFourWheelDrivingRequest(message: string): boolean {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return false;
  }
  if (isBlockedFourWheelDrivingRequestMessage(text)) {
    return false;
  }
  for (const cue of EXPLICIT_FOUR_WHEEL_DRIVING_REQUEST_CUES) {
    if (cue.test(text)) {
      return true;
    }
  }
  return false;
}
