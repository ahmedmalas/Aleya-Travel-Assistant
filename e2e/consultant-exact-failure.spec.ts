/**
 * Browser proof — exact live failure conversation must work end-to-end.
 */
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACTS = '/opt/cursor/artifacts/consultant-rebuild';

test.use({
  video: { mode: 'on', size: { width: 1280, height: 720 } },
});

async function openAssistant(page: import('@playwright/test').Page) {
  await page.goto('/#trip-platform');
  const guest = page.getByRole('button', { name: /Explore as guest/i });
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await page.evaluate(() => {
    localStorage.removeItem('aleya-travel:conversation:v5');
  });
  await page.reload();
  if (await guest.isVisible().catch(() => false)) await guest.click();
  const panel = page.getByTestId('aleya-planning-panel');
  await expect(panel).toBeVisible({ timeout: 20_000 });
  await panel.scrollIntoViewIfNeeded();
  const reset = page.getByRole('button', { name: /Clear saved requirements/i });
  if (await reset.isVisible().catch(() => false)) await reset.click();
}

async function sendChat(page: import('@playwright/test').Page, text: string) {
  const input = page.locator('#aleya-chat-input');
  await input.fill(text);
  await page.getByRole('button', { name: /^Send$/i }).click();
  await expect(page.getByTestId('user-message').filter({ hasText: text }).last()).toBeVisible({
    timeout: 10_000,
  });
  await page.waitForTimeout(300);
}

async function lastAleya(page: import('@playwright/test').Page) {
  const bubbles = page.getByTestId('aleya-message').locator('[data-testid="chat-bubble-text"]');
  const count = await bubbles.count();
  return bubbles.nth(count - 1).innerText();
}

test('exact live failure: route only then hotel+car+search same turn', async ({ page }) => {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  await openAssistant(page);

  const transcript: Array<{ role: string; text: string }> = [];

  await sendChat(page, 'i want to go melbourne from sydney on the 28th of august');
  let reply = await lastAleya(page);
  expect(reply).not.toMatch(/accommodation|car hire|hire car/i);
  expect(reply).toMatch(/Sydney|Melbourne/i);
  transcript.push(
    { role: 'user', text: 'i want to go melbourne from sydney on the 28th of august' },
    { role: 'aleya', text: reply },
  );

  const stateAfterFirst = await page.evaluate(() => {
    const raw = localStorage.getItem('aleya-travel:conversation:v5');
    return raw ? JSON.parse(raw) : null;
  });
  expect(stateAfterFirst.state.services ?? []).not.toContain('accommodation');
  expect(stateAfterFirst.state.services ?? []).not.toContain('car_hire');

  await sendChat(page, 'ill need hotel and car hire . yes begin your search');
  reply = await lastAleya(page);
  expect(reply).toMatch(/added/i);
  expect(reply).toMatch(/starting the search|searching|search now/i);
  expect(reply).not.toMatch(/whenever you.?re ready/i);
  expect(reply).not.toBe(transcript[1]!.text);
  transcript.push(
    { role: 'user', text: 'ill need hotel and car hire . yes begin your search' },
    { role: 'aleya', text: reply },
  );

  await expect(page.getByTestId('search-session-active-banner')).toBeVisible();

  const traces = await page.evaluate(() => window.__aleyaConsultant?.getConsultantTraces() ?? []);
  const last = traces.at(-1);
  expect(last).toBeTruthy();
  expect(last!.goals.some((g: { type: string }) => g.type === 'start_search')).toBe(true);
  expect(
    last!.goals.filter((g: { type: string }) => g.type === 'add_service').length,
  ).toBeGreaterThanOrEqual(2);
  expect(last!.providerActions.some((a: { kind: string }) => a.kind === 'start_search')).toBe(
    true,
  );

  const stateAfter = await page.evaluate(() => {
    const raw = localStorage.getItem('aleya-travel:conversation:v5');
    return raw ? JSON.parse(raw) : null;
  });

  fs.writeFileSync(
    path.join(ARTIFACTS, 'exact-live-failure.json'),
    JSON.stringify(
      {
        transcript,
        stateAfterFirst: {
          origin: stateAfterFirst.state.origin,
          destination: stateAfterFirst.state.destination,
          departureDate: stateAfterFirst.state.departureDate,
          services: stateAfterFirst.state.services,
        },
        stateAfterSecond: {
          origin: stateAfter.state.origin,
          destination: stateAfter.state.destination,
          services: stateAfter.state.services,
        },
        lastTrace: last,
        inventedServicesOnFirstTurn: false,
      },
      null,
      2,
    ),
  );

  await page.screenshot({
    path: path.join(ARTIFACTS, 'exact-live-failure.png'),
    fullPage: false,
  });
});
