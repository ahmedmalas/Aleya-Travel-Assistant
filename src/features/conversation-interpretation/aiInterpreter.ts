import { generateText, Output } from 'ai';
import {
  travelSemanticInterpretationSchema,
  type TravelSemanticInterpretation,
} from './schema';
import {
  buildInterpretationContext,
  type TravelInterpretationContext,
} from './buildInterpretationContext';
import { buildInterpretationPrompt } from './buildInterpretationPrompt';
import type { ActiveTravelRequirement } from './types';
import type { ConversationCoreState, ConversationTranscriptEntry } from '../conversation-core';

const DEFAULT_MODEL = 'openai/gpt-5.4';

export function createTravelInterpretationContext(input: {
  message: string;
  currentState: ConversationCoreState;
  activeRequirement: ActiveTravelRequirement;
  recentHistory?: ConversationTranscriptEntry[];
  now?: Date;
}): TravelInterpretationContext {
  return buildInterpretationContext(input);
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
  now?: Date;
  /** Optional pre-built context (tests / shared path). */
  context?: TravelInterpretationContext;
}): Promise<TravelSemanticInterpretation | null> {
  try {
    const context =
      input.context ??
      buildInterpretationContext({
        message: input.message,
        currentState: input.currentState,
        activeRequirement: input.activeRequirement,
        recentHistory: input.recentHistory,
        now: input.now,
      });
    const result = await generateText({
      model: input.model ?? DEFAULT_MODEL,
      output: Output.object({ schema: travelSemanticInterpretationSchema }),
      prompt: buildInterpretationPrompt(context),
      temperature: 0,
    });
    return result.output ?? null;
  } catch {
    return null;
  }
}

/**
 * Browser/client path: POST to serverless interpret API with full context.
 */
export async function interpretWithAiViaApi(input: {
  message: string;
  currentState: ConversationCoreState;
  activeRequirement: ActiveTravelRequirement;
  recentHistory?: ConversationTranscriptEntry[];
  endpoint?: string;
  now?: Date;
  context?: TravelInterpretationContext;
}): Promise<TravelSemanticInterpretation | null> {
  const endpoint = input.endpoint ?? '/api/conversation/interpret';
  const context =
    input.context ??
    buildInterpretationContext({
      message: input.message,
      currentState: input.currentState,
      activeRequirement: input.activeRequirement,
      recentHistory: input.recentHistory,
      now: input.now,
    });
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: context.message,
        activeRequirement: context.activeRequirement,
        currentState: context.travelState,
        recentHistory: context.recentHistory.map((entry) => ({
          role: entry.role,
          message: entry.message,
        })),
        interpretationContext: {
          todayIso: context.todayIso,
          activeRequirementMeaning: context.activeRequirementMeaning,
          temporalAnchors: context.temporalAnchors,
          lastAssistantMessage: context.lastAssistantMessage,
          lastUserMessageBeforeCurrent: context.lastUserMessageBeforeCurrent,
        },
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
