import { canonicalizeSemanticPlaces } from './canonicalizePlaces';
import { deriveActiveTravelRequirement } from './deriveActiveRequirement';
import { interpretWithAi, interpretWithAiViaApi } from './aiInterpreter';
import { interpretOfflineSemantic } from './offlineSemanticInterpreter';
import { interpretWithRegexFallback } from './regexFallbackInterpreter';
import { emptySemanticInterpretation } from './schema';
import type {
  InterpretTravelUtteranceInput,
  InterpretTravelUtteranceResult,
  InterpretationSource,
} from './types';
import { validateAndMapSemanticInterpretation } from './validateAndMap';

function isServerRuntime(): boolean {
  return typeof window === 'undefined';
}

/**
 * Authoritative semantic interpretation boundary for Aleya conversation turns.
 *
 * Order:
 * 1. AI structured interpretation (Gateway / API) when mode allows
 * 2. Offline semantic adapter (TLI + active requirement)
 * 3. Regex extractor stack as last-resort fallback
 *
 * Canonical state is never written here — only a validated ConversationStateUpdate.
 */
export async function interpretTravelUtterance(
  input: InterpretTravelUtteranceInput,
): Promise<InterpretTravelUtteranceResult> {
  const activeRequirement =
    input.activeRequirement ?? deriveActiveTravelRequirement(input.currentState);
  const warnings: string[] = [];
  const mode = input.mode ?? 'auto';

  let source: InterpretationSource = 'empty';
  let semantic = emptySemanticInterpretation();

  const tryAi = mode === 'auto' || mode === 'ai';
  const tryOffline = mode === 'auto' || mode === 'offline-semantic';
  const tryRegex = mode === 'auto' || mode === 'regex-fallback';

  if (tryAi) {
    const aiResult = isServerRuntime()
      ? await interpretWithAi({
          message: input.message,
          currentState: input.currentState,
          activeRequirement,
          recentHistory: input.recentHistory,
        })
      : await interpretWithAiViaApi({
          message: input.message,
          currentState: input.currentState,
          activeRequirement,
          recentHistory: input.recentHistory,
        });
    if (aiResult !== null && aiResult.confidence >= 0.35) {
      semantic = aiResult;
      source = 'ai';
    } else if (mode === 'ai') {
      warnings.push('AI interpretation unavailable or low confidence');
    }
  }

  if (source === 'empty' && tryOffline) {
    semantic = interpretOfflineSemantic({
      message: input.message,
      currentState: input.currentState,
      activeRequirement,
    });
    if (semantic.confidence >= 0.35 && semantic.intent !== 'unknown') {
      source = 'offline-semantic';
    } else if (mode === 'offline-semantic') {
      source = 'offline-semantic';
    }
  }

  if (
    (source === 'empty' ||
      (source === 'offline-semantic' &&
        semantic.intent === 'unknown' &&
        mode === 'auto')) &&
    tryRegex
  ) {
    const fallback = interpretWithRegexFallback({
      message: input.message,
      currentState: input.currentState,
    });
    if (fallback.confidence > 0 || fallback.intent !== 'unknown') {
      semantic = fallback;
      source = 'regex-fallback';
      warnings.push('Used regex extractor fallback');
    }
  }

  if (source === 'empty') {
    return {
      source,
      semantic,
      stateUpdate: {},
      interpreted: false,
      warnings,
    };
  }

  const canonicalized = canonicalizeSemanticPlaces(semantic);
  warnings.push(...canonicalized.warnings);

  const mapped = validateAndMapSemanticInterpretation(
    canonicalized.semantic,
    input.currentState,
  );
  warnings.push(...mapped.warnings);

  const interpreted = Object.keys(mapped.stateUpdate).length > 0;

  return {
    source,
    semantic: canonicalized.semantic,
    stateUpdate: mapped.stateUpdate,
    interpreted,
    warnings,
  };
}
