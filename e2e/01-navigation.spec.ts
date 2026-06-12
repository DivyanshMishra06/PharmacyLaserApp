import { test, expect } from '@playwright/test';

const routes = [
  { path: '/',           heading: 'Dashboard' },
  { path: '/quick-sale', heading: 'Sale Entry' },
  { path: '/sales-list', heading: "Today's Sales" },
  { path: '/reports',    heading: 'Reports' },
  { path: '/import',     heading: 'Import Sales Data' },
  { path: '/profile',    heading: 'Pharmacy Profile' },
];

test.describe('Navigation', () => {

  test('all routes load without crashing', async ({ page }) => {
    for (const { path, heading } of routes) {
      await page.goto(path, { waitUntil: 'load' });
      await expect(page.getByRole('heading', { name: heading, exact: false })).toBeVisible({ timeout: 10_000 });
    }
  });

  test('sidebar nav links navigate to correct pages (desktop)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    const links = ['Quick Sale', 'Sales List', 'Reports', 'Import Data', 'Profile', 'Dashboard'];
    for (const label of links) {
      await page.getByRole('link', { name: label, exact: true }).click();
      // Page should not show an error boundary or blank screen
      await expect(page.locator('main')).not.toBeEmpty();
    }
  });

  test('active nav link is highlighted', async ({ page }) => {
    await page.goto('/quick-sale', { waitUntil: 'load' });
    const activeLink = page.getByRole('link', { name: 'Quick Sale', exact: true });
    await expect(activeLink).toHaveClass(/bg-blue-700/);
  });

  test('mobile hamburger menu opens sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/', { waitUntil: 'load' });

    // Sidebar hidden on mobile initially
    const sidebar = page.locator('aside');
    await expect(sidebar).toHaveClass(/-translate-x-full/);

    // Click hamburger (Menu icon button in mobile header)
    await page.locator('header button').first().click();
    await expect(sidebar).not.toHaveClass(/-translate-x-full/);
  });

  test('mobile sidebar closes when nav link is clicked', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/', { waitUntil: 'load' });

    // Open sidebar
    await page.locator('header button').first().click();
    const sidebar = page.locator('aside');
    await expect(sidebar).not.toHaveClass(/-translate-x-full/);

    // Click a nav link
    await page.getByRole('link', { name: 'Quick Sale' }).click();
    await expect(page).toHaveURL('/quick-sale');
    // Sidebar should close
    await expect(sidebar).toHaveClass(/-translate-x-full/);
  });

  test('direct URL access works for all routes', async ({ page }) => {
    for (const { path } of routes) {
      const response = await page.goto(path, { waitUntil: 'load' });
      expect(response?.status()).not.toBe(404);
      await expect(page.locator('main')).not.toBeEmpty();
    }
  });

  test('no critical JS console errors on page load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    for (const { path } of routes) {
      await page.goto(path, { waitUntil: 'load' });
    }

    const critical = errors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('Non-Error')
    );
    expect(critical, `Console errors found:\n${critical.join('\n')}`).toHaveLength(0);
  });

  test('pharmacy name appears in sidebar header', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    const sidebarName = page.locator('aside p.font-bold');
    await expect(sidebarName).not.toBeEmpty();
  });
});


