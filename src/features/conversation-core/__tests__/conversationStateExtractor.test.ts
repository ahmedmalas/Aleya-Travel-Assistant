import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from '../index';
import * as conversationCore from '../index';

describe('phase 5C — ConversationStateExtractor interface only', () => {
  it('is publicly exported', () => {
    const index = readFileSync(
      resolve(process.cwd(), 'src/features/conversation-core/index.ts'),
      'utf8',
    );
    expect(index).toMatch(/ConversationStateExtractor/);
    expectTypeOf<ConversationStateExtractor>().toHaveProperty('extract');
  });

  it('defines exactly one method named extract', () => {
    type ExtractorKeys = keyof ConversationStateExtractor;
    expectTypeOf<ExtractorKeys>().toEqualTypeOf<'extract'>();

    const types = readFileSync(
      resolve(process.cwd(), 'src/features/conversation-core/types.ts'),
      'utf8',
    );
    const interfaceBlock = types.match(
      /export interface ConversationStateExtractor \{[\s\S]*?\}/,
    )?.[0];
    expect(interfaceBlock).toBeTruthy();
    expect(interfaceBlock).toMatch(/\bextract\s*\(/);
    expect(interfaceBlock?.match(/\w+\s*\(/g)).toEqual(['extract(']);
  });

  it('extract requires ConversationStateExtractionInput', () => {
    expectTypeOf<ConversationStateExtractor['extract']>().parameters.toEqualTypeOf<
      [ConversationStateExtractionInput]
    >();
  });

  it('extract returns ConversationStateExtractionResult', () => {
    expectTypeOf<ConversationStateExtractor['extract']>().returns.toEqualTypeOf<ConversationStateExtractionResult>();
  });

  it('reuses existing input and result contracts directly', () => {
    const types = readFileSync(
      resolve(process.cwd(), 'src/features/conversation-core/types.ts'),
      'utf8',
    );
    const interfaceBlock = types.match(
      /export interface ConversationStateExtractor \{[\s\S]*?\}/,
    )?.[0];
    expect(interfaceBlock).toBeTruthy();
    expect(interfaceBlock).toMatch(
      /extract\(\s*input: ConversationStateExtractionInput,\s*\): ConversationStateExtractionResult;/,
    );
    expect(interfaceBlock).not.toMatch(/message: string/);
    expect(interfaceBlock).not.toMatch(/currentState:/);
    expect(interfaceBlock).not.toMatch(/stateUpdate:/);

    type ExtractParam = Parameters<ConversationStateExtractor['extract']>[0];
    type ExtractReturn = ReturnType<ConversationStateExtractor['extract']>;
    expectTypeOf<ExtractParam>().toEqualTypeOf<ConversationStateExtractionInput>();
    expectTypeOf<ExtractReturn>().toEqualTypeOf<ConversationStateExtractionResult>();
  });

  it('exports no runtime extractor implementation', () => {
    const runtimeExports = Object.keys(conversationCore).filter(
      (name) =>
        typeof (conversationCore as Record<string, unknown>)[name] ===
        'function',
    );
    expect(runtimeExports.filter((name) => /extract/i.test(name))).toEqual([]);
    expect(runtimeExports).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Extractor/),
        expect.stringMatching(/extract/i),
      ]),
    );
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
    expect(index).not.toMatch(/export class /);
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
