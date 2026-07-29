import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as conversationCore from '../index';
import {
  createInitialConversationCoreState,
  ENGINE_NOT_ASSEMBLED_REPLY,
  processConversationTurn,
  type ConversationCoreState,
  type ConversationStateExtractionInput,
  type ConversationStateExtractionResult,
  type ConversationStateExtractor,
} from '../index';
import { createConversationStateExtractor } from '../createConversationStateExtractor';
import { CompositeConversationStateExtractor } from '../CompositeConversationStateExtractor';
import { EmptyConversationStateExtractor } from '../emptyConversationStateExtractor';
import { WineriesFoodTrailsRequestedConversationStateExtractor } from '../extractors/WineriesFoodTrailsRequestedConversationStateExtractor';
import { EventsFestivalsRequestedConversationStateExtractor } from '../extractors/EventsFestivalsRequestedConversationStateExtractor';

const ROOT = process.cwd();
const EVENTS_FESTIVALS_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/extractors/EventsFestivalsRequestedConversationStateExtractor.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-6i',
      now: new Date('2026-07-29T00:00:00.000Z'),
    }),
    status: 'active',
    turnCount: 2,
    destination: 'Brisbane',
    origin: 'Melbourne',
    flightsRequested: true,
    accommodationRequested: true,
    carHireRequested: true,
    activitiesRequested: true,
    restaurantsRequested: true,
    nearbyDiscoveryRequested: true,
    beachesRequested: true,
    campingRequested: true,
    kayakingRequested: true,
    fourWheelDriveRequested: true,
    scenicDrivesRequested: true,
    attractionsRequested: true,
    snowActivitiesRequested: true,
    hikingWalkingRequested: true,
    eventsRequested: true,
    transcript: [
      {
        id: 'user-0',
        role: 'user',
        message: 'seed',
        timestamp: '2026-07-29T00:00:00.000Z',
      },
    ],
    ...overrides,
  };
}

function listSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '__tests__') {
        continue;
      }
      files.push(...listSourceFiles(full));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.d.ts')) {
      files.push(full);
    }
  }
  return files;
}

function readExtractors(
  composite: CompositeConversationStateExtractor,
): readonly ConversationStateExtractor[] {
  return (
    composite as unknown as {
      extractors: readonly ConversationStateExtractor[];
    }
  ).extractors;
}

