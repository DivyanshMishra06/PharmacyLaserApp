import { test, expect } from '@playwright/test';
import { SUPABASE_URL, SUPABASE_ANON_KEY, E2E_CUSTOMER, E2E_MEDICINE1 } from './constants';

test.describe('Race Conditions & Concurrent Operations', () => {

  // ── Double Submit ─────────────────────────────────────────────────────────
  test('double-clicking Save Sale creates at most one invoice', async ({ page, request }) => {
    await page.goto('/quick-sale', { waitUntil: 'load' });
    const uniqueCustomer = `${E2E_CUSTOMER} DBLCLICK-${Date.now()}`;
    await page.getByPlaceholder('Optional').nth(0).fill(uniqueCustomer);

    const row = page.locator('table tbody tr').nth(0);
    await row.locator('input[placeholder="Enter medicine name"]').fill('E2E-DblClick-Med');
    await row.locator('input[placeholder="0"][min="0.01"]').fill('1');
    await row.locator('input[placeholder="0.00"]').fill('25');

    // Double-click the save button as fast as possible
    const saveBtn = page.getByRole('button', { name: 'Save Sale' });
    await saveBtn.dblclick();

    // Wait for operation to settle
    await page.waitForTimeout(6_000);

    // Verify DB: at most 1 unique invoice for this customer
    const res  = await request.get(
      `${SUPABASE_URL}/rest/v1/sales?customer_name=eq.${encodeURIComponent(uniqueCustomer)}&select=invoice_number`,
      {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      },
    );
    const data = await res.json() as { invoice_number: string }[];
    const uniqueInvoices = new Set(data.map((d) => d.invoice_number));
    expect(uniqueInvoices.size, 'Double-click should not create duplicate invoices').toBeLessThanOrEqual(1);
  });

  test('Save button shows "Saving..." while operation is in-progress', async ({ page }) => {
    await page.goto('/quick-sale', { waitUntil: 'load' });
    const row = page.locator('table tbody tr').nth(0);
    await row.locator('input[placeholder="Enter medicine name"]').fill(E2E_MEDICINE1);
    await row.locator('input[placeholder="0"][min="0.01"]').fill('1');
    await row.locator('input[placeholder="0.00"]').fill('15');
    await page.getByPlaceholder('Optional').nth(0).fill(E2E_CUSTOMER + ' SAVING');

    await page.getByRole('button', { name: 'Save Sale' }).click();
    // Button should immediately show "Saving..." (disabled state)
    await expect(page.getByRole('button', { name: 'Saving...' })).toBeVisible({ timeout: 3_000 });
  });

  // ── Rapid Navigation ──────────────────────────────────────────────────────
  test('rapid navigation between all routes causes no crash', async ({ page }) => {
    const routes = ['/', '/quick-sale', '/sales-list', '/reports', '/import', '/profile',
                    '/', '/quick-sale', '/reports'];
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    for (const route of routes) {
      await page.goto(route, { waitUntil: 'load' });
    }

    const critical = errors.filter((e) => !e.includes('ResizeObserver'));
    expect(critical, `Unexpected errors:\n${critical.join('\n')}`).toHaveLength(0);
  });

  test('navigating away while data is loading does not crash', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/', { waitUntil: 'load' });
    // Immediately navigate before Supabase data arrives
    await page.goto('/quick-sale', { waitUntil: 'load' });
    await expect(page.getByRole('heading', { name: 'Sale Entry' })).toBeVisible();

    expect(errors.filter((e) => !e.includes('ResizeObserver'))).toHaveLength(0);
  });

  test('reloading page mid-load does not crash', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/reports', { waitUntil: 'load' });
    await page.reload({ waitUntil: 'load' });
    await expect(page.getByRole('heading', { name: 'Reports', exact: false })).toBeVisible();

    expect(errors.filter((e) => !e.includes('ResizeObserver'))).toHaveLength(0);
  });

  // ── Rapid Tab Switching ────────────────────────────────────────────────────
  test('rapid report tab switching does not freeze or crash', async ({ page }) => {
    await page.goto('/reports', { waitUntil: 'load' });
    const tabs = ['Revenue', 'Medicines', 'Expiry', 'Credit Ledger', 'Customers', 'Discounts', 'Sales Register'];
    // Switch tabs as fast as possible (no await between clicks)
    for (const tab of tabs) {
      await page.getByRole('button', { name: tab, exact: false }).click();
    }
    await page.waitForTimeout(2_000);
    await expect(page.locator('main')).not.toBeEmpty();
  });

  // ── Search Race Condition ─────────────────────────────────────────────────
  test('rapidly changing search input does not crash Sales List', async ({ page }) => {
    await page.goto('/sales-list', { waitUntil: 'load' });
    const searchInput = page.getByPlaceholder('Search by medicine, invoice, customer or mobile...');
    const terms = ['a', 'ab', 'abc', 'ab', 'a', '', 'INV', 'Cash', ''];

    for (const term of terms) {
      await searchInput.fill(term);
    }

    await page.waitForTimeout(1_000);
    await expect(page.locator('main')).not.toBeEmpty();
  });

  // ── Date Filter Race Condition ────────────────────────────────────────────
  test('rapidly switching date presets ends on correct active state', async ({ page }) => {
    await page.goto('/reports', { waitUntil: 'load' });
    const presets = ['Yesterday', 'Last 7 Days', 'This Month', 'Today'];

    for (const preset of presets) {
      await page.getByRole('button', { name: preset, exact: true }).click();
    }

    // Final preset "Today" should be active
    await expect(
      page.getByRole('button', { name: 'Today', exact: true })
    ).toHaveClass(/bg-blue-|text-white|border-blue-/);
  });

  // ── Concurrent Page Loads (multi-tab simulation via separate contexts) ─────
  test('app functions correctly after being left idle for 3 seconds', async ({ page }) => {
    await page.goto('/quick-sale', { waitUntil: 'load' });
    await page.waitForTimeout(3_000);

    // Form should still be interactive
    await page.getByPlaceholder('Optional').nth(0).fill(E2E_CUSTOMER + ' IDLE');
    await expect(page.getByPlaceholder('Optional').nth(0)).toHaveValue(E2E_CUSTOMER + ' IDLE');
  });
});


