import { test, expect } from '@playwright/test';
import { SUPABASE_URL, SUPABASE_ANON_KEY, E2E_CUSTOMER, E2E_MEDICINE1 } from './constants';

const HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

async function saveAndGetInvoice(page: import('@playwright/test').Page, qty: string, mrp: string, disc = '', billDisc = '') {
  await page.goto('/quick-sale', { waitUntil: 'load' });
  await page.getByPlaceholder('Optional').nth(0).fill(E2E_CUSTOMER);
  const row = page.locator('table tbody tr').nth(0);
  await row.locator('input[placeholder="Enter medicine name"]').fill(E2E_MEDICINE1);
  await row.locator('input[placeholder="0"][min="0.01"]').fill(qty);
  await row.locator('input[placeholder="0.00"]').fill(mrp);
  if (disc) await row.locator('input[min="0"][max="100"]').fill(disc);
  if (billDisc) {
    await page.locator('input[placeholder="0"][min="0"][max="100"]').last().fill(billDisc);
  }
  await page.getByRole('button', { name: 'Save Sale' }).click();
  const toast = page.getByText(/Saved! Invoice: INV-/i);
  await toast.waitFor({ timeout: 20_000 });
  const text = await toast.textContent() ?? '';
  return text.match(/INV-\d+/)?.[0] ?? '';
}

