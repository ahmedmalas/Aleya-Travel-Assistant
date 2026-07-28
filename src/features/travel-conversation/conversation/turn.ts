/**
 * Sole production entry point: runConversationTurn
 *
 * Mandatory order:
 * 1 assemble complete context (incl. active option set)
 * 2 load / resolve contextual references against structured options
 * 3 detect explicit goals and facts
 * 4 combine contextual + explicit → validate
 * 5 apply / merge canonical state
 * 6 completeness / nextRequiredField
 * 7 plan → 8–9 execute/observe → 9b provider launch
 * 10 next conversational step (publishes new option sets)
 * 11 one natural response
 */

import { normalizeInput } from '../normalize';
import type { ConversationState, TravelServiceKind } from '../types';
import { getLastLocationResolutionPass } from '../candidates/locations';
import { extractServiceCandidates } from '../candidates/services';
import {
  consumeActiveOptionSetAfterResolution,
  resolveContextualReference,
  validateContextualResolution,
  type ActiveOptionSet,
  type CombinedValidatedSelections,
  type ContextualReferenceResolution,
} from '../contextual-reference';
import { applyValidatedTripChanges } from './apply';
import { calculateTripCompleteness } from './completeness';
import { assembleContext } from './context';
import type { ConversationTurnResult } from './contracts';
import { executeActions } from './execute';
import { detectGoals } from './goals';
import { determineObjective } from './objective';
import { createActionPlan, planDiscoveryActions, validateActionPlan } from './plan';
import { generateResponse } from './respond';
import {
  appendTurn,
  getTripType,
  isSearchActive,
  pushConversationTrace,
  resetConversationRuntime,
} from './runtime';
import { decideNextStep } from './step';
import { captureTurnRuntimeEvidence } from '../turnRuntimeEvidence';
import type { TurnRuntimeEvidence } from '../turnRuntimeEvidence';
import {
  defaultProviderLauncher,
  summarizeLaunchResults,
  type ProviderLaunchResult,
} from '../search-projection/providerLaunch';

export type ProviderLauncher = (
  state: ConversationState,
  services: TravelServiceKind[],
) => ProviderLaunchResult[];

function explicitServiceIdsFromMessage(
  message: string,
  optionSet: ActiveOptionSet | null,
): string[] {
  if (!optionSet || optionSet.options[0]?.category !== 'service') return [];
  const candidates = extractServiceCandidates(message);
  const adds = candidates.filter((c) => c.operation === 'add').map((c) => c.service);
  const valid = new Set(optionSet.options.map((o) => o.id));
  return adds.filter((id) => valid.has(id));
}

