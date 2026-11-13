import { expect, test } from '@playwright/test';

test('builds, restyles and exports a plate', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto('./');
  await expect(page.getByText('Watertight, single solid')).toBeVisible({ timeout: 30_000 });

  await page.getByRole('textbox', { name: 'Name' }).fill('Sergeant Vale');
  await page.getByRole('textbox', { name: /Line 2/ }).fill('Veteran');
  await page.getByRole('button', { name: /All 9 themes/ }).click();
  await page.locator('.gallery .theme-card', { hasText: 'Forge Cog' }).click();
  await page.getByRole('radio', { name: 'Engraved' }).click();
  await expect(page.getByText('Watertight, single solid')).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: 'Export…' }).click();
  await page.getByRole('radio', { name: /3MF/ }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download 3MF' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('nameplate-sergeant-vale-32mm.3mf');

  // share link restores the design in a new tab
  const hash = await page.evaluate(() => window.location.hash);
  expect(hash).toMatch(/^#d=/);
  const other = await page.context().newPage();
  await other.goto(`./${hash}`);
  await expect(other.getByRole('textbox', { name: 'Name' })).toHaveValue('Sergeant Vale');

  expect(errors).toEqual([]);
});

test('phone layout has no sideways scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await expect(page.getByRole('tab', { name: 'Style' })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBe(0);
});
