import { assignRoles } from '../assign';
import { extractCandidates } from '../candidates';
import { createEmptyConversationState } from '../types';

const NOW = new Date('2026-07-27T10:00:00+10:00');

/** Test helper — candidate extract + role assign without merge/persist. */
export function resolveLocationsForTest(message: string) {
  const previous = createEmptyConversationState();
  const bundle = extractCandidates(message, NOW, previous);
  const patch = assignRoles(bundle, previous);
  return {
    origin: patch.origin?.value,
    destination: patch.destination?.value,
    accommodationArea: patch.accommodationArea?.value,
  };
}

export { NOW };
