import { summarizeKnown } from './project';
import type { Clarification, ConversationState, ExtractionPatch } from './types';

export function composeReply(input: {
  patch: ExtractionPatch;
  previous: ConversationState;
  state: ConversationState;
  clarification: Clarification;
  travellerName?: string;
}): string {
  const { patch, previous, state, clarification, travellerName } = input;

  if (patch.isGreeting) {
    return travellerName
      ? `Hi ${travellerName}. Tell me where you want to go and I’ll capture the details.`
      : 'Hi. Tell me where you want to go and I’ll capture the details.';
  }
  if (patch.isThanks) return 'You’re welcome. What would you like to adjust next?';
  if (patch.isNewConversation) {
    return 'Starting fresh — tell me the trip you have in mind.';
  }

  const known = summarizeKnown(state);

  // Explicit mid-month / date removal acknowledgement
  const prevExact =
    previous.departureDate?.value.kind === 'exact'
      ? previous.departureDate.value
      : undefined;
  const nowMid = state.departureDate?.value.kind === 'mid_month';
  const clearedDate =
    patch.explicitChanges.includes('departureDate') &&
    prevExact &&
    state.departureDate?.value.kind !== 'exact';

  if (clarification.needed && clarification.question) {
    if (clearedDate && nowMid) {
      const removed = formatRemoved(prevExact);
      return `Understood — I’ve removed ${removed}. ${clarification.question.replace(/^Understood — I’ve removed[^.]*\.\s*/i, '')}`;
    }
    if (clearedDate && state.departureDate?.value.kind === 'unresolved') {
      return `Understood — I’ve removed ${formatRemoved(prevExact)}. ${clarification.question}`;
    }
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

function formatRemoved(exact: { day: number; month: number; year: number; isoDate: string }): string {
  const months = [
    '',
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return `${exact.day} ${months[exact.month]} ${exact.year}`;
}
