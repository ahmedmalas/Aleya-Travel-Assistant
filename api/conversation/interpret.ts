import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateText, Output } from 'ai';
import { z } from 'zod';

/**
 * Serverless AI interpretation endpoint.
 * Uses Vercel AI Gateway model routing (OIDC on Vercel; AI_GATEWAY_API_KEY locally).
 * Receives the full interpretation context package from the client.
 */

const historySchema = z.array(
  z.object({
    role: z.enum(['user', 'assistant']),
    message: z.string(),
  }),
);

const requestSchema = z.object({
  message: z.string().min(1).max(4000),
  activeRequirement: z.string(),
  currentState: z.record(z.string(), z.unknown()),
  recentHistory: historySchema.optional(),
  interpretationContext: z
    .object({
      todayIso: z.string(),
      activeRequirementMeaning: z.string(),
      temporalAnchors: z.record(z.string(), z.unknown()),
      lastAssistantMessage: z.string().nullable(),
      lastUserMessageBeforeCurrent: z.string().nullable(),
    })
    .optional(),
});

const semanticSchema = z.object({
  intent: z.enum([
    'provide_info',
    'correct',
    'confirm',
    'remove',
    'add_service',
    'ask_clarification',
    'smalltalk',
    'unknown',
  ]),
  destination: z.string().nullable(),
  origin: z.string().nullable(),
  departureDate: z.string().nullable(),
  returnDate: z.string().nullable(),
  departureTimePreference: z.string().nullable(),
  returnTimePreference: z.string().nullable(),
  nightCount: z.number().int().nonnegative().nullable(),
  adultCount: z.number().int().nonnegative().nullable(),
  childCount: z.number().int().nonnegative().nullable(),
  infantCount: z.number().int().nonnegative().nullable(),
  flightsRequested: z.boolean().nullable(),
  accommodationRequested: z.boolean().nullable(),
  carHireRequested: z.boolean().nullable(),
  activitiesRequested: z.boolean().nullable(),
  restaurantsRequested: z.boolean().nullable(),
  restaurantPreference: z.string().nullable(),
  preferences: z.array(z.string()).default([]),
  removals: z
    .array(
      z.enum([
        'destination',
        'origin',
        'departureDate',
        'returnDate',
        'flights',
        'accommodation',
        'carHire',
        'activities',
        'restaurants',
      ]),
    )
    .default([]),
  confirmation: z.boolean().nullable(),
  conversationComplete: z.boolean().nullable(),
  ambiguityNotes: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
});

function buildPrompt(input: {
  message: string;
  activeRequirement: string;
  currentState: Record<string, unknown>;
  recentHistory?: Array<{ role: string; message: string }>;
  interpretationContext?: {
    todayIso: string;
    activeRequirementMeaning: string;
    temporalAnchors: Record<string, unknown>;
    lastAssistantMessage: string | null;
    lastUserMessageBeforeCurrent: string | null;
  };
}): string {
  const history =
    input.recentHistory && input.recentHistory.length > 0
      ? input.recentHistory
          .slice(-16)
          .map((entry) => `${entry.role}: ${entry.message}`)
          .join('\n')
      : '(none)';

  const ctx = input.interpretationContext;
  const todayIso = ctx?.todayIso ?? new Date().toISOString().slice(0, 10);

  return [
    'You are Aleya’s semantic travel interpretation layer — reason like an experienced travel consultant.',
    'Read the user message together with active missing requirement, full travel state, temporal anchors, and recent history.',
    'Resolve the user’s intended meaning into structured fields. Do not ask follow-up questions in this layer.',
    '',
    'Relative and contextual language MUST be resolved against temporal anchors and conversation state, including:',
    '- weekday-of-week references (e.g. Monday of that week) → ISO date in the anchor week; if filling returnDate and that weekday is before departure, use the same weekday in the following week',
    '- the day after / N days later / four nights later → compute from the primary anchor or departure date',
    '- that weekend → Saturday/Sunday of the anchor week (return prefers Sunday when return is active)',
    '- same time → copy prior time preference into the active leg time field',
    '- the earlier flight → preferences note; do not invent airports',
    '- change it to Friday → correct the active/date-being-discussed field to that weekday in the same week as the current value',
    '- keep everything else → only update the field being changed; leave all other fields null',
    '- completion signals (that\'s it / nothing else / no / all done / that\'s all) while optional follow-ups are open → set conversationComplete true',
    '',
    'Dates must be ISO YYYY-MM-DD when resolvable. Place names as plain strings. Use null when unknown.',
    'Only set fields the user is changing or newly supplying. Null preserves prior canonical state after validation.',
    'Respect active missing requirement for bare answers.',
    'When the last assistant prompt asked what else to know / optional extras, treat brief closers as conversationComplete.',
    'Confidence should reflect how clearly the meaning resolved (0.8+ when dates resolve cleanly from anchors).',
    '',
    `Today (ISO): ${todayIso}`,
    `Active missing requirement: ${input.activeRequirement}`,
    `Active requirement meaning: ${ctx?.activeRequirementMeaning ?? '(derive from requirement)'}`,
    `Temporal anchors JSON: ${JSON.stringify(ctx?.temporalAnchors ?? {})}`,
    `Full travel state JSON: ${JSON.stringify(input.currentState)}`,
    `Last assistant message: ${ctx?.lastAssistantMessage ?? '(none)'}`,
    `Previous user message: ${ctx?.lastUserMessageBeforeCurrent ?? '(none)'}`,
    `Recent conversation history:\n${history}`,
    `Current user message: ${input.message}`,
  ].join('\n');
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const parsed = requestSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  const { message, activeRequirement, currentState, recentHistory, interpretationContext } =
    parsed.data;

  try {
    const result = await generateText({
      model: 'openai/gpt-5.4',
      temperature: 0,
      output: Output.object({ schema: semanticSchema }),
      prompt: buildPrompt({
        message,
        activeRequirement,
        currentState,
        recentHistory,
        interpretationContext,
      }),
    });

    if (!result.output) {
      response.status(502).json({ error: 'Empty model output' });
      return;
    }

    response.status(200).json({
      source: 'ai',
      semantic: result.output,
    });
  } catch (error) {
    response.status(503).json({
      error: 'AI interpretation unavailable',
      message: error instanceof Error ? error.message : 'unknown',
    });
  }
}
