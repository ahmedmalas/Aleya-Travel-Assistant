/**
 * Browser proof — seven consultant dialogue scenarios with video.
 */
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const ARTIFACTS = '/opt/cursor/artifacts/dialogue-rebuild';
const FORBIDDEN = /Understood — I’ve saved|We’re in planning|What would you like next\?|Ask for a summary or say go ahead|I’ve still got your trip details|Tell me what to adjust|Shall I start the live search\?/i;
test.use({
    video: { mode: 'on', size: { width: 1280, height: 720 } },
});
async function openAssistant(page) {
    await page.goto('/#trip-platform');
    const guest = page.getByRole('button', { name: /Explore as guest/i });
    if (await guest.isVisible().catch(() => false)) {
        await guest.click();
    }
    await page.evaluate(() => {
        localStorage.removeItem('aleya-travel:conversation:v5');
    });
    await page.reload();
    if (await guest.isVisible().catch(() => false)) {
        await guest.click();
    }
    const panel = page.getByTestId('aleya-planning-panel');
    await expect(panel).toBeVisible({ timeout: 20_000 });
    await panel.scrollIntoViewIfNeeded();
    const reset = page.getByRole('button', { name: /Clear saved requirements/i });
    if (await reset.isVisible().catch(() => false)) {
        await reset.click();
    }
}
async function sendChat(page, text) {
    const input = page.locator('#aleya-chat-input');
    await input.fill(text);
    await page.getByRole('button', { name: /^Send$/i }).click();
    await expect(page.getByTestId('user-message').filter({ hasText: text }).last()).toBeVisible({
        timeout: 10_000,
    });
    await page.waitForTimeout(250);
}
async function lastAleya(page) {
    const bubbles = page.getByTestId('aleya-message').locator('[data-testid="chat-bubble-text"]');
    const count = await bubbles.count();
    return bubbles.nth(count - 1).innerText();
}
async function dumpProof(page, name, transcript) {
    fs.mkdirSync(ARTIFACTS, { recursive: true });
    const traces = await page.evaluate(() => window.__aleyaDialogue?.getDialogueTraces() ?? []);
    const search = await page.evaluate(() => window.__aleyaDialogue?.getSearchMemory() ?? null);
    const payload = {
        scenario: name,
        transcript,
        traces,
        searchSession: search
            ? {
                providersQueried: search.providersQueried,
                filters: search.filters,
                selected: search.selected,
                focusService: search.focusService,
            }
            : null,
        inventedPricesAvailabilityOrBookings: traces.every((t) => t.inventedPricesAvailabilityOrBookings === false),
        canonicalModifiedByValidatedActionsOnly: traces.every((t) => t.canonicalModifiedByValidatedActionsOnly === true),
    };
    fs.writeFileSync(path.join(ARTIFACTS, `${name}.json`), JSON.stringify(payload, null, 2));
    await page.screenshot({
        path: path.join(ARTIFACTS, `${name}.png`),
        fullPage: false,
    });
}
test.describe.configure({ mode: 'serial' });
test.describe('Dialogue consultant — seven scenarios', () => {
    test('Scenario 1 — Complete trip and natural search', async ({ page }) => {
        await openAssistant(page);
        const transcript = [];
        await sendChat(page, 'I want to go to Melbourne on 28 August for three nights. I need flights, accommodation and a hire car.');
        let reply = await lastAleya(page);
        expect(reply).toMatch(/travelling from|flying from|departure city/i);
        expect(reply).not.toMatch(FORBIDDEN);
        transcript.push({
            role: 'user',
            text: 'I want to go to Melbourne on 28 August for three nights. I need flights, accommodation and a hire car.',
        }, { role: 'aleya', text: reply });
        await sendChat(page, 'Sydney.');
        reply = await lastAleya(page);
        expect(reply).toMatch(/Sydney/i);
        expect(reply).toMatch(/ready|looking|Shall I start looking|whenever you’re ready/i);
        expect(reply).not.toMatch(FORBIDDEN);
        transcript.push({ role: 'user', text: 'Sydney.' }, { role: 'aleya', text: reply });
        await sendChat(page, 'Yes please.');
        reply = await lastAleya(page);
        expect(reply).toMatch(/looking|Searching|pulling live options/i);
        expect(reply).not.toMatch(/Shall I start the live search/i);
        expect(page.getByTestId('search-session-active-banner')).toBeVisible();
        transcript.push({ role: 'user', text: 'Yes please.' }, { role: 'aleya', text: reply });
        await dumpProof(page, 'scenario-1-complete-trip', transcript);
    });
    test('Scenario 2 — Hotel refinement', async ({ page }) => {
        await openAssistant(page);
        const transcript = [];
        await sendChat(page, 'I want to go to Melbourne on 28 August for three nights departing Sydney. I need flights, accommodation and a hire car.');
        transcript.push({
            role: 'user',
            text: 'I want to go to Melbourne on 28 August for three nights departing Sydney. I need flights, accommodation and a hire car.',
        });
        transcript.push({ role: 'aleya', text: await lastAleya(page) });
        await sendChat(page, 'Yes please.');
        transcript.push({ role: 'user', text: 'Yes please.' }, { role: 'aleya', text: await lastAleya(page) });
        await sendChat(page, 'Find me hotels around Docklands.');
        let reply = await lastAleya(page);
        expect(reply).toMatch(/Docklands/i);
        expect(reply).not.toMatch(/Shall I start the live search/i);
        transcript.push({ role: 'user', text: 'Find me hotels around Docklands.' }, { role: 'aleya', text: reply });
        await sendChat(page, 'Something luxurious but still good value.');
        reply = await lastAleya(page);
        expect(reply).toMatch(/value|four|five|luxur/i);
        expect(reply).not.toMatch(FORBIDDEN);
        transcript.push({ role: 'user', text: 'Something luxurious but still good value.' }, { role: 'aleya', text: reply });
        await dumpProof(page, 'scenario-2-hotel-refinement', transcript);
    });
    test('Scenario 3 — Result reference', async ({ page }) => {
        await openAssistant(page);
        const transcript = [];
        await sendChat(page, 'I want to go to Melbourne on 28 August for three nights departing Sydney. I need flights, accommodation and a hire car.');
        await sendChat(page, 'Yes please.');
        await sendChat(page, 'Find me hotels around Docklands.');
        await sendChat(page, 'I like the second hotel. Are there better flights that arrive earlier?');
        const reply = await lastAleya(page);
        expect(reply).toMatch(/hotel|earlier|flights/i);
        expect(reply).not.toMatch(FORBIDDEN);
        transcript.push({
            role: 'user',
            text: 'I like the second hotel. Are there better flights that arrive earlier?',
        }, { role: 'aleya', text: reply });
        await dumpProof(page, 'scenario-3-result-reference', transcript);
    });
    test('Scenario 4 — Requirement change', async ({ page }) => {
        await openAssistant(page);
        await sendChat(page, 'I want to go to Melbourne on 28 August for three nights departing Sydney. I need flights, accommodation and a hire car.');
        await sendChat(page, 'Yes please.');
        await sendChat(page, 'Actually make it four nights and return Tuesday afternoon.');
        const reply = await lastAleya(page);
        expect(reply).not.toMatch(/Here’s what I’ve got for your trip/i);
        expect(reply).not.toMatch(FORBIDDEN);
        await dumpProof(page, 'scenario-4-requirement-change', [
            {
                role: 'user',
                text: 'Actually make it four nights and return Tuesday afternoon.',
            },
            { role: 'aleya', text: reply },
        ]);
    });
    test('Scenario 5 — General travel question', async ({ page }) => {
        await openAssistant(page);
        await sendChat(page, 'I want to go to Melbourne on 28 August for three nights departing Sydney. I need flights, accommodation and a hire car.');
        await sendChat(page, 'Is Docklands convenient without a car?');
        const reply = await lastAleya(page);
        expect(reply).toMatch(/Docklands|tram|car/i);
        expect(reply).not.toMatch(/I’ve saved|Shall I start/i);
        await dumpProof(page, 'scenario-5-general-question', [
            { role: 'user', text: 'Is Docklands convenient without a car?' },
            { role: 'aleya', text: reply },
        ]);
    });
    test('Scenario 6 — New trip', async ({ page }) => {
        await openAssistant(page);
        await sendChat(page, 'I want to go to Melbourne on 28 August for three nights departing Sydney. I need flights, accommodation and a hire car.');
        await sendChat(page, 'Yes please.');
        await expect(page.getByTestId('search-session-active-banner')).toBeVisible();
        await sendChat(page, 'Now let’s plan the Gold Coast for my wife and me.');
        const reply = await lastAleya(page);
        expect(reply).toMatch(/Gold Coast/i);
        expect(reply).not.toMatch(/Melbourne/i);
        await expect(page.getByTestId('search-session-active-banner')).toHaveCount(0);
        await dumpProof(page, 'scenario-6-new-trip', [
            { role: 'user', text: 'Now let’s plan the Gold Coast for my wife and me.' },
            { role: 'aleya', text: reply },
        ]);
    });
    test('Scenario 7 — Misspellings', async ({ page }) => {
        await openAssistant(page);
        await sendChat(page, 'I want to go to Melbourne on 28 August for three nights departing Sydney. I need flights, accommodation and a hire car.');
        await sendChat(page, 'Yes please.');
        await sendChat(page, 'i need accomodation neer docklands somthing nice but not too exspensive');
        const reply = await lastAleya(page);
        expect(reply).toMatch(/Docklands|value|nice|accommodation|hotel/i);
        expect(reply).not.toMatch(FORBIDDEN);
        await dumpProof(page, 'scenario-7-misspellings', [
            {
                role: 'user',
                text: 'i need accomodation neer docklands somthing nice but not too exspensive',
            },
            { role: 'aleya', text: reply },
        ]);
    });
});
