import { expect, test } from '@playwright/test';

async function pickEnabledCalendarDay(page: import('@playwright/test').Page) {
  const dialog = page.getByRole('dialog', { name: /Choose date/i });
  await expect(dialog).toBeVisible();
  const day = dialog.locator('button:not([disabled])').filter({ hasText: /^\d+$/ }).first();
  await day.click();
}

test.describe('Travel Buddy production smoke', () => {
  test('loads app shell, assistant preview, and trip platform', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel(/Assistant preview/i)).toBeVisible();
    await expect(page.getByText(/^Available now$/i).first()).toBeVisible();
    await page.goto('/#trip-platform');
    await expect(page.getByRole('region', { name: /trip platform/i })).toBeVisible();
    await expect(page.getByText(/Aleya Travel Assistant/i)).toBeVisible();
  });

  test('flight origin autocomplete, dates, and save plan', async ({ page }) => {
    await page.goto('/#trip-platform');
    const platform = page.getByRole('region', { name: /trip platform/i });
    await platform.getByRole('tab', { name: /^Book$/i }).click();
    await platform.getByRole('tab', { name: /^Flights$/i }).click();
    await expect(platform.getByRole('heading', { name: /^Flights$/i })).toBeVisible({ timeout: 15_000 });

    const origin = page.locator('#flight-plan-origin');
    await origin.click();
    await origin.pressSequentially('syd', { delay: 40 });
    await expect(page.getByRole('option', { name: /Sydney/i }).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole('option', { name: /Sydney/i }).first().click();
    await expect(origin).toHaveValue(/Sydney|SYD/i);

    const destination = page.locator('#flight-plan-destination');
    await destination.click();
    await destination.pressSequentially('nrt', { delay: 40 });
    await expect(page.getByRole('option', { name: /Tokyo|Narita/i }).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole('option', { name: /Tokyo|Narita/i }).first().click();

    await page.locator('#flight-plan-depart').click();
    await pickEnabledCalendarDay(page);
    await page.locator('#flight-plan-return').click();
    await pickEnabledCalendarDay(page);

    await page.getByRole('button', { name: /Save flight plan to trip/i }).click();
    await expect(page.getByText(/Flight plan saved/i)).toBeVisible();
  });

  test('hotel date range and travel services navigation', async ({ page }) => {
    await page.goto('/#trip-platform');
    const platform = page.getByRole('region', { name: /trip platform/i });
    await platform.getByRole('tab', { name: /^Book$/i }).click();
    await platform.getByRole('tab', { name: /^Hotels$/i }).click();
    await expect(platform.getByRole('heading', { name: /^Hotels$/i })).toBeVisible({ timeout: 15_000 });

    const destination = page.locator('#hotel-plan-destination');
    await destination.click();
    await destination.fill('');
    await destination.pressSequentially('Melbourne', { delay: 30 });
    const melbourneOption = page.getByRole('option', { name: /Melbourne/i }).first();
    if (await melbourneOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await melbourneOption.click();
    } else {
      await destination.press('Tab');
    }
    await expect(destination).toHaveValue(/Melbourne/i);
    await page.locator('#hotel-plan-checkin').click();
    await pickEnabledCalendarDay(page);
    await page.locator('#hotel-plan-checkout').click();
    await pickEnabledCalendarDay(page);
    await page.getByRole('button', { name: /Save hotel plan to trip/i }).click();
    await expect(page.getByText(/Hotel plan saved/i)).toBeVisible({ timeout: 10_000 });

    await page.getByRole('tab', { name: /Travel services/i }).click();
    await expect(page.getByRole('heading', { name: /Travel services/i })).toBeVisible();
    await page.getByRole('button', { name: /^Explore$/i }).click();
    await expect(page.getByText(/Leisure and Activities/i)).toBeVisible();
    await page.getByRole('button', { name: /^Move$/i }).click();
    await expect(page.getByText(/^Taxis$/i)).toBeVisible();
  });

  test('trip brief panel validates and generates a draft plan', async ({ page }) => {
    await page.goto('/#trip-platform');
    await page.getByRole('tab', { name: /^Home$/i }).click();
    await page.getByRole('tab', { name: /Trip brief/i }).click();

    await expect(page.getByText(/Trip brief → draft plan/i)).toBeVisible({ timeout: 15_000 });

    await page.locator('#brief-destination').fill('Lisbon');
    await page.locator('#brief-start').click();
    // Jump months if needed is heavy; select any enabled day then set via evaluate for deterministic dates.
    await page.evaluate(() => {
      const start = document.getElementById('brief-start');
      const end = document.getElementById('brief-end');
      start?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.locator('#brief-start').click();
    const dialog = page.getByRole('dialog', { name: /Choose date/i });
    await expect(dialog).toBeVisible();
    // Use Today if available and valid, else first enabled day.
    const todayBtn = dialog.getByRole('button', { name: /^Today$/i });
    if (await todayBtn.isVisible()) {
      await todayBtn.click();
    } else {
      await pickEnabledCalendarDay(page);
    }
    await page.locator('#brief-end').click();
    await pickEnabledCalendarDay(page);
    await page.locator('#brief-travelers').fill('2');
    await page.getByLabel('Food').check();
    await page.getByLabel('Culture').check();
    await page.getByRole('button', { name: /generate draft plan/i }).click();
    await expect(page.getByText(/day draft plan for Lisbon/i)).toBeVisible();
    await expect(page.getByText(/Suggested days/i)).toBeVisible();
  });

  test('auth panel exposes cloud or local status without crashing', async ({ page }) => {
    await page.goto('/#trip-platform');
    await page.getByRole('tab', { name: /^System$/i }).click();
    await page.getByRole('tab', { name: /^Auth$/i }).click();
    await expect(page.getByText(/Authentication/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Mode:/i)).toBeVisible();
  });
});
