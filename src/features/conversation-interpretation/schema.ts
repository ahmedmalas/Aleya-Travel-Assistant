import { z } from 'zod';

/**
 * Structured semantic travel interpretation schema.
 *
 * Produced by the AI interpretation layer (or offline semantic adapter).
 * Never written to canonical conversation state without deterministic validation.
 */
export const travelSemanticInterpretationSchema = z.object({
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
  ambiguityNotes: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
});

export type TravelSemanticInterpretation = z.infer<
  typeof travelSemanticInterpretationSchema
>;

export const emptySemanticInterpretation = (): TravelSemanticInterpretation => ({
  intent: 'unknown',
  destination: null,
  origin: null,
  departureDate: null,
  returnDate: null,
  departureTimePreference: null,
  returnTimePreference: null,
  nightCount: null,
  adultCount: null,
  childCount: null,
  infantCount: null,
  flightsRequested: null,
  accommodationRequested: null,
  carHireRequested: null,
  activitiesRequested: null,
  restaurantsRequested: null,
  restaurantPreference: null,
  preferences: [],
  removals: [],
  confirmation: null,
  ambiguityNotes: [],
  confidence: 0,
});
