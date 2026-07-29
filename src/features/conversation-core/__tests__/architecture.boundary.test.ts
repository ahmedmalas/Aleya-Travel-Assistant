import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(process.cwd());

function readSrc(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

describe('conversation-core architectural boundary', () => {
  it('visible chat → public index → processConversationTurn → canonical empty state', () => {
    const panel = readSrc('src/components/trip-platform/AiPlanningPanel.tsx');
    const index = readSrc('src/features/conversation-core/index.ts');
    const processTurn = readSrc('src/features/conversation-core/processTurn.ts');
    const types = readSrc('src/features/conversation-core/types.ts');

    expect(panel).toMatch(
      /from ['"]\.\.\/\.\.\/features\/conversation-core['"]/,
    );
    expect(panel).toMatch(/processConversationTurn/);
    expect(panel).toMatch(/createInitialConversationCoreState/);
    expect(panel.includes('processTurn')).toBe(false);
    expect(panel.includes("from '../../features/conversation-core/types'")).toBe(
      false,
    );

    expect(index).toMatch(/createInitialConversationCoreState/);
    expect(index).toMatch(/processConversationTurn/);
    expect(processTurn).toMatch(/export function processConversationTurn/);
    expect(types).toMatch(/export function createInitialConversationCoreState/);
    expect(types).toMatch(/status: 'empty'/);
    expect(types).toMatch(/ConversationCoreStatus = 'empty' \| 'active'/);
    expect(processTurn).toMatch(/status: 'active'/);
    expect(types).toMatch(/turnCount: number/);
    expect(types).toMatch(/turnCount: 0,/);
    expect(types).toMatch(/transcript: ConversationTranscriptEntry\[\]/);
    expect(types).toMatch(/role: 'user'/);
    expect(types).toMatch(/role: 'assistant'/);
    expect(processTurn).toMatch(/userEntryId/);
    expect(processTurn).toMatch(/assistantEntryId/);
    expect(processTurn).toMatch(/userMessageAt/);
    expect(processTurn).toMatch(/assistantMessageAt/);
    expect(processTurn.includes('crypto.randomUUID')).toBe(false);
    expect(processTurn.includes('new Date()')).toBe(false);
  });

  it('has no old engine, persistence, travel-feature, or message-interpretation code', () => {
    const coreFiles = listFiles(resolve(ROOT, 'src/features/conversation-core')).filter(
      (path) => !path.includes(`${join('conversation-core', '__tests__')}`),
    );

    for (const file of coreFiles) {
      const src = readFileSync(file, 'utf8');
      expect(src.includes('features/travel-' + 'conversation'), file).toBe(false);
      expect(src.includes('send' + 'TravelMessage'), file).toBe(false);
      expect(src.includes('run' + 'ConversationTurn'), file).toBe(false);
      expect(src.includes('localStorage'), file).toBe(false);
      expect(src.includes('sessionStorage'), file).toBe(false);
      expect(src.includes('indexedDB'), file).toBe(false);
      expect(src.includes('travel-location-intelligence'), file).toBe(false);
      expect(src.includes('destination-discovery'), file).toBe(false);
      expect(src.includes('schemaVersion'), file).toBe(false);
      expect(src.includes('.trim('), file).toBe(false);
      expect(src.includes('.toLowerCase('), file).toBe(false);
      expect(src.includes('.normalize('), file).toBe(false);
    }
  });

  it('exposes exactly one public initial-state factory', () => {
    const index = readSrc('src/features/conversation-core/index.ts');
    const types = readSrc('src/features/conversation-core/types.ts');
    const factoryDefs = types.match(/export function create\w+/g) ?? [];

    expect(factoryDefs).toEqual(['export function createInitialConversationCoreState']);
    expect(index).toMatch(
      /export \{\n[\s\S]*createInitialConversationCoreState[\s\S]*\} from '\.\/types'/,
    );
    expect((types.match(/export function create\w+/g) ?? []).length).toBe(1);
    expect(types.includes('crypto.randomUUID')).toBe(false);
    expect(types.includes('new Date()')).toBe(false);
  });

  it('rejected conversation package is absent under src/features', () => {
    const features = resolve(ROOT, 'src/features');
    const names = readdirSync(features);
    expect(names).toContain('conversation-core');
    expect(names.includes('travel-' + 'conversation')).toBe(false);
  });
});
