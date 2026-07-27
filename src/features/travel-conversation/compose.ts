import { summarizeKnown } from './project';
import type { Clarification, ConversationState, TravelPatch } from './types';

/** Stage 9 — Reply from final merged canonical state only. */
export function composeReply(input: {
  patch: TravelPatch;
  previous: ConversationState;
  state: ConversationState;
  clarification: Clarification;
  travellerName?: string;
}): string {
  const { patch, state, clarification, travellerName } = input;

  if (patch.messageClass === 'greeting') {
    return travellerName
      ? `Hi ${travellerName}. Tell me where you want to go and I’ll capture the details.`
      : 'Hi. Tell me where you want to go and I’ll capture the details.';
  }
  if (patch.messageClass === 'thanks') {
    return 'You’re welcome. What would you like to adjust next?';
  }
  if (patch.messageClass === 'new_conversation') {
    return 'Starting fresh — tell me the trip you have in mind.';
  }

  const known = summarizeKnown(state);

  if (clarification.needed && clarification.question) {
    const lead =
      known.length > 0
        ? `I’ve got ${known.join('; ')}.`
        : 'I’ve started capturing your travel requirements.';
    return `${lead} ${clarification.question}`;
  }

  if (known.length > 0) {
    return `Understood — I’ve saved ${known.join('; ')}. I won’t build an itinerary unless you ask for one. Tell me anything to add, change, or remove.`;
  }

  return 'Share a destination, dates, or the services you need (flights, accommodation, car hire) and I’ll take it from there.';
}
