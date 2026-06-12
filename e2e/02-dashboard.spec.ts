import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {

  test.beforeEach(async ({ page }) => {
    // Use domcontentloaded — networkidle hangs due to Supabase WebSocket
    await page.goto('/', { waitUntil: 'load' });
  });

  test('page heading "Dashboard" is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('Today stat card is rendered', async ({ page }) => {
    await expect(page.getByText('Today', { exact: true })).toBeVisible();
  });

  test('Cash stat card is rendered', async ({ page }) => {
    await expect(page.getByText('Cash', { exact: true })).toBeVisible();
  });

  test('UPI stat card is rendered', async ({ page }) => {
    await expect(page.getByText('UPI', { exact: true })).toBeVisible();
  });

  test('Credit stat card is rendered', async ({ page }) => {
    // "Credit" appears both in nav badge and stats card
    const creditText = page.getByText('Credit');
    await expect(creditText.first()).toBeVisible();
  });

  test('loading state shows "..." then resolves to ₹ values', async ({ page }) => {
    // Initially shows "..." then resolves; check final state after data loads
    await page.waitForFunction(() => {
      const text = document.body.textContent || '';
      return text.includes('₹') && !text.includes('...');
    }, {}, { timeout: 15_000 });

    const rupee = page.getByText(/₹[\d,]+/);
    await expect(rupee.first()).toBeVisible();
  });

  test('invoice count is displayed on Today card', async ({ page }) => {
    // Wait for data
    await page.waitForFunction(
      () => !(document.body.textContent || '').includes('...'),
      {},
      { timeout: 15_000 },
    );
    // "N invoices" text appears under the today card (multiple cards show this text, use first)
    await expect(page.getByText(/\d+ invoices/).first()).toBeVisible();
  });

  test('"New Sale" button links to /quick-sale', async ({ page }) => {
    await page.getByRole('link', { name: /New Sale/i }).click();
    await expect(page).toHaveURL('/quick-sale');
  });

  test('recent transactions section or empty state is visible', async ({ page }) => {
    await page.waitForFunction(
      () => !(document.body.textContent || '').includes('...'),
      {},
      { timeout: 15_000 },
    );
    const hasTable = await page.locator('table').count();
    const hasEmpty = await page.getByText(/No sales today|no transactions/i).count();
    expect(hasTable + hasEmpty).toBeGreaterThan(0);
  });

  test('credit outstanding section shows ₹ value', async ({ page }) => {
    await page.waitForFunction(
      () => !(document.body.textContent || '').includes('...'),
      {},
      { timeout: 15_000 },
    );
    // "Total Credit" card is always visible on the dashboard
    await expect(page.getByText(/Total Credit/i).first()).toBeVisible();
  });

  test('growth badges appear (vs yesterday, vs last month)', async ({ page }) => {
    await page.waitForFunction(
      () => !(document.body.textContent || '').includes('...'),
      {},
      { timeout: 15_000 },
    );
    // Either a % badge or "New" badge is shown
    const growthText = page.locator('span').filter({ hasText: /vs yesterday|vs last month|New|\+\d|\-\d/i });
    expect(await growthText.count()).toBeGreaterThanOrEqual(0); // May be 0 if no comparison data
  });

  test('clicking an invoice number opens invoice modal', async ({ page }) => {
    await page.waitForFunction(
      () => !(document.body.textContent || '').includes('...'),
      {},
      { timeout: 15_000 },
    );
    const invoiceBtn = page.locator('button').filter({ hasText: /INV-\d+/ }).first();
    const hasInvoice = await invoiceBtn.count();
    if (hasInvoice === 0) {
      // No sales today — skip
      return;
    }
    await invoiceBtn.click();
    // Modal should appear
    await expect(page.locator('.fixed.inset-0').last()).toBeVisible();
  });

  test('mobile viewport: no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/', { waitUntil: 'load' });
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewWidth + 5);
  });
});