export function runConversationTurn(input: {
  message: string;
  previousState: ConversationState;
  now?: Date;
  commitTranscript?: boolean;
  launchProviders?: ProviderLauncher;
}): ConversationTurnResult {
  const now = input.now ?? new Date();
  const normalized = normalizeInput(input.message);
  const stateBefore = input.previousState;

  // 1. Assemble complete conversational context (includes active option set)
  const ctx = assembleContext({
    userMessage: input.message,
    normalizedMessage: normalized,
    trip: stateBefore,
    now,
  });
  const activeOptionSet = ctx.activeOptionSet ?? null;

  // 2. Resolve contextual references against structured options
  const contextualResolution: ContextualReferenceResolution = resolveContextualReference(
    normalized,
    activeOptionSet,
  );
  const contextualReferenceDetected = contextualResolution.resolved;

  // Explicit option ids mentioned by name (services) for combine step
  const explicitSelectionIds = explicitServiceIdsFromMessage(normalized, activeOptionSet);

  // 3–4. Validate combined contextual + explicit selections
  const combinedSelections: CombinedValidatedSelections = validateContextualResolution(
    contextualResolution,
    activeOptionSet,
    explicitSelectionIds,
  );

  // 2b. Objective
  const objective = determineObjective(ctx);

  // 3. Detect every goal (explicit + contextual combined)
  const goals = detectGoals(ctx, objective, combinedSelections);

  // 5. Apply validated trip changes to canonical state
  const applied = applyValidatedTripChanges({
    ctx,
    goals,
    state: stateBefore,
    combinedSelections,
  });
  let state = applied.state;
  const applyResults = applied.results;

  if (combinedSelections.ok) {
    consumeActiveOptionSetAfterResolution();
  }

  const servicesJustAdded = state.services.filter(
    (s) => !stateBefore.services.includes(s),
  );
  const servicesJustRemoved = stateBefore.services.filter(
    (s) => !state.services.includes(s),
  );
  if (servicesJustAdded.length) {
    applyResults.push({
      type: 'add_services',
      detail: servicesJustAdded.join(','),
      ok: true,
    });
  }
  if (servicesJustRemoved.length) {
    applyResults.push({
      type: 'remove_services',
      detail: servicesJustRemoved.join(','),
      ok: true,
    });
  }

  const addedServices = servicesJustAdded;

  // 6. Known / missing / nextRequiredField from canonical state after changes
  const tripType = getTripType();
  const completeness = calculateTripCompleteness(state, tripType);

  // 7. Create and validate ordered action plan
  const discoveryGoals = goals.some(
    (g) =>
      g.kind === 'provide_discovery_criteria' ||
      g.kind === 'select_discovery_destination' ||
      g.kind === 'reject_discovery_recommendations',
  );
  const criteriaChanged = state.lastChangedFields.includes('discovery');
  const discoveryPlan = discoveryGoals
    ? planDiscoveryActions({
        goals,
        discovery: state.discovery,
        criteriaChanged,
      })
    : [];
  const basePlan =
    discoveryPlan.length > 0
      ? discoveryPlan
      : createActionPlan({ ctx, goals, completeness });
  const planned = validateActionPlan(basePlan, completeness);

  // 8–9. Execute authorised actions and observe provider results
  const executed = executeActions({
    state,
    plan: planned,
    completeness,
    now,
    message: normalized,
  });
  state = executed.state;
  const allResults = [...applyResults, ...executed.results];

  // 9b. Browser-safe provider launch — real outcomes before describing search.
  if (
    (executed.provider.activateSearch || executed.provider.continueSearch) &&
    executed.provider.servicesToSearch.length > 0
  ) {
    const launcher = input.launchProviders ?? defaultProviderLauncher;
    const launchResults = launcher(state, executed.provider.servicesToSearch);
    executed.provider.launchResults = launchResults;
    const summary = summarizeLaunchResults(launchResults);
    executed.provider.resultsSummary = [
      summary.openedServices.length
        ? `opened:${summary.openedServices.join(',')}`
        : null,
      summary.readyForUserServices.length
        ? `ready:${summary.readyForUserServices.join(',')}`
        : null,
      summary.blockedServices.length
        ? `blocked:${summary.blockedServices.join(',')}`
        : null,
      summary.failedServices.length
        ? `failed:${summary.failedServices.join(',')}`
        : null,
    ]
      .filter(Boolean)
      .join('; ');
  }

  const completenessAfter = calculateTripCompleteness(state, getTripType());

  // 10. Decide the next conversational step (may publish a new option set)
  const step = decideNextStep({
    goals,
    completeness: completenessAfter,
    provider: executed.provider,
    executed: allResults,
    servicesJustAdded: addedServices,
    state,
  });

  // 11. Generate one natural final response
  const generated = generateResponse({
    ctx,
    state,
    completeness: completenessAfter,
    step,
    provider: executed.provider,
    servicesJustAdded: addedServices,
  });
  const reply = generated.text;

  const launchResults = executed.provider.launchResults ?? [];
  const launchSummary = summarizeLaunchResults(launchResults);

  const runtimeEvidence: TurnRuntimeEvidence = captureTurnRuntimeEvidence({
    conversationSessionId: state.conversationId,
    turnNumber: state.turnCount,
    replySource: generated.replySource,
    nextRequiredField: completenessAfter.nextRequiredField?.id ?? null,
    generatedReply: reply,
    requestedServices: executed.provider.servicesToSearch,
    projectedProviderActions: launchResults.map((r) => ({
      service: r.service,
      provider: r.provider,
      url: r.url,
    })),
    providerLaunchResults: launchResults,
    openedServices: launchSummary.openedServices,
    readyForUserServices: launchSummary.readyForUserServices,
    blockedServices: launchSummary.blockedServices,
    failedServices: launchSummary.failedServices,
    responseObservation: executed.provider.resultsSummary ?? null,
    activeOptionSet,
    contextualReferenceDetected,
    contextualReferenceResolution: contextualResolution,
    selectedOptionIds: combinedSelections.selectedOptionIds,
    excludedOptionIds: combinedSelections.excludedOptionIds,
    explicitSelections: explicitSelectionIds,
    combinedValidatedSelections: combinedSelections,
    canonicalStateBefore: {
      origin: stateBefore.origin?.value,
      destination: stateBefore.destination?.value,
      services: [...stateBefore.services],
    },
    canonicalStateAfter: {
      origin: state.origin?.value,
      destination: state.destination?.value,
      services: [...state.services],
    },
    ...(() => {
      const pass = getLastLocationResolutionPass();
      const ev = pass?.evidence;
      return {
        locationResolutionAttempted: ev?.locationResolutionAttempted,
        locationQuery: ev?.locationQuery,
        normalisedLocationQuery: ev?.normalisedLocationQuery,
        locationProvider: ev?.locationProvider,
        locationCandidates: ev?.locationCandidates,
        selectedLocationCandidate: ev?.selectedLocationCandidate,
        locationAmbiguityDetected: ev?.locationAmbiguityDetected,
        locationMatchType: ev?.locationMatchType,
        locationConfidence: ev?.locationConfidence,
        locationRole: ev?.locationRole,
        locationOperation: ev?.locationOperation,
        canonicalLocationBefore: ev?.canonicalLocationBefore ?? stateBefore.destination?.value,
        canonicalLocationAfter: ev?.canonicalLocationAfter ?? state.destination?.value,
        dependentFieldsCleared: pass?.replaceDestination
          ? ['destination', ...(stateBefore.accommodationArea ? ['accommodationArea'] : [])]
          : [],
        airportResolution: ev?.airportResolution,
        originPreserved: state.origin?.value ?? null,
      };
    })(),
  });

  if (input.commitTranscript !== false) {
    appendTurn({ role: 'user', text: input.message, at: now.toISOString() });
    appendTurn({ role: 'aleya', text: reply, at: now.toISOString() });
  }

  const trace = {
    at: now.toISOString(),
    userMessage: input.message,
    objective,
    goals: goals.map((g) => g.kind),
    knownFacts: completenessAfter.known,
    missingRequirements: completenessAfter.missing.map((m) => m.id),
    nextRequiredField: completenessAfter.nextRequiredField?.id ?? null,
    plannedActions: planned.map((a) => a.type),
    executedResults: allResults,
    conversationalStep: step.kind,
    stateBefore: {
      origin: stateBefore.origin?.value,
      destination: stateBefore.destination?.value,
      services: [...stateBefore.services],
    },
    stateAfter: {
      origin: state.origin?.value,
      destination: state.destination?.value,
      services: [...state.services],
    },
    reply,
  };
  pushConversationTrace(trace);

  return {
    state,
    reply,
    objective,
    goals,
    completeness: completenessAfter,
    nextRequiredField: completenessAfter.nextRequiredField,
    plannedActions: planned,
    executedResults: allResults,
    provider: executed.provider,
    conversationalStep: step,
    trace,
    runtimeEvidence,
    activateSearch: executed.provider.activateSearch,
    continueSearch: executed.provider.continueSearch,
    servicesToSearch: executed.provider.servicesToSearch,
    searchSessionActive: isSearchActive(),
    searchPerformed:
      executed.provider.activateSearch || executed.provider.continueSearch,
  };
}

export { resetConversationRuntime, isSearchActive };
