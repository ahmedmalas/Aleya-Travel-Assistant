import { canonicalizeSemanticPlaces } from './canonicalizePlaces';
import { deriveActiveTravelRequirement } from './deriveActiveRequirement';
import { interpretWithAi, interpretWithAiViaApi } from './aiInterpreter';
import { buildInterpretationContext } from './buildInterpretationContext';
import { interpretOfflineSemantic } from './offlineSemanticInterpreter';
import { interpretWithRegexFallback } from './regexFallbackInterpreter';
import { emptySemanticInterpretation } from './schema';
import type {
  InterpretTravelUtteranceInput,
  InterpretTravelUtteranceResult,
  InterpretationSource,
} from './types';
import { validateAndMapSemanticInterpretation } from './validateAndMap';
import type { TravelSemanticInterpretation } from './schema';
import type { TravelInterpretationContext } from './buildInterpretationContext';

function isServerRuntime(): boolean {
  return typeof window === 'undefined';
}

/**
 * Non-authoritative leftover adapter (Engine Consolidation).
 *
 * Production turns use `interpretSemanticMeaning` via `runConsultantTurn`.
 * This function remains for isolated module/tests only — not a competing
 * behavioural owner on the conversation entry path.
 *
 * Order (legacy):
 * 1. AI structured interpretation
 * 2. Offline semantic adapter
 * 3. Regex extractor stack
 */
export async function interpretTravelUtterance(
  input: InterpretTravelUtteranceInput,
): Promise<InterpretTravelUtteranceResult> {
  const activeRequirement =
    input.activeRequirement ?? deriveActiveTravelRequirement(input.currentState);
  const warnings: string[] = [];
  const mode = input.mode ?? 'auto';

  const context = buildInterpretationContext({
    message: input.message,
    currentState: input.currentState,
    activeRequirement,
    recentHistory: input.recentHistory ?? input.currentState.transcript,
    now: input.now,
  });

  let source: InterpretationSource = 'empty';
  let semantic = emptySemanticInterpretation();

  const tryAi = mode === 'auto' || mode === 'ai';
  const tryOffline = mode === 'auto' || mode === 'offline-semantic';
  const tryRegex = mode === 'auto' || mode === 'regex-fallback';

  if (tryAi) {
    let aiResult: TravelSemanticInterpretation | null = null;
    if (input.aiInterpret) {
      aiResult = await input.aiInterpret(context);
    } else if (isServerRuntime()) {
      aiResult = await interpretWithAi({
        message: input.message,
        currentState: input.currentState,
        activeRequirement,
        recentHistory: input.recentHistory,
        now: input.now,
        context,
      });
    } else {
      aiResult = await interpretWithAiViaApi({
        message: input.message,
        currentState: input.currentState,
        activeRequirement,
        recentHistory: input.recentHistory,
        now: input.now,
        context,
      });
    }

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
      recentHistory: input.recentHistory ?? input.currentState.transcript,
      now: input.now,
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
    context,
  };
}

export type { TravelInterpretationContext };
