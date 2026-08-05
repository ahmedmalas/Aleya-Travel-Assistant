import type { ConversationCoreState } from '../conversation-core';
import type { ConsultantAct, SituationModel } from './types';

/**
 * Render the consultant reply from the chosen act, situation, and state.
 * Uses the user message + situation when a short acknowledgement helps,
 * without falling back to form-wizard slot narration.
 */
export function renderConsultantReply(input: {
  act: ConsultantAct;
  situation: SituationModel;
  state: ConversationCoreState;
  previousState: ConversationCoreState;
}): string {
  const { act, situation, state, previousState } = input;
  const userMessage = situation.message.trim();

  if (act.kind === 'clarify') {
    return act.reply;
  }

  const acknowledgements: string[] = [];

  if (
    state.origin !== null &&
    state.origin !== previousState.origin &&
    act.kind !== 'execute'
  ) {
    acknowledgements.push(`We'll start from ${state.origin}.`);
  }

  if (
    state.destinationStops !== null &&
    state.destinationStops.length >= 2 &&
    JSON.stringify(state.destinationStops) !==
      JSON.stringify(previousState.destinationStops) &&
    act.kind !== 'execute'
  ) {
    acknowledgements.push(
      `Visiting ${state.destinationStops.join(', ')} in that order.`,
    );
  } else if (
    state.destination !== null &&
    state.destination !== previousState.destination &&
    (state.destinationStops?.length ?? 0) < 2 &&
    act.kind !== 'execute'
  ) {
    acknowledgements.push(`Great — ${state.destination}.`);
  }

  if (
    state.departureDate !== null &&
    state.departureDate !== previousState.departureDate &&
    act.kind !== 'execute'
  ) {
    acknowledgements.push(`Departing ${state.departureDate}.`);
  }

  if (act.kind === 'summarise' || act.kind === 'execute') {
    if (acknowledgements.length === 0) return act.reply;
    return `${acknowledgements.join(' ')} ${act.reply}`;
  }

  if (acknowledgements.length > 0) {
    return `${acknowledgements.join(' ')} ${act.reply}`;
  }

  // Short bare answers / clarification answers stay concise.
  if (situation.intent === 'clarify_answer' || userMessage.length <= 40) {
    return act.reply;
  }

  return act.reply;
}
