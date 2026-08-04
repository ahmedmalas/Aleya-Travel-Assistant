import { generateText, Output } from 'ai';
import { z } from 'zod';
/**
 * Serverless AI interpretation endpoint.
 * Uses Vercel AI Gateway model routing (OIDC on Vercel; AI_GATEWAY_API_KEY locally).
 */
const requestSchema = z.object({
    message: z.string().min(1).max(4000),
    activeRequirement: z.string(),
    currentState: z.record(z.string(), z.unknown()),
    recentHistory: z
        .array(z.object({
        role: z.enum(['user', 'assistant']),
        message: z.string(),
    }))
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
        .array(z.enum([
        'destination',
        'origin',
        'departureDate',
        'returnDate',
        'flights',
        'accommodation',
        'carHire',
        'activities',
        'restaurants',
    ]))
        .default([]),
    confirmation: z.boolean().nullable(),
    ambiguityNotes: z.array(z.string()).default([]),
    confidence: z.number().min(0).max(1),
});
export default async function handler(request, response) {
    if (request.method !== 'POST') {
        response.status(405).json({ error: 'Method not allowed' });
        return;
    }
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) {
        response.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
        return;
    }
    const { message, activeRequirement, currentState, recentHistory } = parsed.data;
    try {
        const history = recentHistory && recentHistory.length > 0
            ? recentHistory
                .slice(-8)
                .map((entry) => `${entry.role}: ${entry.message}`)
                .join('\n')
            : '(none)';
        const result = await generateText({
            model: 'openai/gpt-5.4',
            temperature: 0,
            output: Output.object({ schema: semanticSchema }),
            prompt: [
                'You are the semantic travel interpretation layer for Aleya Travel.',
                'Extract structured travel meaning. Use null when unknown.',
                'Dates as ISO YYYY-MM-DD when resolvable.',
                `Active missing requirement: ${activeRequirement}`,
                `Current state JSON: ${JSON.stringify(currentState)}`,
                `Recent history:\n${history}`,
                `User message: ${message}`,
            ].join('\n'),
        });
        if (!result.output) {
            response.status(502).json({ error: 'Empty model output' });
            return;
        }
        response.status(200).json({
            source: 'ai',
            semantic: result.output,
        });
    }
    catch (error) {
        response.status(503).json({
            error: 'AI interpretation unavailable',
            message: error instanceof Error ? error.message : 'unknown',
        });
    }
}