describe('phase 6I — EventsFestivalsRequestedConversationStateExtractor skeleton', () => {
  it('implements ConversationStateExtractor with empty result contract', () => {
    expectTypeOf<EventsFestivalsRequestedConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<
      EventsFestivalsRequestedConversationStateExtractor['extract']
    >().parameters.toEqualTypeOf<[ConversationStateExtractionInput]>();
    expectTypeOf<
      EventsFestivalsRequestedConversationStateExtractor['extract']
    >().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new EventsFestivalsRequestedConversationStateExtractor();
    const input: ConversationStateExtractionInput = {
      message: 'show me local events',
      currentState: createState(),
    };
    expect(extractor.extract(input)).toEqual({ stateUpdate: {} });
  });

  it('does not introduce new events/festivals canonical fields beyond the existing explicit eventsRequested', () => {
    const initial = createInitialConversationCoreState({
      conversationId: 'conversation-6i-field',
      now: new Date('2026-07-29T00:00:00.000Z'),
    });
    expect(Object.prototype.hasOwnProperty.call(initial, 'eventsRequested')).toBe(
      true,
    );
    for (const field of [
      'festivalsRequested',
      'eventsFestivalsRequested',
      'concertsRequested',
      'marketsRequested',
      'exhibitionsRequested',
      'sportingEventsRequested',
      'culturalEventsRequested',
      'localEventsRequested',
    ]) {
      expect(Object.prototype.hasOwnProperty.call(initial, field)).toBe(false);
      expect(field in initial).toBe(false);
    }
  });

  it('cannot create state from event, festival, concert, market, or related wording', () => {
    const extractor = new EventsFestivalsRequestedConversationStateExtractor();
    const withRelatedFlags = createState({
      attractionsRequested: true,
      snowActivitiesRequested: true,
      hikingWalkingRequested: true,
      restaurantsRequested: true,
      activitiesRequested: true,
      eventsRequested: true,
      nearbyDiscoveryRequested: true,
    });
    const withoutEvents = createState({
      attractionsRequested: true,
      snowActivitiesRequested: true,
      hikingWalkingRequested: true,
      eventsRequested: false,
    });

    const messages = [
      'events',
      'local events',
      'festivals',
      'music festivals',
      'food festivals',
      'cultural festivals',
      'concerts',
      'live music',
      'shows',
      'theatre',
      'markets',
      'night markets',
      'farmers markets',
      'fairs',
      'carnivals',
      'parades',
      'exhibitions',
      'art exhibitions',
      'trade shows',
      'sporting events',
      'sports matches',
      'races',
      'community events',
      'seasonal events',
      "what's on",
      'things happening nearby',
      'show me festivals',
      'find concerts nearby',
      'I want night markets',
      'add art exhibitions',
      'yes include local events',
      'actually show me sporting events',
      'do not include festivals',
      'no concerts',
      'remove events',
      'forget markets',
      'keep attractions but remove festivals',
    ];

    for (const message of messages) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ eventsRequested: null }),
        }),
      ).toEqual({ stateUpdate: {} });
      expect(
        extractor.extract({
          message,
          currentState: withRelatedFlags,
        }),
      ).toEqual({ stateUpdate: {} });
      expect(
        extractor.extract({
          message,
          currentState: withoutEvents,
        }),
      ).toEqual({ stateUpdate: {} });
    }

    const result = extractor.extract({
      message: 'keep attractions but remove festivals',
      currentState: withRelatedFlags,
    });
    expect(result.stateUpdate).toEqual({});
    expect(result.stateUpdate).not.toHaveProperty('eventsRequested');
    expect(result.stateUpdate).not.toHaveProperty('festivalsRequested');
    expect(result.stateUpdate).not.toHaveProperty('eventsFestivalsRequested');
    expect(result.stateUpdate).not.toHaveProperty('attractionsRequested');
    expect(withRelatedFlags.eventsRequested).toBe(true);
    expect(withoutEvents.eventsRequested).toBe(false);
  });

  it('does not mutate input or retain state across calls', () => {
    const extractor = new EventsFestivalsRequestedConversationStateExtractor();
    const currentState = createState({
      eventsRequested: true,
      transcript: [
        {
          id: 'user-0',
          role: 'user',
          message: 'seed',
          timestamp: '2026-07-29T00:00:00.000Z',
        },
      ],
    });
    const input: ConversationStateExtractionInput = {
      message: 'music festivals',
      currentState,
    };
    const before = structuredClone(input);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);

    const first = extractor.extract(input);
    const second = extractor.extract(input);
    first.stateUpdate.eventsRequested = false;

    expect(input).toEqual(before);
    expect(currentState).toEqual(before.currentState);
    expect(currentState.transcript).toEqual(before.currentState.transcript);
    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(second).toEqual({ stateUpdate: {} });
  });

  it('is included once in the production composite after wineries/food-trails and before empty', () => {
    const extractors = readExtractors(
      createConversationStateExtractor() as CompositeConversationStateExtractor,
    );

    expect(extractors).toHaveLength(28);
    const wineriesIndexes = extractors
      .map((extractor, index) =>
        extractor instanceof WineriesFoodTrailsRequestedConversationStateExtractor
          ? index
          : -1,
      )
      .filter((index) => index >= 0);
    const eventsIndexes = extractors
      .map((extractor, index) =>
        extractor instanceof EventsFestivalsRequestedConversationStateExtractor
          ? index
          : -1,
      )
      .filter((index) => index >= 0);
    const emptyIndexes = extractors
      .map((extractor, index) =>
        extractor instanceof EmptyConversationStateExtractor ? index : -1,
      )
      .filter((index) => index >= 0);

    expect(wineriesIndexes).toEqual([23]);
    expect(eventsIndexes).toEqual([24]);
    expect(emptyIndexes).toEqual([27]);
    expect(extractors[23]).toBeInstanceOf(
      WineriesFoodTrailsRequestedConversationStateExtractor,
    );
    expect(extractors[24]).toBeInstanceOf(
      EventsFestivalsRequestedConversationStateExtractor,
    );
    expect(extractors[27]).toBeInstanceOf(EmptyConversationStateExtractor);
  });

  it('contains no inspection, keyword matching, regex, or provider imports', () => {
    const source = readFileSync(EVENTS_FESTIVALS_REQUESTED_SOURCE, 'utf8');

    expect(source).toMatch(/_input: ConversationStateExtractionInput/);
    expect(source).not.toMatch(/input\.message|input\.currentState/);
    expect(source).not.toMatch(/\.message\b/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).not.toMatch(
      /eventsRequested\s*:|festivalsRequested\s*:|eventsFestivalsRequested\s*:/,
    );
    expect(source).not.toMatch(/new RegExp|\/.+\/[gimsuy]*/);
    expect(source).not.toMatch(
      /toLowerCase|includes\(|startsWith\(|keyword|token|lexicon|concert|theatre|carnival|parade|exhibition|market|fair|sporting|what's on|whats on|trade.?show|farmers.?market/i,
    );
    expect(source).not.toMatch(
      /geolocation|getCurrentPosition|google\.maps|mapbox|provider|from ['"][^'"]*(?:search|discovery|map|route|ticket|event)/i,
    );
    expect(source).not.toMatch(/metadata|confidence|warnings/);
  });

  it('stays off the public index and is only constructed by the factory', () => {
    const index = readFileSync(
      resolve(ROOT, 'src/features/conversation-core/index.ts'),
      'utf8',
    );
    const processTurn = readFileSync(
      resolve(ROOT, 'src/features/conversation-core/processTurn.ts'),
      'utf8',
    );
    const allowedConstruct = new Set([
      resolve(ROOT, 'src/features/conversation-core/createConversationStateExtractor.ts'),
      EVENTS_FESTIVALS_REQUESTED_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/EventsFestivalsRequestedConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty(
      'EventsFestivalsRequestedConversationStateExtractor',
    );
    expect(processTurn).not.toMatch(
      /EventsFestivalsRequestedConversationStateExtractor/,
    );

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(
        src.includes('new EventsFestivalsRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
      expect(
        src.includes('EventsFestivalsRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
    }
  });

  it('keeps every production extractor behaviourally empty with the skeleton in the path', () => {
    const currentState = createState({
      attractionsRequested: true,
      snowActivitiesRequested: true,
      hikingWalkingRequested: true,
      activitiesRequested: true,
      eventsRequested: true,
      origin: 'Melbourne',
      destination: 'Brisbane',
    });
    const messageOnly = processConversationTurn({
      message: 'show me festivals and night markets',
      state: currentState,
      userEntryId: 'user-6i',
      assistantEntryId: 'assistant-6i',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
    });
    const factoryResult = createConversationStateExtractor().extract({
      message: "what's on",
      currentState,
    });

    expect(factoryResult).toEqual({ stateUpdate: {} });
    expect(messageOnly.state.attractionsRequested).toBe(true);
    expect(messageOnly.state.activitiesRequested).toBe(true);
    expect(messageOnly.state.eventsRequested).toBe(true);
    expect(messageOnly.state.destination).toBe('Brisbane');
    expect(
      Object.prototype.hasOwnProperty.call(
        messageOnly.state,
        'eventsFestivalsRequested',
      ),
    ).toBe(false);
    expect(messageOnly.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    expect(Object.keys(messageOnly).sort()).toEqual(['reply', 'state', 'trace']);
    expect(messageOnly.trace.messageInterpreted).toBe(false);
  });
});