test.describe('Data Integrity', () => {

  // ── UI Calculation Tests (no backend needed) ──────────────────────────────
  test('UI: row total = qty × mrp exactly when no discount', async ({ page }) => {
    await page.goto('/quick-sale', { waitUntil: 'load' });
    const row = page.locator('table tbody tr').nth(0);
    await row.locator('input[placeholder="Enter medicine name"]').fill(E2E_MEDICINE1);
    await row.locator('input[placeholder="0"][min="0.01"]').fill('5');
    await row.locator('input[placeholder="0.00"]').fill('40');
    // 5 × 40 = 200
    await expect(row.locator('td').filter({ hasText: /200/ })).toBeVisible({ timeout: 3_000 });
  });

  test('UI: row total = qty × mrp × (1 − disc%): 4×75×0.8 = 240', async ({ page }) => {
    await page.goto('/quick-sale', { waitUntil: 'load' });
    const row = page.locator('table tbody tr').nth(0);
    await row.locator('input[placeholder="Enter medicine name"]').fill(E2E_MEDICINE1);
    await row.locator('input[placeholder="0"][min="0.01"]').fill('4');
    await row.locator('input[placeholder="0.00"]').fill('75');
    await row.locator('input[min="0"][max="100"]').fill('20');
    // 4 × 75 × 0.8 = 240
    await expect(row.locator('td').filter({ hasText: /240/ })).toBeVisible({ timeout: 3_000 });
  });

  test('UI: grand total applies bill discount: 200 × 0.85 = 170', async ({ page }) => {
    await page.goto('/quick-sale', { waitUntil: 'load' });
    const row = page.locator('table tbody tr').nth(0);
    await row.locator('input[placeholder="Enter medicine name"]').fill(E2E_MEDICINE1);
    await row.locator('input[placeholder="0"][min="0.01"]').fill('2');
    await row.locator('input[placeholder="0.00"]').fill('100');
    await page.locator('input[placeholder="0"][min="0"][max="100"]').last().fill('15');
    // subtotal=200 × (1-0.15) = 170
    await expect(page.getByText(/₹170\.00/)).toBeVisible({ timeout: 3_000 });
  });

  test('UI: adding two medicines: grand total is their combined total', async ({ page }) => {
    await page.goto('/quick-sale', { waitUntil: 'load' });
    const rows = page.locator('table tbody tr');
    await rows.nth(0).locator('input[placeholder="Enter medicine name"]').fill(E2E_MEDICINE1);
    await rows.nth(0).locator('input[placeholder="0"][min="0.01"]').fill('1');
    await rows.nth(0).locator('input[placeholder="0.00"]').fill('100');

    await page.getByRole('button', { name: 'Add Medicine' }).first().click();
    await rows.nth(1).locator('input[placeholder="Enter medicine name"]').fill('E2E-MedB');
    await rows.nth(1).locator('input[placeholder="0"][min="0.01"]').fill('2');
    await rows.nth(1).locator('input[placeholder="0.00"]').fill('50');

    // 100 + 100 = 200 (appears in subtotal and grand total — use first)
    await expect(page.getByText(/₹200\.00/).first()).toBeVisible({ timeout: 3_000 });
  });

  // ── Backend / DB Verification ─────────────────────────────────────────────
  test('stored total_amount = qty × mrp (no discount)', async ({ page, request }) => {
    const invNo = await saveAndGetInvoice(page, '3', '60');
    expect(invNo).toBeTruthy();

    const res  = await request.get(
      `${SUPABASE_URL}/rest/v1/sales?invoice_number=eq.${invNo}&select=total_amount`,
      { headers: HEADERS },
    );
    const data = await res.json() as { total_amount: number }[];
    expect(data[0].total_amount).toBeCloseTo(180, 1);
  });

  test('stored total_amount reflects bill discount: 2×100, billDisc=10% → 180', async ({ page, request }) => {
    const invNo = await saveAndGetInvoice(page, '2', '100', '', '10');
    expect(invNo).toBeTruthy();

    const res  = await request.get(
      `${SUPABASE_URL}/rest/v1/sales?invoice_number=eq.${invNo}&select=total_amount`,
      { headers: HEADERS },
    );
    const data = await res.json() as { total_amount: number }[];
    expect(data[0].total_amount).toBeCloseTo(180, 1);
  });

  test('payment_mode stored correctly as UPI', async ({ page, request }) => {
    await page.goto('/quick-sale', { waitUntil: 'load' });
    await page.getByPlaceholder('Optional').nth(0).fill(E2E_CUSTOMER);
    const row = page.locator('table tbody tr').nth(0);
    await row.locator('input[placeholder="Enter medicine name"]').fill(E2E_MEDICINE1);
    await row.locator('input[placeholder="0"][min="0.01"]').fill('1');
    await row.locator('input[placeholder="0.00"]').fill('50');
    await page.getByRole('button', { name: 'UPI' }).click();
    await page.getByRole('button', { name: 'Save Sale' }).click();
    const toast = page.getByText(/Saved! Invoice: INV-/i);
    await toast.waitFor({ timeout: 20_000 });
    const invNo = (await toast.textContent() ?? '').match(/INV-\d+/)?.[0];

    const res  = await request.get(
      `${SUPABASE_URL}/rest/v1/sales?invoice_number=eq.${invNo}&select=payment_mode`,
      { headers: HEADERS },
    );
    const data = await res.json() as { payment_mode: string }[];
    expect(data[0].payment_mode).toBe('UPI');
  });

  test('customer_name is stored correctly', async ({ page, request }) => {
    const invNo = await saveAndGetInvoice(page, '1', '50');
    const res   = await request.get(
      `${SUPABASE_URL}/rest/v1/sales?invoice_number=eq.${invNo}&select=customer_name`,
      { headers: HEADERS },
    );
    const data = await res.json() as { customer_name: string }[];
    expect(data[0].customer_name).toBe(E2E_CUSTOMER);
  });

  test('sale_date defaults to today', async ({ page, request }) => {
    const invNo = await saveAndGetInvoice(page, '1', '50');
    const res   = await request.get(
      `${SUPABASE_URL}/rest/v1/sales?invoice_number=eq.${invNo}&select=sale_date`,
      { headers: HEADERS },
    );
    const data  = await res.json() as { sale_date: string }[];
    const today = new Date().toISOString().split('T')[0];
    expect(data[0].sale_date).toBe(today);
  });

  test('invoice numbers are sequential between successive saves', async ({ page }) => {
    const invoices: string[] = [];
    for (let i = 0; i < 2; i++) {
      const invNo = await saveAndGetInvoice(page, '1', '10');
      invoices.push(invNo);
    }
    expect(invoices[0]).not.toBe(invoices[1]);
    const n0 = parseInt(invoices[0].replace('INV-', ''), 10);
    const n1 = parseInt(invoices[1].replace('INV-', ''), 10);
    expect(n1 - n0).toBe(1);
  });

  test('multi-medicine sale: all medicines share one invoice_number', async ({ page, request }) => {
    await page.goto('/quick-sale', { waitUntil: 'load' });
    await page.getByPlaceholder('Optional').nth(0).fill(E2E_CUSTOMER);
    const rows = page.locator('table tbody tr');
    await rows.nth(0).locator('input[placeholder="Enter medicine name"]').fill('E2E-MultiA');
    await rows.nth(0).locator('input[placeholder="0"][min="0.01"]').fill('1');
    await rows.nth(0).locator('input[placeholder="0.00"]').fill('20');
    await page.getByRole('button', { name: 'Add Medicine' }).first().click();
    await rows.nth(1).locator('input[placeholder="Enter medicine name"]').fill('E2E-MultiB');
    await rows.nth(1).locator('input[placeholder="0"][min="0.01"]').fill('2');
    await rows.nth(1).locator('input[placeholder="0.00"]').fill('30');
    await page.getByRole('button', { name: 'Save Sale' }).click();
    const toast = page.getByText(/Saved! Invoice: INV-/i);
    await toast.waitFor({ timeout: 20_000 });
    const invNo = (await toast.textContent() ?? '').match(/INV-\d+/)?.[0];
    expect(invNo).toBeTruthy();

    const res  = await request.get(
      `${SUPABASE_URL}/rest/v1/sales?invoice_number=eq.${invNo}&select=medicine_name,invoice_number`,
      { headers: HEADERS },
    );
    const data = await res.json() as { medicine_name: string; invoice_number: string }[];
    expect(data.length).toBe(2);
    expect(data.every((r) => r.invoice_number === invNo)).toBe(true);
  });

  // ── Known Bug Documentation ───────────────────────────────────────────────
  test('[KNOWN BUG] selling_rate always stored as MRP — not actual selling rate', async ({ page, request }) => {
    // Documented bug: useSales.ts line 68 sets selling_rate = parseFloat(med.mrp)
    const invNo = await saveAndGetInvoice(page, '1', '90');
    const res   = await request.get(
      `${SUPABASE_URL}/rest/v1/sales?invoice_number=eq.${invNo}&select=selling_rate,mrp`,
      { headers: HEADERS },
    );
    const data = await res.json() as { selling_rate: number; mrp: number }[];
    // This test documents current behaviour — selling_rate === mrp
    expect(data[0].selling_rate).toBe(data[0].mrp);
  });
});


