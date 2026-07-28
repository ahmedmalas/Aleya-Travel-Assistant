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
  it('visible chat imports only conversation-core for turn processing', () => {
    const panel = readSrc('src/components/trip-platform/AiPlanningPanel.tsx');

    expect(panel).toMatch(
      /from ['"]\.\.\/\.\.\/features\/conversation-core['"]/,
    );
    expect(panel).toMatch(/processConversationTurn/);
    expect(panel.includes('features/travel-' + 'conversation')).toBe(false);
    expect(panel.includes('send' + 'TravelMessage')).toBe(false);
    expect(panel.includes('run' + 'ConversationTurn')).toBe(false);
    expect(panel.includes('aleya-travel:conversation:' + 'v')).toBe(false);
  });

  it('conversation-core has a single public turn entry and no persistence', () => {
    const index = readSrc('src/features/conversation-core/index.ts');
    const processTurn = readSrc('src/features/conversation-core/processTurn.ts');
    const types = readSrc('src/features/conversation-core/types.ts');

    expect(index).toMatch(/processConversationTurn/);
    expect(index.includes('send' + 'TravelMessage')).toBe(false);
    expect(index.includes('run' + 'ConversationTurn')).toBe(false);
    expect(processTurn).toMatch(/export function processConversationTurn/);
    expect(processTurn).not.toMatch(/localStorage|sessionStorage|indexedDB/i);
    expect(types).toMatch(/aleya-travel:conversation-core:first-principles/);
    expect(types.includes('conversation:' + 'v')).toBe(false);
  });

  it('rejected conversation package is absent under src/features', () => {
    const features = resolve(ROOT, 'src/features');
    const names = readdirSync(features);
    expect(names).toContain('conversation-core');
    expect(names.includes('travel-' + 'conversation')).toBe(false);
    expect(listFiles(resolve(features, 'conversation-core')).length).toBeGreaterThan(0);
  });
});
