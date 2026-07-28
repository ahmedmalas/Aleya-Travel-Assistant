/** Deterministic validation of contextual resolutions before canonical merge. */

import type {
  ActiveOptionSet,
  CombinedValidatedSelections,
  ContextualReferenceResolution,
} from './types';

export function validateContextualResolution(
  resolution: ContextualReferenceResolution,
  optionSet: ActiveOptionSet | null,
  explicitOptionIds: string[] = [],
): CombinedValidatedSelections {
  if (!optionSet || !resolution.resolved) {
    return {
      selectedOptionIds: [],
      excludedOptionIds: [],
      selectedValues: [],
      explicitSelectionIds: explicitOptionIds,
      confidence: resolution.confidence,
      ok: false,
      reason: resolution.explanation ?? 'Not resolved',
    };
  }

  if (resolution.sourceOptionSetId && resolution.sourceOptionSetId !== optionSet.id) {
    return {
      optionSetId: optionSet.id,
      selectedOptionIds: [],
      excludedOptionIds: [],
      selectedValues: [],
      explicitSelectionIds: explicitOptionIds,
      confidence: resolution.confidence,
      ok: false,
      reason: 'Resolution sourceOptionSetId does not match active set.',
    };
  }

  const byId = new Map(optionSet.options.map((o) => [o.id, o]));
  const category = optionSet.options[0]?.category;

  // All ids must belong to the active set
  for (const id of [
    ...resolution.selectedOptionIds,
    ...resolution.excludedOptionIds,
    ...explicitOptionIds,
  ]) {
    if (!byId.has(id)) {
      return {
        optionSetId: optionSet.id,
        category,
        selectedOptionIds: [],
        excludedOptionIds: [],
        selectedValues: [],
        explicitSelectionIds: explicitOptionIds,
        confidence: resolution.confidence,
        ok: false,
        reason: `Unknown option id: ${id}`,
      };
    }
  }

  // Category compatibility — all options in set share category for now
  const categories = new Set(optionSet.options.map((o) => o.category));
  if (categories.size > 1) {
    // Mixed sets are allowed only if selected ids share one category
    const selectedCats = new Set(
      resolution.selectedOptionIds.map((id) => byId.get(id)!.category),
    );
    if (selectedCats.size > 1) {
      return {
        optionSetId: optionSet.id,
        selectedOptionIds: [],
        excludedOptionIds: [],
        selectedValues: [],
        explicitSelectionIds: explicitOptionIds,
        confidence: resolution.confidence,
        ok: false,
        reason: 'Selected options span incompatible categories.',
      };
    }
  }

  // Combine: start from contextual, add explicit, subtract exclusions
  const excluded = new Set([
    ...resolution.excludedOptionIds,
    // explicit removals handled by caller; exclusions from resolution win
  ]);
  const combined = new Set<string>();
  for (const id of resolution.selectedOptionIds) {
    if (!excluded.has(id)) combined.add(id);
  }
  for (const id of explicitOptionIds) {
    if (!excluded.has(id)) combined.add(id);
  }

  // Selection mode
  let finalIds = [...combined];
  if (optionSet.selectionMode === 'single' && finalIds.length > 1) {
    finalIds = [finalIds[0]!];
  }

  // Position validity already implied by membership; confidence floor
  if (resolution.confidence < 0.5 && finalIds.length > 0) {
    return {
      optionSetId: optionSet.id,
      category,
      selectedOptionIds: [],
      excludedOptionIds: [...excluded],
      selectedValues: [],
      explicitSelectionIds: explicitOptionIds,
      confidence: resolution.confidence,
      ok: false,
      reason: 'Confidence below merge threshold.',
    };
  }

  const selectedValues = finalIds.map((id) => byId.get(id)!.value);

  return {
    optionSetId: optionSet.id,
    category: byId.get(finalIds[0] ?? '')?.category ?? category,
    selectedOptionIds: finalIds,
    excludedOptionIds: [...excluded],
    selectedValues,
    explicitSelectionIds: explicitOptionIds,
    confidence: resolution.confidence,
    ok: true,
  };
}
