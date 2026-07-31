import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 13R — experimental conversational stack isolation audit.
 *
 * Proves the experimental conversational layer remains unreachable from the
 * authoritative production reply pipeline (production ↛ experimental).
 * Allowed: experimental → production. Adds no production behaviour.
 */

const ROOT = process.cwd();

function readSrc(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

/** Authoritative production pipeline source files. */
const PRODUCTION_PIPELINE_FILES = [
  'src/features/conversation-core/classifyConversationStateChange.ts',
  'src/features/conversation-core/selectConversationReplyComponents.ts',
  'src/features/conversation-core/assembleConversationReplyPlan.ts',
  'src/features/conversation-core/createConversationReplyPlan.ts',
  'src/features/conversation-core/generateConversationReply.ts',
  'src/features/conversation-core/processTurn.ts',
] as const;

const PRODUCTION_BARREL = 'src/features/conversation-core/index.ts';

/**
 * Complete experimental surface: symbols, module paths, and reference style
 * constants. Includes both the phase-stated style names and the project's
 * actual REFERENCE_* exports.
 */
const EXPERIMENTAL_SYMBOLS = [
  'ConversationalLayerInput',
  'ConversationalLayerOutput',
  'ConversationalObjective',
  'ConversationalStyleProfile',
  'ConversationalLayerRenderer',
  'selectConversationalObjective',
  'buildConversationalLayerInput',
  'renderBaselineConversationalLayer',
  'invokeConversationalLayerRenderer',
  'createConversationalRendererRegistry',
  'selectConversationalLayerRenderer',
  'executeConversationalLayerRenderer',
  'createBaselineConversationalRendererRegistry',
  'executeBaselineConversationalRenderer',
  'renderBaselineConversationalReplyPlan',
  'generateBaselineConversationalReply',
  'professionalConversationalStyleProfile',
  'warmConversationalStyleProfile',
  'luxuryConversationalStyleProfile',
  'REFERENCE_CONVERSATIONAL_STYLE_PROFESSIONAL',
  'REFERENCE_CONVERSATIONAL_STYLE_WARM',
  'REFERENCE_CONVERSATIONAL_STYLE_LUXURY',
  'REFERENCE_CONVERSATIONAL_STYLE_PROFILES',
  'conversationalLayerContracts',
  'referenceConversationalStyleProfiles',
  'conversationalRendererRegistry',
] as const;

/** Experimental modules that intentionally depend on production surfaces. */
const EXPERIMENTAL_MODULES_ALLOWED_TO_IMPORT_PRODUCTION = [
  'src/features/conversation-core/selectConversationalObjective.ts',
  'src/features/conversation-core/buildConversationalLayerInput.ts',
  'src/features/conversation-core/renderBaselineConversationalLayer.ts',
  'src/features/conversation-core/renderBaselineConversationalReplyPlan.ts',
  'src/features/conversation-core/generateBaselineConversationalReply.ts',
  'src/features/conversation-core/createBaselineConversationalRendererRegistry.ts',
  'src/features/conversation-core/executeBaselineConversationalRenderer.ts',
  'src/features/conversation-core/executeConversationalLayerRenderer.ts',
  'src/features/conversation-core/invokeConversationalLayerRenderer.ts',
  'src/features/conversation-core/conversationalRendererRegistry.ts',
  'src/features/conversation-core/conversationalLayerContracts.ts',
] as const;

function assertNoExperimentalReferences(
  source: string,
  fileLabel: string,
): void {
  for (const symbol of EXPERIMENTAL_SYMBOLS) {
    expect(source.includes(symbol), `${fileLabel} must not reference ${symbol}`).toBe(
      false,
    );
  }
}

describe('phase 13R — experimental conversational stack isolation', () => {
  it('keeps every authoritative production pipeline file free of experimental symbols', () => {
    for (const relativePath of PRODUCTION_PIPELINE_FILES) {
      const source = readSrc(relativePath);
      assertNoExperimentalReferences(source, relativePath);
    }
  });

  it('proves generateConversationReply and processTurn have no experimental dependency', () => {
    assertNoExperimentalReferences(
      readSrc('src/features/conversation-core/generateConversationReply.ts'),
      'generateConversationReply',
    );
    assertNoExperimentalReferences(
      readSrc('src/features/conversation-core/processTurn.ts'),
      'processTurn',
    );

    const generate = readSrc(
      'src/features/conversation-core/generateConversationReply.ts',
    );
    expect(generate).toMatch(/export function generateConversationReply/);
    expect(generate).toMatch(/export function renderConversationReplyPlan/);
    expect(generate.includes('import(')).toBe(false);
    expect(generate.includes('require(')).toBe(false);

    const processTurn = readSrc('src/features/conversation-core/processTurn.ts');
    expect(processTurn).toMatch(/export function processConversationTurn/);
    expect(processTurn.includes('generateIntegratedConversationReply')).toBe(
      true,
    );
    expect(processTurn).toMatch(/generateIntegratedConversationReply\(/);
    expect(processTurn).not.toMatch(/generateConversationReply\(/);
    expect(processTurn.includes('import(')).toBe(false);
    expect(processTurn.includes('require(')).toBe(false);
  });

  it('proves reply-plan assembly, component selection, classifier, and renderer stay isolated', () => {
    assertNoExperimentalReferences(
      readSrc('src/features/conversation-core/assembleConversationReplyPlan.ts'),
      'assembleConversationReplyPlan',
    );
    assertNoExperimentalReferences(
      readSrc(
        'src/features/conversation-core/selectConversationReplyComponents.ts',
      ),
      'selectConversationReplyComponents',
    );
    assertNoExperimentalReferences(
      readSrc('src/features/conversation-core/classifyConversationStateChange.ts'),
      'classifyConversationStateChange',
    );
    assertNoExperimentalReferences(
      readSrc('src/features/conversation-core/createConversationReplyPlan.ts'),
      'createConversationReplyPlan',
    );

    const generate = readSrc(
      'src/features/conversation-core/generateConversationReply.ts',
    );
    expect(generate.includes('renderConversationReplyPlan')).toBe(true);
    assertNoExperimentalReferences(generate, 'deterministic renderer host');
  });

  it('proves the production barrel exports no experimental modules or symbols', () => {
    const index = readSrc(PRODUCTION_BARREL);
    assertNoExperimentalReferences(index, 'index.ts barrel');

    expect(index).toMatch(/processConversationTurn/);
    expect(index).toMatch(/createInitialConversationCoreState/);
    expect(index.includes('generateConversationReply')).toBe(false);
    expect(index.includes('renderConversationReplyPlan')).toBe(false);
    expect(index.includes("from './conversationalLayerContracts'")).toBe(false);
    expect(index.includes("from './generateBaselineConversationalReply'")).toBe(
      false,
    );
    expect(index.includes("from './renderBaselineConversationalReplyPlan'")).toBe(
      false,
    );
    expect(index.includes("from './referenceConversationalStyleProfiles'")).toBe(
      false,
    );
  });

  it('allows experimental → production while prohibiting production → experimental', () => {
    // Prohibited: production must not depend on experimental.
    for (const relativePath of PRODUCTION_PIPELINE_FILES) {
      const source = readSrc(relativePath);
      expect(
        source.includes('conversationalLayer'),
        `${relativePath} must not import conversational-layer modules`,
      ).toBe(false);
      expect(
        source.includes('BaselineConversational'),
        `${relativePath} must not reference baseline conversational stack`,
      ).toBe(false);
      expect(
        source.includes('ConversationalRenderer'),
        `${relativePath} must not reference conversational renderer stack`,
      ).toBe(false);
    }

    // Allowed: experimental may depend on production reply-plan / renderer types.
    const contracts = readSrc(
      'src/features/conversation-core/conversationalLayerContracts.ts',
    );
    expect(contracts.includes('ConversationReplyPlan')).toBe(true);
    expect(contracts.includes("from './assembleConversationReplyPlan'")).toBe(
      true,
    );

    const baselineRenderer = readSrc(
      'src/features/conversation-core/renderBaselineConversationalLayer.ts',
    );
    expect(baselineRenderer.includes('renderConversationReplyPlan')).toBe(true);
    expect(baselineRenderer.includes("from './generateConversationReply'")).toBe(
      true,
    );

    const objective = readSrc(
      'src/features/conversation-core/selectConversationalObjective.ts',
    );
    expect(objective.includes('ConversationReplyPlan')).toBe(true);
    expect(objective.includes("from './assembleConversationReplyPlan'")).toBe(
      true,
    );

    for (const relativePath of EXPERIMENTAL_MODULES_ALLOWED_TO_IMPORT_PRODUCTION) {
      const source = readSrc(relativePath);
      expect(
        source.includes('processConversationTurn') ||
          source.includes('generateConversationReply') ||
          source.includes('ConversationReplyPlan') ||
          source.includes('renderConversationReplyPlan') ||
          source.includes('conversationalLayerContracts') ||
          source.includes('ConversationalLayer'),
        `${relativePath} remains part of the experimental stack`,
      ).toBe(true);
    }
  });

  it('proves no experimental module is reachable from the production reply path', () => {
    const generate = readSrc(
      'src/features/conversation-core/generateConversationReply.ts',
    );
    const processTurn = readSrc('src/features/conversation-core/processTurn.ts');
    const createPlan = readSrc(
      'src/features/conversation-core/createConversationReplyPlan.ts',
    );

    expect(generate.includes('generateBaselineConversationalReply')).toBe(false);
    expect(generate.includes('renderBaselineConversationalReplyPlan')).toBe(false);
    expect(generate.includes('executeBaselineConversationalRenderer')).toBe(false);
    expect(generate.includes('buildConversationalLayerInput')).toBe(false);

    expect(processTurn.includes('generateBaselineConversationalReply')).toBe(false);
    expect(processTurn.includes('renderBaselineConversationalReplyPlan')).toBe(
      false,
    );
    expect(processTurn.includes('executeBaselineConversationalRenderer')).toBe(
      false,
    );

    expect(createPlan.includes('generateBaselineConversationalReply')).toBe(false);
    expect(createPlan.includes('buildConversationalLayerInput')).toBe(false);

    // Production reply path reaches the seam, then the authoritative renderer.
    expect(generate).toMatch(/renderConversationReplyPlan\(/);
    expect(processTurn).toMatch(/generateIntegratedConversationReply\(/);
    expect(createPlan).toMatch(/assembleConversationReplyPlan\(/);
    expect(createPlan).toMatch(/selectConversationReplyComponents\(/);
  });
});
