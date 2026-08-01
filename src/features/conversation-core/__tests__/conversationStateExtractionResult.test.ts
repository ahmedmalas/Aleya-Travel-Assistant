import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
  ConversationStateExtractionResult,
  ConversationStateUpdate,
} from '../index';
import * as conversationCore from '../index';

describe('phase 5A — ConversationStateExtractionResult contract only', () => {
  it('is publicly exported', () => {
    const index = readFileSync(
      resolve(process.cwd(), 'src/features/conversation-core/index.ts'),
      'utf8',
    );
    expect(index).toMatch(/ConversationStateExtractionResult/);
    expectTypeOf<ConversationStateExtractionResult>().toEqualTypeOf<{
      stateUpdate: ConversationStateUpdate;
    }>();
  });

  it('requires a stateUpdate property', () => {
    expectTypeOf<ConversationStateExtractionResult>().toHaveProperty(
      'stateUpdate',
    );
    expectTypeOf<ConversationStateExtractionResult['stateUpdate']>().toEqualTypeOf<ConversationStateUpdate>();
  });

  it('stateUpdate uses the existing ConversationStateUpdate type', () => {
    type ExtractionUpdate =
      ConversationStateExtractionResult['stateUpdate'];
    expectTypeOf<ExtractionUpdate>().toEqualTypeOf<ConversationStateUpdate>();
  });

  it('accepts an empty update object', () => {
    const result: ConversationStateExtractionResult = {
      stateUpdate: {},
    };
    expect(result.stateUpdate).toEqual({});
  });

  it('accepts existing explicit travel values through stateUpdate', () => {
    const stateUpdate: ConversationStateUpdate = {
      origin: 'Sydney',
      destination: 'Gold Coast',
      departureDate: '2026-08-15',
      returnDate: '2026-08-22',
      adultCount: 2,
      childCount: 1,
      infantCount: 0,
      flightsRequested: true,
      accommodationRequested: false,
      carHireRequested: true,
      activitiesRequested: false,
      restaurantsRequested: true,
      nearbyDiscoveryRequested: false,
      beachesRequested: true,
      campingRequested: false,
      kayakingRequested: true,
      fourWheelDriveRequested: false,
      scenicDrivesRequested: true,
      attractionsRequested: false,
      snowActivitiesRequested: false,
      hikingWalkingRequested: false,
      fishingRequested: false,
      divingSnorkellingRequested: false,
      wineriesFoodTrailsRequested: false,
      eventsFestivalsRequested: false,
      wildlifeRequested: false,
      nationalParksRequested: false,
      toursRequested: true,
            nightlifeRequested: true,
      shoppingRequested: false,
      wellnessRequested: true,
      familyActivitiesRequested: false,
      accessibleTravelRequested: true,
    };
    const result: ConversationStateExtractionResult = { stateUpdate };
    expect(result.stateUpdate).toEqual(stateUpdate);
    expectTypeOf(result.stateUpdate).toEqualTypeOf<ConversationStateUpdate>();
  });

  it('has no duplicated top-level travel fields on the extraction result', () => {
    type ExtractionKeys = keyof ConversationStateExtractionResult;
    expectTypeOf<ExtractionKeys>().toEqualTypeOf<'stateUpdate'>();

    const types = readFileSync(
      resolve(process.cwd(), 'src/features/conversation-core/types.ts'),
      'utf8',
    );
    const extractionBlock = types.match(
      /export type ConversationStateExtractionResult = \{[\s\S]*?\};/,
    )?.[0];
    expect(extractionBlock).toBeTruthy();
    expect(extractionBlock).toMatch(/stateUpdate: ConversationStateUpdate;/);
    expect(extractionBlock).not.toMatch(/destination\?:/);
    expect(extractionBlock).not.toMatch(/origin\?:/);
    expect(extractionBlock).not.toMatch(/flightsRequested\?:/);
    expect(extractionBlock).not.toMatch(/accessibleTravelRequested\?:/);
  });

  it('exports no runtime extractor or secondary processor', () => {
    const runtimeExports = Object.keys(conversationCore).filter(
      (name) => typeof (conversationCore as Record<string, unknown>)[name] === 'function',
    );
    expect(runtimeExports).toEqual(
      expect.arrayContaining([
        'createInitialConversationCoreState',
        'processConversationTurn',
      ]),
    );
    expect(runtimeExports).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/extract/i),
        expect.stringMatching(/parse/i),
        expect.stringMatching(/infer/i),
      ]),
    );
    expect(runtimeExports.filter((name) => /extract/i.test(name))).toEqual([]);
    expect(
      runtimeExports.filter((name) => name !== 'createInitialConversationCoreState'),
    ).toEqual(['processConversationTurn']);
  });

  it('keeps processConversationTurn as the only public runtime processor', () => {
    const index = readFileSync(
      resolve(process.cwd(), 'src/features/conversation-core/index.ts'),
      'utf8',
    );
    expect(index).toMatch(/processConversationTurn/);
    expect(index).not.toMatch(/export function extract/);
    expect(index).not.toMatch(/export \{[\s\S]*extract[\s\S]*\} from/);
    expect(typeof conversationCore.processConversationTurn).toBe('function');
    expect(
      Object.keys(conversationCore).filter(
        (name) =>
          typeof (conversationCore as Record<string, unknown>)[name] ===
            'function' && name !== 'createInitialConversationCoreState',
      ),
    ).toEqual(['processConversationTurn']);
  });
});
