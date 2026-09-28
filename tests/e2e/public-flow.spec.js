import { test, expect } from '@playwright/test';

test('public shell navigation, fuel planner and shop basket work', async ({ page }) => {
  await page.goto('/?jfapp=16&legacy=cleared&e2e=1');

  await expect(page.getByText('JUST FUEL').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /Train\. Race\. Fuel\./i })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();

  await page.getByRole('button', { name: 'Fuel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your fueling hub' })).toBeVisible();
  await page.getByRole('button', { name: /Quick Fuel Planner/i }).click();
  await expect(page.getByRole('heading', { name: /Build your.*fuel plan/i })).toBeVisible();

  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Choose exactly.*what you want/i })).toBeVisible();

  const firstPlus = page.locator('.variant-stepper button').filter({ has: page.locator('svg') }).nth(1);
  await firstPlus.click();
  await page.getByRole('button', { name: /Add selected Energy Gel to basket/i }).click();
  await expect(page.getByText(/added to basket/i)).toBeVisible();
  await page.getByRole('button', { name: 'View basket' }).click();
  await expect(page.getByText(/basket/i).first()).toBeVisible();

  const flavour = page.getByLabel('Choose Energy Gel flavour').first();
  await expect(flavour).toBeVisible();
  await flavour.selectOption({ label: 'Lime' });
  await expect(flavour.locator('option:checked')).toHaveText('Lime');
});

test('physical current recovery route opens the current app', async ({ page }) => {
  await page.goto('/current/?jfapp=16&legacy=cleared&e2e=1');
  await page.waitForURL(/jfapp=16/);
  await expect(page.getByText('JUST FUEL').first()).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
});
