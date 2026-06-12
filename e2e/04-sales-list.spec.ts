import { test, expect } from '@playwright/test';
import { SUPABASE_URL, SUPABASE_ANON_KEY, E2E_CUSTOMER, E2E_MEDICINE1 } from './constants';

const HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

async function insertTestSale(request: import('@playwright/test').APIRequestContext, suffix = '') {
  const listRes = await request.get(
    `${SUPABASE_URL}/rest/v1/sales?select=invoice_number&order=created_at.desc&limit=1`,
    { headers: HEADERS },
  );
  const list = await listRes.json() as { invoice_number: string }[];
  const num  = parseInt(list[0]?.invoice_number?.match(/\d+/)?.[0] ?? '0', 10) + 1;
  const invNo = `INV-${String(num).padStart(4, '0')}`;
  const today = new Date().toISOString().split('T')[0];

  const res = await request.post(`${SUPABASE_URL}/rest/v1/sales`, {
    headers: HEADERS,
    data: [{
      sale_date: today,
      invoice_number: invNo,
      medicine_name: E2E_MEDICINE1,
      quantity: 3, mrp: 50, selling_rate: 50, total_amount: 135,
      payment_mode: 'Cash',
      customer_name: E2E_CUSTOMER + suffix,
      mobile_number: '9876543210',
    }],
  });
  const data = await res.json() as { id: string }[];
  return { id: data[0]?.id, invNo };
}

