import { test, expect } from '@playwright/test';
import { E2E_CUSTOMER, E2E_MEDICINE1, E2E_MEDICINE2 } from './constants';

test.describe('Quick Sale — Form & Submission', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/quick-sale', { waitUntil: 'load' });
  });

  // ── Form Structure ───────────────────────────────────────────────────────
  test('page heading is "Sale Entry"', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Sale Entry' })).toBeVisible();
  });

  test('customer name and mobile inputs are present', async ({ page }) => {
    await expect(page.getByPlaceholder('Optional').nth(0)).toBeVisible();
    await expect(page.getByPlaceholder('Optional').nth(1)).toBeVisible();
  });

  test('medicine table has all expected columns', async ({ page }) => {
    const headers = ['Medicine Name', 'Batch', 'Expiry', 'Qty', 'MRP', 'Disc', 'Total'];
    for (const h of headers) {
      await expect(page.locator('thead').getByText(h, { exact: false })).toBeVisible();
    }
  });

  test('Save Sale and Save & New Entry buttons are present', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Save Sale' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save & New Entry' })).toBeVisible();
  });

  test('Cash is the default selected payment mode', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Cash' })).toHaveClass(/bg-green-600/);
  });

  test('Add Medicine button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Add Medicine' }).first()).toBeVisible();
  });

  // ── Validation ───────────────────────────────────────────────────────────
  test('submitting empty form shows validation error toast', async ({ page }) => {
    await page.getByRole('button', { name: 'Save Sale' }).click();
    await expect(page.getByText(/At least one medicine is required/i)).toBeVisible({ timeout: 5_000 });
  });

  test('submitting medicine name but zero qty shows error', async ({ page }) => {
    await page.locator('table tbody tr').nth(0).locator('input[placeholder="Enter medicine name"]').fill(E2E_MEDICINE1);
    await page.getByRole('button', { name: 'Save Sale' }).click();
    await expect(page.getByText(/Quantity must be/i)).toBeVisible({ timeout: 5_000 });
  });

  test('submitting with zero MRP shows error', async ({ page }) => {
    const row = page.locator('table tbody tr').nth(0);
    await row.locator('input[placeholder="Enter medicine name"]').fill(E2E_MEDICINE1);
    await row.locator('input[placeholder="0"][min="0.01"]').fill('2');
    await page.getByRole('button', { name: 'Save Sale' }).click();
    await expect(page.getByText(/MRP must be/i)).toBeVisible({ timeout: 5_000 });
  });

  // ── Calculations ─────────────────────────────────────────────────────────
  test('row total auto-calculates: qty=3, mrp=50, disc=10% → ₹135.00', async ({ page }) => {
    const row = page.locator('table tbody tr').nth(0);
    await row.locator('input[placeholder="Enter medicine name"]').fill(E2E_MEDICINE1);
    await row.locator('input[placeholder="0"][min="0.01"]').fill('3');
    await row.locator('input[placeholder="0.00"]').fill('50');
    await row.locator('input[min="0"][max="100"]').fill('10');

    // 3 × 50 × 0.9 = 135.00
    await expect(row.locator('td').filter({ hasText: /135/ })).toBeVisible({ timeout: 3_000 });
  });

  test('subtotal reflects sum of all row totals', async ({ page }) => {
    const row = page.locator('table tbody tr').nth(0);
    await row.locator('input[placeholder="Enter medicine name"]').fill(E2E_MEDICINE1);
    await row.locator('input[placeholder="0"][min="0.01"]').fill('2');
    await row.locator('input[placeholder="0.00"]').fill('100');
    // row total = 200 → subtotal = ₹200.00 (appears in row, subtotal, and grand total — use first)
    await expect(page.getByText(/₹200\.00/).first()).toBeVisible({ timeout: 3_000 });
  });

  test('bill discount reduces grand total: subtotal=200, disc=10% → ₹180.00', async ({ page }) => {
    const row = page.locator('table tbody tr').nth(0);
    await row.locator('input[placeholder="Enter medicine name"]').fill(E2E_MEDICINE1);
    await row.locator('input[placeholder="0"][min="0.01"]').fill('2');
    await row.locator('input[placeholder="0.00"]').fill('100');

    // Bill discount input is the last number input in the bill summary section
    const billDiscInput = page.locator('input[placeholder="0"][min="0"][max="100"]').last();
    await billDiscInput.fill('10');

    await expect(page.getByText(/₹180\.00/)).toBeVisible({ timeout: 3_000 });
  });

  // ── Multi-Medicine ────────────────────────────────────────────────────────
  test('"Add Medicine" inserts a new table row', async ({ page }) => {
    const before = await page.locator('table tbody tr').count();
    await page.getByRole('button', { name: 'Add Medicine' }).first().click();
    expect(await page.locator('table tbody tr').count()).toBe(before + 1);
  });

  test('duplicate button copies row content', async ({ page }) => {
    const row0 = page.locator('table tbody tr').nth(0);
    await row0.locator('input[placeholder="Enter medicine name"]').fill(E2E_MEDICINE1);
    const before = await page.locator('table tbody tr').count();

    await row0.getByTitle('Duplicate').click();
    expect(await page.locator('table tbody tr').count()).toBe(before + 1);

    // New row should have same medicine name
    await expect(
      page.locator('table tbody tr').nth(1).locator('input[placeholder="Enter medicine name"]')
    ).toHaveValue(E2E_MEDICINE1);
  });

  test('remove button is disabled when only one row', async ({ page }) => {
    await expect(
      page.locator('table tbody tr').nth(0).getByTitle('Remove')
    ).toBeDisabled();
  });

  test('remove button deletes a row when multiple rows exist', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Medicine' }).first().click();
    const before = await page.locator('table tbody tr').count();
    await page.locator('table tbody tr').nth(0).getByTitle('Remove').click();
    expect(await page.locator('table tbody tr').count()).toBe(before - 1);
  });

  test('cannot add more than 10 medicine rows', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: 'Add Medicine' }).first();
    for (let i = 0; i < 12; i++) await addBtn.click();
    expect(await page.locator('table tbody tr').count()).toBeLessThanOrEqual(10);
  });

  // ── Payment Modes ─────────────────────────────────────────────────────────
  test('selecting UPI highlights UPI and unhighlights Cash', async ({ page }) => {
    await page.getByRole('button', { name: 'UPI' }).click();
    await expect(page.getByRole('button', { name: 'UPI' })).toHaveClass(/bg-blue-600/);
    await expect(page.getByRole('button', { name: 'Cash' })).not.toHaveClass(/bg-green-600/);
  });

  test('selecting Credit highlights Credit button', async ({ page }) => {
    await page.getByRole('button', { name: 'Credit' }).click();
    await expect(page.getByRole('button', { name: 'Credit' })).toHaveClass(/bg-orange-500/);
  });

  // ── Successful Save ───────────────────────────────────────────────────────
  test('valid sale saves successfully with INV- invoice number in toast', async ({ page }) => {
    await page.getByPlaceholder('Optional').nth(0).fill(E2E_CUSTOMER);
    const row = page.locator('table tbody tr').nth(0);
    await row.locator('input[placeholder="Enter medicine name"]').fill(E2E_MEDICINE1);
    await row.locator('input[placeholder="0"][min="0.01"]').fill('2');
    await row.locator('input[placeholder="0.00"]').fill('50');

    await page.getByRole('button', { name: 'Save Sale' }).click();
    await expect(page.getByText(/Saved! Invoice: INV-/i)).toBeVisible({ timeout: 20_000 });
  });

  test('"Save & New Entry" clears form after save', async ({ page }) => {
    await page.getByPlaceholder('Optional').nth(0).fill(E2E_CUSTOMER);
    const row = page.locator('table tbody tr').nth(0);
    await row.locator('input[placeholder="Enter medicine name"]').fill(E2E_MEDICINE1);
    await row.locator('input[placeholder="0"][min="0.01"]').fill('1');
    await row.locator('input[placeholder="0.00"]').fill('30');

    await page.getByRole('button', { name: 'Save & New Entry' }).click();
    await expect(page.getByText(/Saved! Invoice: INV-/i)).toBeVisible({ timeout: 20_000 });

    // Form cleared
    await expect(page.getByPlaceholder('Optional').nth(0)).toHaveValue('');
    await expect(
      page.locator('table tbody tr').nth(0).locator('input[placeholder="Enter medicine name"]')
    ).toHaveValue('');
  });

  test('"Last saved" banner appears with invoice number after save', async ({ page }) => {
    await page.getByPlaceholder('Optional').nth(0).fill(E2E_CUSTOMER);
    const row = page.locator('table tbody tr').nth(0);
    await row.locator('input[placeholder="Enter medicine name"]').fill(E2E_MEDICINE1);
    await row.locator('input[placeholder="0"][min="0.01"]').fill('1');
    await row.locator('input[placeholder="0.00"]').fill('20');

    await page.getByRole('button', { name: 'Save Sale' }).click();
    await expect(page.getByText(/Last saved: INV-/i)).toBeVisible({ timeout: 20_000 });
  });

  test('multi-medicine sale appears in Sales List with "+N more"', async ({ page }) => {
    await page.getByPlaceholder('Optional').nth(0).fill(E2E_CUSTOMER);
    const row0 = page.locator('table tbody tr').nth(0);
    await row0.locator('input[placeholder="Enter medicine name"]').fill(E2E_MEDICINE1);
    await row0.locator('input[placeholder="0"][min="0.01"]').fill('2');
    await row0.locator('input[placeholder="0.00"]').fill('50');

    await page.getByRole('button', { name: 'Add Medicine' }).first().click();
    const row1 = page.locator('table tbody tr').nth(1);
    await row1.locator('input[placeholder="Enter medicine name"]').fill(E2E_MEDICINE2);
    await row1.locator('input[placeholder="0"][min="0.01"]').fill('1');
    await row1.locator('input[placeholder="0.00"]').fill('80');

    await page.getByRole('button', { name: 'Save Sale' }).click();
    await expect(page.getByText(/Saved! Invoice: INV-/i)).toBeVisible({ timeout: 20_000 });

    // Navigate to sales list and verify "+1 more" label
    await page.goto('/sales-list', { waitUntil: 'load' });
    await page.getByPlaceholder('Search by medicine, invoice, customer or mobile...').fill(E2E_CUSTOMER);
    await expect(page.locator('table').getByText(/\+1 more/i).first()).toBeVisible({ timeout: 10_000 });
  });
});


