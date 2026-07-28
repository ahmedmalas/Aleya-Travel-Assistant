import { expect, test } from '@playwright/test';
import path from 'node:path';
const ARTIFACTS = '/opt/cursor/artifacts';
const COMPLETE = 'I want to go to Gold Coast on the 28th of August departing from Melbourne and staying at Surfers Paradise for 3 nights returning Monday. I need flights, hotel and car hire.';
async function enterGuest(page) {
    const guest = page.getByRole('button', { name: /Explore as guest/i });
    if (await guest.isVisible().catch(() => false)) {
        await guest.click();
    }
}
async function sendChat(page, text) {
    const input = page.locator('#aleya-chat-input');
    await input.fill(text);
    await page.getByRole('button', { name: /^Send$/i }).click();
    await expect(page.getByTestId('aleya-chat-scroll')).toContainText(text, {
        timeout: 15_000,
    });
}
test('browser recording: search session continuation conversation', async ({ page }) => {
    await page.goto('/');
    await enterGuest(page);
    await expect(page.getByTestId('aleya-planning-panel')).toBeVisible({ timeout: 15_000 });
    await sendChat(page, COMPLETE);
    await sendChat(page, 'Search for my trip.');
    await expect(page.getByTestId('aleya-chat-scroll')).toContainText(/Starting live search/i);
    await expect(page.getByTestId('search-session-active-banner')).toBeVisible();
    await sendChat(page, 'Find hotels around Docklands.');
    await expect(page.getByTestId('aleya-chat-scroll')).toContainText(/Continuing your active search/i);
    await expect(page.getByTestId('aleya-chat-scroll')).not.toContainText(/Shall I start the live search\?/i);
    await sendChat(page, 'Show luxury hotels.');
    await expect(page.getByTestId('aleya-chat-scroll')).toContainText(/luxury/i);
    await sendChat(page, 'Only flights now.');
    await expect(page.getByTestId('aleya-chat-scroll')).toContainText(/Showing flights/i);
    await sendChat(page, 'Actually change to Southbank.');
    await expect(page.getByTestId('aleya-chat-scroll')).toContainText(/Refreshing/i);
    await expect(page.getByTestId('search-session-active-banner')).toBeVisible();
    await page.screenshot({
        path: path.join(ARTIFACTS, 'screenshots', 'search-session-continuation.png'),
        fullPage: false,
    });
});
