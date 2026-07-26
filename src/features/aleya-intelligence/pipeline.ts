import { evaluateClarifications } from './clarify';
import { applyConfidenceToPatch } from './confidence';
import { composeReply } from './compose';
import { compressContextIfNeeded } from './compress';
import { extractRequirements } from './extract';
import { inferContext } from './infer';
import { mergeConversationState } from './memory';
import { resolveReferences } from './references';
import type { IntelligenceResult, ProcessMessageInput } from './types';
import { createEmptyConversationState } from './types';
import { validateRequirements } from './validate';

/**
 * Intelligence pipeline:
 * Understand → Extract → Resolve references → Confidence → Store → Infer → Validate → Clarify → Compress → Continue
 * No search, booking, or recommendation tools are invoked.
 */
export function processTravelMessage(input: ProcessMessageInput): IntelligenceResult {
  const now = input.now ?? new Date();
  const previous = input.previousState ?? createEmptyConversationState();

  let patch = extractRequirements(input.message, previous, now);
  const resolved = resolveReferences(input.message, previous, patch, now, input.presentedOptions);
  patch = applyConfidenceToPatch(resolved.patch, input.message);

  let state = mergeConversationState(previous, patch);

  if (input.presentedOptions?.length) {
    state = {
      ...state,
      lastPresentedOptions: input.presentedOptions,
    };
  }

  if (resolved.selected) {
    const already = state.selectedOptions.some((o) => o.id === resolved.selected!.id);
    state = {
      ...state,
      selectedOptions: already ? state.selectedOptions : [...state.selectedOptions, resolved.selected],
      lastReference: resolved.resolution,
    };
  } else if (resolved.resolution) {
    state = { ...state, lastReference: resolved.resolution };
  }

  state = inferContext(state);

  if (patch.isDateConfirmation && state.lastSuggestedDate?.isoDate && !state.departureDate?.value.isoDate) {
    state = {
      ...state,
      awaitingDateConfirmation: false,
      departureDate: {
        value: {
          ...state.lastSuggestedDate,
          kind: 'absolute',
          isoDate: state.lastSuggestedDate.isoDate,
          label: patch.confirmedDateLabel ?? state.lastSuggestedDate.label,
        },
        source: 'confirmed',
        confidence: 0.95,
        confidenceLevel: 'high',
      },
    };
  }

  // If confirmation provided an absolute date on the patch, ensure kind is absolute
  if (patch.isDateConfirmation && patch.departureDate?.value.isoDate) {
    state = {
      ...state,
      awaitingDateConfirmation: false,
      departureDate: {
        ...patch.departureDate,
        value: { ...patch.departureDate.value, kind: 'absolute' },
        source: 'confirmed',
        confidence: 0.95,
        confidenceLevel: 'high',
      },
    };
  }

  if (patch.isGreeting || patch.isThanks || patch.isCapabilityQuestion) {
    state = compressContextIfNeeded(state);
    return {
      stage: 'continue',
      state,
      reply: composeReply({
        patch,
        state,
        clarification: { needsClarification: false, missingRequiredFields: [] },
        stage: 'continue',
        travellerName: input.travellerName,
      }),
      clarifications: [],
      explicitItineraryIntent: state.explicitItineraryIntent,
      shouldGenerateItinerary: false,
      searchPerformed: false,
    };
  }

  const validation = validateRequirements(state, {
    pendingLowConfidenceFields: patch.pendingLowConfidenceFields,
  });
  state = {
    ...state,
    conflicts: [...validation.conflicts, ...validation.impossible],
  };

  const clarification = evaluateClarifications(state, now, validation);
  state = {
    ...state,
    missingRequiredFields: clarification.missingRequiredFields,
    lastSuggestedDate: clarification.suggestedDate ?? state.lastSuggestedDate,
    awaitingDateConfirmation: Boolean(
      clarification.suggestedDate && clarification.missingRequiredFields.includes('departureDateConfirmation'),
    ),
  };

  state = compressContextIfNeeded(state);

  const stage = clarification.needsClarification ? 'clarify' : 'continue';
  const reply = composeReply({
    patch,
    state,
    clarification,
    stage,
    travellerName: input.travellerName,
  });

  return {
    stage,
    state,
    reply,
    clarifications: clarification.question ? [clarification.question] : [],
    explicitItineraryIntent: state.explicitItineraryIntent,
    shouldGenerateItinerary: state.explicitItineraryIntent,
    searchPerformed: false,
  };
}
