import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 13S — experimental conversational stack architecture audit.
 *
 * Proves the experimental baseline path is a single linear composition with no
 * skipped layers, duplicated responsibilities, or alternate execution paths.
 * Adds no production behaviour and no runtime wiring.
 *
 * Composition (entry → wording):
 *   generateBaselineConversationalReply
 *     → renderBaselineConversationalReplyPlan
 *       → buildConversationalLayerInput
 *       → executeBaselineConversationalRenderer
 *         → createBaselineConversationalRendererRegistry
 *           (registers renderBaselineConversationalLayer)
 *         → executeConversationalLayerRenderer
 *           → selectConversationalLayerRenderer
 *           → invokeConversationalLayerRenderer
 *             → renderBaselineConversationalLayer (selected renderer)
 *     → .wording
 */

const ROOT = process.cwd();

function readSrc(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

const GENERATE = 'src/features/conversation-core/generateBaselineConversationalReply.ts';
const REPLY_PLAN =
  'src/features/conversation-core/renderBaselineConversationalReplyPlan.ts';
const EXECUTE_BASELINE =
  'src/features/conversation-core/executeBaselineConversationalRenderer.ts';
const CREATE_REGISTRY =
  'src/features/conversation-core/createBaselineConversationalRendererRegistry.ts';
const EXECUTE =
  'src/features/conversation-core/executeConversationalLayerRenderer.ts';
const REGISTRY =
  'src/features/conversation-core/conversationalRendererRegistry.ts';
const INVOKE =
  'src/features/conversation-core/invokeConversationalLayerRenderer.ts';
const BASELINE_RENDERER =
  'src/features/conversation-core/renderBaselineConversationalLayer.ts';
const BUILD_INPUT =
  'src/features/conversation-core/buildConversationalLayerInput.ts';

const PIPELINE_MODULES = [
  GENERATE,
  REPLY_PLAN,
  EXECUTE_BASELINE,
  CREATE_REGISTRY,
  EXECUTE,
  REGISTRY,
  INVOKE,
  BASELINE_RENDERER,
  BUILD_INPUT,
] as const;

function assertImports(
  source: string,
  required: string[],
  forbidden: string[],
  label: string,
): void {
  for (const name of required) {
    expect(source.includes(name), `${label} must depend on ${name}`).toBe(true);
  }
  for (const name of forbidden) {
    expect(source.includes(name), `${label} must not depend on ${name}`).toBe(
      false,
    );
  }
}

function callSitesOutside(
  symbolCall: string,
  allowedFiles: readonly string[],
): string[] {
  const offenders: string[] = [];
  for (const file of PIPELINE_MODULES) {
    if (allowedFiles.includes(file)) continue;
    if (readSrc(file).includes(symbolCall)) {
      offenders.push(file);
    }
  }
  return offenders;
}

describe('phase 13S — experimental conversational stack architecture', () => {
  it('verifies each layer depends only on the next layer(s) beneath it', () => {
    const generate = readSrc(GENERATE);
    assertImports(
      generate,
      ['renderBaselineConversationalReplyPlan'],
      [
        'buildConversationalLayerInput',
        'executeBaselineConversationalRenderer',
        'createBaselineConversationalRendererRegistry',
        'executeConversationalLayerRenderer',
        'selectConversationalLayerRenderer',
        'invokeConversationalLayerRenderer',
        'renderBaselineConversationalLayer',
        'renderConversationReplyPlan',
      ],
      'generateBaselineConversationalReply',
    );
    expect(generate).toMatch(
      /return renderBaselineConversationalReplyPlan\(plan, styleProfile\)\.wording/,
    );

    const replyPlan = readSrc(REPLY_PLAN);
    assertImports(
      replyPlan,
      ['buildConversationalLayerInput', 'executeBaselineConversationalRenderer'],
      [
        'createBaselineConversationalRendererRegistry',
        'executeConversationalLayerRenderer',
        'selectConversationalLayerRenderer',
        'invokeConversationalLayerRenderer',
        'renderBaselineConversationalLayer',
        'renderConversationReplyPlan',
        'generateBaselineConversationalReply',
      ],
      'renderBaselineConversationalReplyPlan',
    );
    expect(replyPlan).toMatch(/buildConversationalLayerInput\(plan, styleProfile\)/);
    expect(replyPlan).toMatch(/executeBaselineConversationalRenderer\(input\)/);

    const executeBaseline = readSrc(EXECUTE_BASELINE);
    assertImports(
      executeBaseline,
      [
        'createBaselineConversationalRendererRegistry',
        'executeConversationalLayerRenderer',
      ],
      [
        'buildConversationalLayerInput',
        'selectConversationalLayerRenderer',
        'invokeConversationalLayerRenderer',
        'renderBaselineConversationalLayer',
        'renderConversationReplyPlan',
        'renderBaselineConversationalReplyPlan',
        'generateBaselineConversationalReply',
      ],
      'executeBaselineConversationalRenderer',
    );
    expect(executeBaseline).toMatch(
      /createBaselineConversationalRendererRegistry\(\)/,
    );
    expect(executeBaseline).toMatch(
      /executeConversationalLayerRenderer\(\s*registry,\s*'baseline',\s*input,\s*\)/,
    );

    const createRegistry = readSrc(CREATE_REGISTRY);
    assertImports(
      createRegistry,
      [
        'createConversationalRendererRegistry',
        'renderBaselineConversationalLayer',
      ],
      [
        'executeConversationalLayerRenderer',
        'selectConversationalLayerRenderer',
        'invokeConversationalLayerRenderer',
        'buildConversationalLayerInput',
        'executeBaselineConversationalRenderer',
        'renderConversationReplyPlan',
      ],
      'createBaselineConversationalRendererRegistry',
    );
    expect(createRegistry).toMatch(
      /baseline:\s*renderBaselineConversationalLayer/,
    );
    expect(createRegistry.includes('renderBaselineConversationalLayer(')).toBe(
      false,
    );

    const execute = readSrc(EXECUTE);
    assertImports(
      execute,
      [
        'selectConversationalLayerRenderer',
        'invokeConversationalLayerRenderer',
      ],
      [
        'createBaselineConversationalRendererRegistry',
        'createConversationalRendererRegistry',
        'renderBaselineConversationalLayer',
        'renderConversationReplyPlan',
        'buildConversationalLayerInput',
        'executeBaselineConversationalRenderer',
      ],
      'executeConversationalLayerRenderer',
    );
    expect(execute).toMatch(
      /selectConversationalLayerRenderer\(registry, rendererId\)/,
    );
    expect(execute).toMatch(
      /invokeConversationalLayerRenderer\(renderer, input\)/,
    );

    const invoke = readSrc(INVOKE);
    assertImports(
      invoke,
      ['ConversationalLayerRenderer', 'ConversationalLayerInput'],
      [
        'renderBaselineConversationalLayer',
        'selectConversationalLayerRenderer',
        'createConversationalRendererRegistry',
        'executeConversationalLayerRenderer',
        'buildConversationalLayerInput',
        'renderConversationReplyPlan',
      ],
      'invokeConversationalLayerRenderer',
    );
    expect(invoke).toMatch(/return renderer\(input\)/);

    // Baseline path reaches renderBaselineConversationalLayer only via registry
    // registration + selection + invocation — invoke itself stays generic.
    expect(createRegistry.includes('renderBaselineConversationalLayer')).toBe(
      true,
    );
    expect(execute.includes('invokeConversationalLayerRenderer')).toBe(true);
    expect(readSrc(BASELINE_RENDERER)).toMatch(
      /renderConversationReplyPlan\(input\.plan\)/,
    );
  });

  it('prohibits architecture-bypass call paths across the experimental pipeline', () => {
    const generate = readSrc(GENERATE);
    expect(generate.includes('renderBaselineConversationalLayer')).toBe(false);
    expect(generate.includes('executeConversationalLayerRenderer')).toBe(false);
    expect(generate.includes('invokeConversationalLayerRenderer')).toBe(false);

    const replyPlan = readSrc(REPLY_PLAN);
    expect(replyPlan.includes('renderBaselineConversationalLayer')).toBe(false);
    expect(replyPlan.includes('invokeConversationalLayerRenderer')).toBe(false);
    expect(replyPlan.includes('executeConversationalLayerRenderer')).toBe(false);

    const executeBaseline = readSrc(EXECUTE_BASELINE);
    expect(executeBaseline.includes('renderBaselineConversationalLayer')).toBe(
      false,
    );
    expect(executeBaseline.includes('invokeConversationalLayerRenderer')).toBe(
      false,
    );

    // No layer may skip beneath its neighbour.
    expect(generate.includes('buildConversationalLayerInput')).toBe(false);
    expect(generate.includes('executeBaselineConversationalRenderer')).toBe(
      false,
    );
    expect(replyPlan.includes('createBaselineConversationalRendererRegistry')).toBe(
      false,
    );
    expect(executeBaseline.includes('selectConversationalLayerRenderer')).toBe(
      false,
    );
    expect(readSrc(EXECUTE).includes('renderConversationReplyPlan')).toBe(false);
    expect(readSrc(INVOKE).includes('renderConversationReplyPlan')).toBe(false);
  });

  it('keeps each pipeline responsibility in exactly one owning layer', () => {
    expect(
      callSitesOutside('createBaselineConversationalRendererRegistry(', [
        EXECUTE_BASELINE,
        CREATE_REGISTRY,
      ]),
    ).toEqual([]);
    // Sole pipeline caller of the baseline registry factory.
    expect(readSrc(EXECUTE_BASELINE)).toMatch(
      /const registry = createBaselineConversationalRendererRegistry\(\)/,
    );
    expect(
      callSitesOutside('const registry = createBaselineConversationalRendererRegistry()', [
        EXECUTE_BASELINE,
      ]),
    ).toEqual([]);

    expect(
      callSitesOutside('selectConversationalLayerRenderer(', [EXECUTE, REGISTRY]),
    ).toEqual([]);
    expect(
      readSrc(EXECUTE).includes('selectConversationalLayerRenderer(registry, rendererId)'),
    ).toBe(true);

    expect(
      callSitesOutside('invokeConversationalLayerRenderer(', [EXECUTE, INVOKE]),
    ).toEqual([]);
    expect(readSrc(INVOKE)).toMatch(/return renderer\(input\)/);
    expect(readSrc(EXECUTE).includes('renderer(input)')).toBe(false);
    expect(readSrc(EXECUTE_BASELINE).includes('renderer(input)')).toBe(false);

    expect(
      callSitesOutside('renderConversationReplyPlan(', [BASELINE_RENDERER]),
    ).toEqual([]);
    expect(readSrc(BASELINE_RENDERER)).toMatch(
      /wording:\s*renderConversationReplyPlan\(input\.plan\)/,
    );

    expect(
      callSitesOutside('buildConversationalLayerInput(', [REPLY_PLAN, BUILD_INPUT]),
    ).toEqual([]);
    expect(
      readSrc(REPLY_PLAN).includes('buildConversationalLayerInput(plan, styleProfile)'),
    ).toBe(true);

    expect(callSitesOutside('.wording', [GENERATE, BASELINE_RENDERER])).toEqual(
      [],
    );
    expect(readSrc(GENERATE)).toMatch(/\.wording\s*;?\s*$/m);
    expect(readSrc(GENERATE).includes('renderBaselineConversationalReplyPlan')).toBe(
      true,
    );
  });

  it('forms one linear baseline composition with no alternate experimental entry into wording', () => {
    // Entry extracts wording only after the reply-plan adapter returns.
    expect(readSrc(GENERATE)).toMatch(
      /renderBaselineConversationalReplyPlan\(plan, styleProfile\)\.wording/,
    );

    // Adapter always builds input then executes baseline — never renders.
    const replyPlan = readSrc(REPLY_PLAN);
    expect(replyPlan).toMatch(/const input = buildConversationalLayerInput/);
    expect(replyPlan).toMatch(
      /return executeBaselineConversationalRenderer\(input\)/,
    );

    // Baseline execution always creates the baseline registry then executes id "baseline".
    const executeBaseline = readSrc(EXECUTE_BASELINE);
    expect(executeBaseline).toMatch(
      /const registry = createBaselineConversationalRendererRegistry\(\)/,
    );
    expect(executeBaseline).toMatch(/'baseline'/);
    expect(executeBaseline.includes("fallback")).toBe(false);

    // Execution always selects then invokes — never renders.
    const execute = readSrc(EXECUTE);
    expect(execute).toMatch(/const renderer = selectConversationalLayerRenderer/);
    expect(execute).toMatch(/return invokeConversationalLayerRenderer/);

    // Registry factory binds exactly the baseline renderer reference.
    expect(readSrc(CREATE_REGISTRY)).toMatch(
      /\{\s*baseline:\s*renderBaselineConversationalLayer,\s*\}/,
    );

    // Wording is produced only by the baseline renderer wrapping the
    // authoritative deterministic renderer.
    expect(readSrc(BASELINE_RENDERER)).toMatch(
      /ConversationalLayerRenderer\s*=\s*\(\s*input,?\s*\)\s*=>\s*\(\s*\{\s*wording:\s*renderConversationReplyPlan\(input\.plan\)\s*,?\s*\}\s*\)/,
    );
  });
});
