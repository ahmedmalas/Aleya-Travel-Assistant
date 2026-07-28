import { expect, test } from '@playwright/test';
import path from 'node:path';

const ARTIFACTS = '/opt/cursor/artifacts/screenshots';

test('browser proof: SYD→MEL projection and product_default 1 adult', async ({ page }) => {
  await page.goto('/');

  await page.evaluate(() => {
    const state = {
      schemaVersion: 5,
      conversationId: 'browser-proof-syd-mel',
      phase: 'ready',
      origin: { value: 'Sydney', source: 'explicit', confirmed: true },
      destination: { value: 'Melbourne', source: 'explicit', confirmed: true },
      departureDate: {
        value: {
          kind: 'exact',
          isoDate: '2026-08-28',
          label: '28/08/2026',
          day: 28,
          month: 8,
          year: 2026,
        },
        source: 'explicit',
        confirmed: true,
      },
      returnDate: {
        value: { isoDate: '2026-08-31', label: '31/08/2026' },
        source: 'explicit',
        confirmed: true,
      },
      services: ['flights', 'accommodation', 'car_hire'],
      excludedServices: [],
      preferences: [],
      changeHistory: [],
      turnCount: 1,
      updatedAt: new Date().toISOString(),
      lastChangedFields: [],
    };
    localStorage.setItem(
      'aleya-travel:conversation:v5',
      JSON.stringify({ schemaVersion: 5, state }),
    );
  });

  await page.reload();

  const guest = page.getByRole('button', { name: /Explore as guest/i });
  if (await guest.isVisible().catch(() => false)) {
    await guest.click();
  }

  const form = page.getByTestId('canonical-search-form');
  await expect(form).toBeVisible({ timeout: 15_000 });
  await form.scrollIntoViewIfNeeded();

  await expect(form).toHaveAttribute('data-origin', 'SYD');
  await expect(form).toHaveAttribute('data-destination', 'MEL');
  await expect(form).toHaveAttribute('data-route', 'SYD→MEL');
  await expect(form).toHaveAttribute('data-depart', '2026-08-28');
  await expect(form).toHaveAttribute('data-return', '2026-08-31');
  await expect(form).toHaveAttribute('data-adults', '1');
  await expect(form).toHaveAttribute('data-traveller-source', 'product_default');

  await expect(page.getByTestId('search-origin')).toHaveValue('SYD');
  await expect(page.getByTestId('search-destination')).toHaveValue('MEL');
  await expect(page.getByTestId('search-travellers')).toHaveValue('1');
  await expect(page.getByTestId('search-travellers')).toHaveAttribute(
    'data-traveller-source',
    'product_default',
  );

  await page.screenshot({
    path: path.join(ARTIFACTS, 'syd-mel-search-form.png'),
    fullPage: false,
  });
  await page.getByTestId('search-travellers').screenshot({
    path: path.join(ARTIFACTS, 'traveller-product-default-1.png'),
  });
});
