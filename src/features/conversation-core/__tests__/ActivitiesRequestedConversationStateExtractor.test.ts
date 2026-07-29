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
import { ActivitiesRequestedConversationStateExtractor } from '../ActivitiesRequestedConversationStateExtractor';

const ROOT = process.cwd();
const ACTIVITIES_REQUESTED_SOURCE = resolve(
  ROOT,
  'src/features/conversation-core/ActivitiesRequestedConversationStateExtractor.ts',
);

function createState(
  overrides: Partial<ConversationCoreState> = {},
): ConversationCoreState {
  return {
    ...createInitialConversationCoreState({
      conversationId: 'conversation-5u',
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

describe('phase 5U — ActivitiesRequestedConversationStateExtractor skeleton', () => {
  it('implements ConversationStateExtractor with empty result contract', () => {
    expectTypeOf<ActivitiesRequestedConversationStateExtractor>().toMatchTypeOf<ConversationStateExtractor>();
    expectTypeOf<ActivitiesRequestedConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
    expectTypeOf<ActivitiesRequestedConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();

    const extractor = new ActivitiesRequestedConversationStateExtractor();
    const input: ConversationStateExtractionInput = {
      message: 'I need activities',
      currentState: createState(),
    };
    expect(extractor.extract(input)).toEqual({ stateUpdate: {} });
  });

  it('cannot create, replace, or clear activitiesRequested from activities-like message text', () => {
    const extractor = new ActivitiesRequestedConversationStateExtractor();
    const withActivities = createState({
      activitiesRequested: true,
      carHireRequested: true,
      accommodationRequested: true,
      flightsRequested: true,
    });
    const withoutActivities = createState({
      activitiesRequested: false,
      carHireRequested: true,
      accommodationRequested: true,
      flightsRequested: true,
    });

    const messages = [
      'I need activities',
      'find things to do',
      'show me experiences',
      'I want attractions',
      'book a tour',
      'find an excursion',
      'we want an adventure',
      'add sightseeing',
      'find entertainment',
      'include leisure activities',
      'show recreation options',
      'find family activities',
      'what outdoor activities are nearby',
      'activities near the hotel',
      'flights accommodation car hire and activities',
      'yes add activities',
      'actually include some activities',
      'do not add activities',
      'no activities',
      'remove the activities',
      'forget activities',
      'we only need flights and accommodation',
      'keep car hire but remove activities',
    ];

    for (const message of messages) {
      expect(
        extractor.extract({
          message,
          currentState: createState({ activitiesRequested: null }),
        }),
      ).toEqual({ stateUpdate: {} });
      expect(
        extractor.extract({
          message,
          currentState: withActivities,
        }),
      ).toEqual({ stateUpdate: {} });
      expect(
        extractor.extract({
          message,
          currentState: withoutActivities,
        }),
      ).toEqual({ stateUpdate: {} });
    }

    const result = extractor.extract({
      message: 'keep the activities',
      currentState: withActivities,
    });
    expect(result.stateUpdate).toEqual({});
    expect(result.stateUpdate).not.toHaveProperty('activitiesRequested');
    expect(result.stateUpdate).not.toHaveProperty('carHireRequested');
    expect(result.stateUpdate).not.toHaveProperty('accommodationRequested');
    expect(result.stateUpdate).not.toHaveProperty('flightsRequested');
    expect(withActivities.activitiesRequested).toBe(true);
    expect(withoutActivities.activitiesRequested).toBe(false);
    expect(withActivities.carHireRequested).toBe(true);
  });

  it('returns the same empty result for different messages and states', () => {
    const extractor = new ActivitiesRequestedConversationStateExtractor();

    expect(
      extractor.extract({
        message: 'find things to do',
        currentState: createState({ activitiesRequested: true }),
      }),
    ).toEqual({ stateUpdate: {} });
    expect(
      extractor.extract({
        message: 'Cancel everything',
        currentState: createState({
          destination: 'Darwin',
          origin: 'Adelaide',
          activitiesRequested: false,
          carHireRequested: true,
          accommodationRequested: true,
          flightsRequested: true,
        }),
      }),
    ).toEqual({ stateUpdate: {} });
  });

  it('does not mutate input or retain state across calls or instances', () => {
    const extractor = new ActivitiesRequestedConversationStateExtractor();
    const currentState = createState({
      activitiesRequested: true,
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
      message: 'book a tour',
      currentState,
    };
    const before = structuredClone(input);
    Object.freeze(currentState.transcript[0]);
    Object.freeze(currentState.transcript);
    Object.freeze(currentState);
    Object.freeze(input);

    const first = extractor.extract(input);
    const second = extractor.extract(input);
    first.stateUpdate.activitiesRequested = false;

    expect(input).toEqual(before);
    expect(currentState).toEqual(before.currentState);
    expect(currentState.transcript).toEqual(before.currentState.transcript);
    expect(first).not.toBe(second);
    expect(first.stateUpdate).not.toBe(second.stateUpdate);
    expect(second).toEqual({ stateUpdate: {} });

    const other =
      new ActivitiesRequestedConversationStateExtractor() as ActivitiesRequestedConversationStateExtractor & {
        retained?: string;
      };
    (
      extractor as ActivitiesRequestedConversationStateExtractor & {
        retained?: string;
      }
    ).retained = 'first-only';
    expect(other.retained).toBeUndefined();
    expect(
      other.extract({ message: 'fresh', currentState: createState() }),
    ).toEqual({ stateUpdate: {} });
  });

  it('contains no inspection, keyword matching, regex, or provider imports', () => {
    const source = readFileSync(ACTIVITIES_REQUESTED_SOURCE, 'utf8');

    expect(source).toMatch(/_input: ConversationStateExtractionInput/);
    expect(source).not.toMatch(/input\.message|input\.currentState/);
    expect(source).not.toMatch(/\.message\b/);
    expect(source).not.toMatch(/currentState\./);
    expect(source).not.toMatch(/activitiesRequested\s*:/);
    expect(source).not.toMatch(/new RegExp|\/.+\/[gimsuy]*/);
    expect(source).not.toMatch(
      /toLowerCase|includes\(|startsWith\(|keyword|token|lexicon|things to do|sightseeing|excursion|attraction|adventure|entertainment|leisure|recreation/i,
    );
    expect(source).not.toMatch(
      /provider|search|discovery|travel-location|viator|getyourguide/i,
    );
    expect(source).not.toMatch(/metadata|confidence|warnings/);
    expect(source).not.toMatch(/from '\.\.\/|from '\.\.\/\.\.\//);
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
      ACTIVITIES_REQUESTED_SOURCE,
    ]);
    const srcFiles = listSourceFiles(resolve(ROOT, 'src')).filter(
      (path) => !allowedConstruct.has(path),
    );

    expect(index).not.toMatch(/ActivitiesRequestedConversationStateExtractor/);
    expect(conversationCore).not.toHaveProperty(
      'ActivitiesRequestedConversationStateExtractor',
    );
    expect(processTurn).not.toMatch(/ActivitiesRequestedConversationStateExtractor/);

    for (const file of srcFiles) {
      const src = readFileSync(file, 'utf8');
      expect(
        src.includes('new ActivitiesRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
      expect(
        src.includes('ActivitiesRequestedConversationStateExtractor'),
        file,
      ).toBe(false);
    }
  });

  it('keeps processor activitiesRequested behaviour unchanged with the skeleton in the path', () => {
    const currentState = createState({
      activitiesRequested: true,
      carHireRequested: true,
      accommodationRequested: true,
      flightsRequested: true,
      origin: 'Melbourne',
      destination: 'Brisbane',
    });
    const injected = processConversationTurn({
      message: 'actually include some activities',
      state: currentState,
      userEntryId: 'user-5u',
      assistantEntryId: 'assistant-5u',
      userMessageAt: new Date('2026-07-29T00:00:10.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:11.000Z'),
      stateUpdate: { activitiesRequested: true },
    });
    const cleared = processConversationTurn({
      message: 'no activities',
      state: currentState,
      userEntryId: 'user-5u-b',
      assistantEntryId: 'assistant-5u-b',
      userMessageAt: new Date('2026-07-29T00:00:12.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:13.000Z'),
      stateUpdate: { activitiesRequested: false },
    });
    const nullCleared = processConversationTurn({
      message: 'remove the activities',
      state: currentState,
      userEntryId: 'user-5u-c',
      assistantEntryId: 'assistant-5u-c',
      userMessageAt: new Date('2026-07-29T00:00:14.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:15.000Z'),
      stateUpdate: { activitiesRequested: null },
    });
    const messageOnly = processConversationTurn({
      message: 'I need activities and a tour',
      state: currentState,
      userEntryId: 'user-5u-d',
      assistantEntryId: 'assistant-5u-d',
      userMessageAt: new Date('2026-07-29T00:00:16.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:17.000Z'),
    });
    const carHireInjected = processConversationTurn({
      message: 'add car hire',
      state: currentState,
      userEntryId: 'user-5u-e',
      assistantEntryId: 'assistant-5u-e',
      userMessageAt: new Date('2026-07-29T00:00:18.000Z'),
      assistantMessageAt: new Date('2026-07-29T00:00:19.000Z'),
      stateUpdate: { carHireRequested: false },
    });

    expect(injected.state.activitiesRequested).toBe(true);
    expect(cleared.state.activitiesRequested).toBe(false);
    expect(nullCleared.state.activitiesRequested).toBeNull();
    expect(messageOnly.state.activitiesRequested).toBe(true);
    expect(carHireInjected.state.carHireRequested).toBe(false);
    expect(carHireInjected.state.activitiesRequested).toBe(true);
    expect(injected.reply).toBe(ENGINE_NOT_ASSEMBLED_REPLY);
    expect(Object.keys(injected).sort()).toEqual(['reply', 'state', 'trace']);
    expect(Object.keys(injected.trace).sort()).toEqual([
      'assistantMessageRecorded',
      'entryPoint',
      'messageInterpreted',
      'persistenceUsed',
      'stateChanged',
      'stateStatus',
      'turnCount',
      'userMessageRecorded',
    ]);
    expect(
      Object.keys(conversationCore).filter(
        (name) =>
          typeof (conversationCore as Record<string, unknown>)[name] ===
            'function' && name !== 'createInitialConversationCoreState',
      ),
    ).toEqual(['processConversationTurn']);
  });
});
