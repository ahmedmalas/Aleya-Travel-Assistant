import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  createInitialConversationCoreState,
  type ConversationCoreState,
  type ConversationStateExtractionInput,
} from '../index';
import * as conversationCore from '../index';

const CREATED_AT = new Date('2026-07-29T00:00:00.000Z');

describe('phase 5B — ConversationStateExtractionInput contract only', () => {
  it('is publicly exported', () => {
    const index = readFileSync(
      resolve(process.cwd(), 'src/features/conversation-core/index.ts'),
      'utf8',
    );
    expect(index).toMatch(/ConversationStateExtractionInput/);
    expectTypeOf<ConversationStateExtractionInput>().toEqualTypeOf<{
      message: string;
      currentState: ConversationCoreState;
    }>();
  });

  it('requires message', () => {
    expectTypeOf<ConversationStateExtractionInput>().toHaveProperty('message');
    // @ts-expect-error message is required
    const missingMessage: ConversationStateExtractionInput = {
      currentState: createInitialConversationCoreState({
        conversationId: 'conversation-core-extraction-input-001',
        now: CREATED_AT,
      }),
    };
    expect(missingMessage).toBeDefined();
  });

  it('message is a string', () => {
    expectTypeOf<ConversationStateExtractionInput['message']>().toEqualTypeOf<string>();
  });

  it('requires currentState', () => {
    expectTypeOf<ConversationStateExtractionInput>().toHaveProperty(
      'currentState',
    );
    // @ts-expect-error currentState is required
    const missingState: ConversationStateExtractionInput = {
      message: 'Hello',
    };
    expect(missingState).toBeDefined();
  });

  it('currentState uses the existing ConversationCoreState type', () => {
    expectTypeOf<
      ConversationStateExtractionInput['currentState']
    >().toEqualTypeOf<ConversationCoreState>();
  });

  it('accepts a valid canonical state directly', () => {
    const currentState = createInitialConversationCoreState({
      conversationId: 'conversation-core-extraction-input-002',
      now: CREATED_AT,
    });
    const input: ConversationStateExtractionInput = {
      message: 'I want to visit the Gold Coast',
      currentState,
    };
    expect(input.message).toBe('I want to visit the Gold Coast');
    expect(input.currentState).toEqual(currentState);
    expectTypeOf(input.currentState).toEqualTypeOf<ConversationCoreState>();
  });

  it('does not duplicate canonical-state fields at the top level', () => {
    type ExtractionInputKeys = keyof ConversationStateExtractionInput;
    expectTypeOf<ExtractionInputKeys>().toEqualTypeOf<
      'message' | 'currentState'
    >();

    const types = readFileSync(
      resolve(process.cwd(), 'src/features/conversation-core/types.ts'),
      'utf8',
    );
    const inputBlock = types.match(
      /export type ConversationStateExtractionInput = \{[\s\S]*?\};/,
    )?.[0];
    expect(inputBlock).toBeTruthy();
    expect(inputBlock).toMatch(/message: string;/);
    expect(inputBlock).toMatch(/currentState: ConversationCoreState;/);
    expect(inputBlock).not.toMatch(/destination\?:/);
    expect(inputBlock).not.toMatch(/origin\?:/);
    expect(inputBlock).not.toMatch(/conversationId\?:/);
    expect(inputBlock).not.toMatch(/transcript\?:/);
    expect(inputBlock).not.toMatch(/flightsRequested\?:/);
  });

  it('exports no runtime extractor', () => {
    const runtimeExports = Object.keys(conversationCore).filter(
      (name) =>
        typeof (conversationCore as Record<string, unknown>)[name] ===
        'function',
    );
    expect(runtimeExports.filter((name) => /extract/i.test(name))).toEqual([]);
  });

  it('exports no secondary processor', () => {
    const runtimeExports = Object.keys(conversationCore).filter(
      (name) =>
        typeof (conversationCore as Record<string, unknown>)[name] ===
        'function',
    );
    expect(
      runtimeExports.filter(
        (name) => name !== 'createInitialConversationCoreState',
      ),
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