test.describe('Sales List — Search, View, Edit, Delete', () => {

  let seededId = '';

  test.beforeAll(async ({ request }) => {
    const { id } = await insertTestSale(request);
    seededId = id;
  });

  test.afterAll(async ({ request }) => {
    if (!seededId) return;
    await request.delete(`${SUPABASE_URL}/rest/v1/sales?id=eq.${seededId}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/sales-list', { waitUntil: 'load' });
    // Wait for sales to load (loading spinner disappears)
    await page.waitForFunction(
      () => !document.body.textContent?.includes('Loading...'),
      {},
      { timeout: 15_000 },
    );
  });

  // ── Structure ─────────────────────────────────────────────────────────────
  test('page heading is "Today\'s Sales"', async ({ page }) => {
    await expect(page.getByRole('heading', { name: "Today's Sales", exact: false })).toBeVisible();
  });

  test('search input with correct placeholder is present', async ({ page }) => {
    await expect(
      page.getByPlaceholder('Search by medicine, invoice, customer or mobile...')
    ).toBeVisible();
  });

  // ── Search ────────────────────────────────────────────────────────────────
  test('search by customer name shows matching result', async ({ page }) => {
    await page.getByPlaceholder('Search by medicine, invoice, customer or mobile...').fill(E2E_CUSTOMER);
    await expect(page.locator('table').getByText(E2E_CUSTOMER).first()).toBeVisible({ timeout: 5_000 });
  });

  test('search by medicine name shows matching result', async ({ page }) => {
    await page.getByPlaceholder('Search by medicine, invoice, customer or mobile...').fill(E2E_MEDICINE1);
    await expect(page.locator('table').getByText(E2E_MEDICINE1).first()).toBeVisible({ timeout: 5_000 });
  });

  test('search by mobile number shows matching customer', async ({ page }) => {
    await page.getByPlaceholder('Search by medicine, invoice, customer or mobile...').fill('9876543210');
    await expect(page.locator('table').getByText(E2E_CUSTOMER).first()).toBeVisible({ timeout: 5_000 });
  });

  test('non-matching search shows "No results" message', async ({ page }) => {
    await page.getByPlaceholder('Search by medicine, invoice, customer or mobile...').fill('ZZZNOMATCH99999XYZ');
    await expect(page.getByText(/No results for/i)).toBeVisible({ timeout: 5_000 });
  });

  test('clearing search reveals all sales again', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search by medicine, invoice, customer or mobile...');
    await searchInput.fill('ZZZNOMATCH99999XYZ');
    await expect(page.getByText(/No results for/i)).toBeVisible({ timeout: 3_000 });
    // Clear the search
    await searchInput.fill('');
    await expect(page.getByText(/No results for/i)).not.toBeVisible({ timeout: 3_000 });
  });

  // ── Invoice Modal ─────────────────────────────────────────────────────────
  test('clicking invoice number opens invoice detail modal', async ({ page }) => {
    await page.getByPlaceholder('Search by medicine, invoice, customer or mobile...').fill(E2E_CUSTOMER);
    const invoiceBtn = page.locator('table button').filter({ hasText: /INV-\d+/ }).first();
    await invoiceBtn.waitFor({ timeout: 8_000 });
    await invoiceBtn.click();
    await expect(page.locator('.fixed.inset-0').last()).toBeVisible({ timeout: 3_000 });
  });

  test('invoice modal shows correct medicine name', async ({ page }) => {
    await page.getByPlaceholder('Search by medicine, invoice, customer or mobile...').fill(E2E_CUSTOMER);
    const invoiceBtn = page.locator('table button').filter({ hasText: /INV-\d+/ }).first();
    await invoiceBtn.waitFor({ timeout: 8_000 });
    await invoiceBtn.click();
    await expect(page.locator('.fixed.inset-0').last().getByText(E2E_MEDICINE1)).toBeVisible({ timeout: 5_000 });
  });

  test('invoice modal closes on Escape key', async ({ page }) => {
    await page.getByPlaceholder('Search by medicine, invoice, customer or mobile...').fill(E2E_CUSTOMER);
    const invoiceBtn = page.locator('table button').filter({ hasText: /INV-\d+/ }).first();
    await invoiceBtn.waitFor({ timeout: 8_000 });
    await invoiceBtn.click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.fixed.inset-0').last()).not.toBeVisible({ timeout: 3_000 });
  });

  // ── Edit ──────────────────────────────────────────────────────────────────
  test('Edit button opens edit modal with pre-filled data', async ({ page }) => {
    await page.getByPlaceholder('Search by medicine, invoice, customer or mobile...').fill(E2E_CUSTOMER);
    const invoiceBtn = page.locator('table button').filter({ hasText: /INV-\d+/ }).first();
    await invoiceBtn.waitFor({ timeout: 8_000 });
    await invoiceBtn.click();
    await page.getByRole('button', { name: /Edit/i }).first().click();

    await expect(page.getByRole('heading', { name: /Edit Sale/i })).toBeVisible({ timeout: 5_000 });
    // Medicine name field should be pre-filled
    await expect(
      page.locator('label').filter({ hasText: 'Medicine Name' }).locator('..').locator('input')
    ).toHaveValue(E2E_MEDICINE1);
  });

  test('Edit modal: changing quantity and saving shows success', async ({ page }) => {
    await page.getByPlaceholder('Search by medicine, invoice, customer or mobile...').fill(E2E_CUSTOMER);
    const invoiceBtn = page.locator('table button').filter({ hasText: /INV-\d+/ }).first();
    await invoiceBtn.waitFor({ timeout: 8_000 });
    await invoiceBtn.click();
    await page.getByRole('button', { name: /Edit/i }).first().click();
    await expect(page.getByRole('heading', { name: /Edit Sale/i })).toBeVisible({ timeout: 5_000 });

    const qtyInput = page.locator('label').filter({ hasText: /^Qty/ }).locator('..').locator('input');
    await qtyInput.clear();
    await qtyInput.fill('5');

    await page.getByRole('button', { name: 'Update Sale' }).click();
    await expect(page.getByText(/Sale updated/i)).toBeVisible({ timeout: 10_000 });
  });

  // ── Delete ────────────────────────────────────────────────────────────────
  test('Delete removes sale from list', async ({ page, request }) => {
    // Seed a separate sale for deletion
    const { id: delId } = await insertTestSale(request, ' DELETE');

    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(
      () => !document.body.textContent?.includes('Loading...'),
      {},
      { timeout: 15_000 },
    );

    await page.getByPlaceholder('Search by medicine, invoice, customer or mobile...').fill(E2E_CUSTOMER + ' DELETE');
    const invoiceBtn = page.locator('table button').filter({ hasText: /INV-\d+/ }).first();
    await invoiceBtn.waitFor({ timeout: 8_000 });
    await invoiceBtn.click();

    await page.getByRole('button', { name: /Delete/i }).first().click();
    // Confirm delete (either a confirm button or the delete itself)
    const confirmBtn = page.getByRole('button', { name: /^Yes$|^Confirm$|Yes, Delete/i });
    if (await confirmBtn.isVisible({ timeout: 1_000 })) await confirmBtn.click();

    await expect(page.getByText(/Sale deleted/i)).toBeVisible({ timeout: 10_000 });

    // Clean up if delete failed (belt+suspenders)
    if (delId) {
      await request.delete(`${SUPABASE_URL}/rest/v1/sales?id=eq.${delId}`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      }).catch(() => {});
    }
  });

  // ── Summary Strip ─────────────────────────────────────────────────────────
  test('summary strip shows invoice count and total amount', async ({ page }) => {
    await page.getByPlaceholder('Search by medicine, invoice, customer or mobile...').fill(E2E_CUSTOMER);
    await expect(page.getByText(/invoice.*medicine/i).first()).toBeVisible({ timeout: 8_000 });
  });

  // ── Empty state ───────────────────────────────────────────────────────────
  test('empty search shows "No results" message with search term', async ({ page }) => {
    await page.getByPlaceholder('Search by medicine, invoice, customer or mobile...').fill('XYZNONEXISTENT');
    await expect(page.getByText(/No results for "XYZNONEXISTENT"/i)).toBeVisible({ timeout: 3_000 });
  });
});


