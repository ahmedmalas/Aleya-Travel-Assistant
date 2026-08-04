import { generateText, Output } from 'ai';
import {
  travelSemanticInterpretationSchema,
  type TravelSemanticInterpretation,
} from './schema';
import type { ActiveTravelRequirement } from './types';
import type { ConversationCoreState, ConversationTranscriptEntry } from '../conversation-core';

const DEFAULT_MODEL = 'openai/gpt-5.4';

function historyBlock(
  history: ConversationTranscriptEntry[] | undefined,
): string {
  if (!history || history.length === 0) return '(none)';
  return history
    .slice(-8)
    .map((entry) => `${entry.role}: ${entry.message}`)
    .join('\n');
}

function buildPrompt(input: {
  message: string;
  currentState: ConversationCoreState;
  activeRequirement: ActiveTravelRequirement;
  recentHistory?: ConversationTranscriptEntry[];
}): string {
  return [
    'You are the semantic travel interpretation layer for Aleya Travel.',
    'Extract structured travel meaning from the user message.',
    'Respect conversational context: active missing requirement owns bare place answers.',
    'Understand natural language including missing "to", corrections, removals, times, and night stays.',
    'Return only fields you can justify; use null when unknown.',
    'Place names should be plain strings (canonicalisation happens elsewhere).',
    'Dates must be ISO YYYY-MM-DD when you can resolve them; otherwise null.',
    '',
    `Active missing requirement: ${input.activeRequirement}`,
    `Current state JSON: ${JSON.stringify({
      destination: input.currentState.destination,
      origin: input.currentState.origin,
      departureDate: input.currentState.departureDate,
      returnDate: input.currentState.returnDate,
      adultCount: input.currentState.adultCount,
      childCount: input.currentState.childCount,
      infantCount: input.currentState.infantCount,
      flightsRequested: input.currentState.flightsRequested,
      accommodationRequested: input.currentState.accommodationRequested,
      carHireRequested: input.currentState.carHireRequested,
    })}`,
    `Recent history:\n${historyBlock(input.recentHistory)}`,
    `User message: ${input.message}`,
  ].join('\n');
}

/**
 * Server-side AI structured interpretation via Vercel AI Gateway model routing.
 */
export async function interpretWithAi(input: {
  message: string;
  currentState: ConversationCoreState;
  activeRequirement: ActiveTravelRequirement;
  recentHistory?: ConversationTranscriptEntry[];
  model?: string;
}): Promise<TravelSemanticInterpretation | null> {
  try {
    const result = await generateText({
      model: input.model ?? DEFAULT_MODEL,
      output: Output.object({ schema: travelSemanticInterpretationSchema }),
      prompt: buildPrompt(input),
      temperature: 0,
    });
    return result.output ?? null;
  } catch {
    return null;
  }
}

/**
 * Browser/client path: POST to serverless interpret API.
 */
export async function interpretWithAiViaApi(input: {
  message: string;
  currentState: ConversationCoreState;
  activeRequirement: ActiveTravelRequirement;
  recentHistory?: ConversationTranscriptEntry[];
  endpoint?: string;
}): Promise<TravelSemanticInterpretation | null> {
  const endpoint = input.endpoint ?? '/api/conversation/interpret';
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: input.message,
        currentState: {
          destination: input.currentState.destination,
          origin: input.currentState.origin,
          departureDate: input.currentState.departureDate,
          returnDate: input.currentState.returnDate,
          adultCount: input.currentState.adultCount,
          childCount: input.currentState.childCount,
          infantCount: input.currentState.infantCount,
          flightsRequested: input.currentState.flightsRequested,
          accommodationRequested: input.currentState.accommodationRequested,
          carHireRequested: input.currentState.carHireRequested,
        },
        activeRequirement: input.activeRequirement,
        recentHistory: (input.recentHistory ?? []).slice(-8).map((entry) => ({
          role: entry.role,
          message: entry.message,
        })),
      }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      semantic?: TravelSemanticInterpretation;
    };
    if (!payload.semantic) return null;
    const parsed = travelSemanticInterpretationSchema.safeParse(payload.semantic);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
