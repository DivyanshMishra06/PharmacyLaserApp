import { test, expect } from '@playwright/test';

const TEST_NAME = 'E2E Test Pharmacy';

test.describe('Profile — Persistence & Validation', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/profile', { waitUntil: 'load' });
  });

  // ── Structure ─────────────────────────────────────────────────────────────
  test('page heading is "Pharmacy Profile"', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Pharmacy Profile' })).toBeVisible();
  });

  test('"Edit" button is present in view mode', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
  });

  test('clicking Edit shows Save and Cancel buttons', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  });

  test('section labels are visible in view mode', async ({ page }) => {
    await expect(page.getByText('GST Number', { exact: false })).toBeVisible();
    await expect(page.getByText('Drug License', { exact: false }).first()).toBeVisible();
  });

  // ── Editing ────────────────────────────────────────────────────────────────
  test('can edit pharmacy name and save successfully', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit' }).click();
    const nameInput = page.locator('input[placeholder="Pharmacy Name"]');
    await nameInput.clear();
    await nameInput.fill(TEST_NAME);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(/Profile saved/i)).toBeVisible({ timeout: 5_000 });
  });

  test('saved pharmacy name persists after page reload', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit' }).click();
    const nameInput = page.locator('input[placeholder="Pharmacy Name"]');
    await nameInput.clear();
    await nameInput.fill(TEST_NAME);
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByText(/Profile saved/i).waitFor({ timeout: 5_000 });

    await page.reload({ waitUntil: 'load' });
    await expect(page.getByRole('heading', { name: TEST_NAME })).toBeVisible();
  });

  test('saved pharmacy name appears in sidebar', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit' }).click();
    const nameInput = page.locator('input[placeholder="Pharmacy Name"]');
    await nameInput.clear();
    await nameInput.fill(TEST_NAME);
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByText(/Profile saved/i).waitFor({ timeout: 5_000 });

    await page.goto('/', { waitUntil: 'load' });
    await expect(page.locator('aside p.font-bold')).toHaveText(TEST_NAME);
  });

  test('GST number can be edited, saved, and reloaded', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit' }).click();
    const gstInput = page.locator('input[placeholder="GST number"]');
    await gstInput.clear();
    await gstInput.fill('29AABCT1332L1ZD');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByText(/Profile saved/i).waitFor({ timeout: 5_000 });

    await page.reload({ waitUntil: 'load' });
    await expect(page.getByText(/29AABCT1332L1ZD/i)).toBeVisible();
  });

  test('Drug License 1 can be edited, saved, and reloaded', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit' }).click();
    const dl1Input = page.locator('input[placeholder="DL Number 1"]');
    await dl1Input.clear();
    await dl1Input.fill('DL-MH-2026-E2E');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByText(/Profile saved/i).waitFor({ timeout: 5_000 });

    await page.reload({ waitUntil: 'load' });
    await expect(page.getByText(/DL-MH-2026-E2E/i)).toBeVisible();
  });

  test('Cancel discards unsaved edits', async ({ page }) => {
    // First get current name
    const currentName = await page.locator('h2').filter({ hasText: /Pharmacy|E2E Test/i }).first().textContent();

    await page.getByRole('button', { name: 'Edit' }).click();
    const nameInput = page.locator('input[placeholder="Pharmacy Name"]');
    await nameInput.clear();
    await nameInput.fill('UNSAVED CHANGE XYZ');
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Name should revert to previous value
    await expect(page.getByText('UNSAVED CHANGE XYZ')).not.toBeVisible();
    if (currentName) await expect(page.getByRole('heading', { name: currentName.trim() })).toBeVisible();
  });

  test('empty pharmacy name shows validation error', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit' }).click();
    const nameInput = page.locator('input[placeholder="Pharmacy Name"]');
    await nameInput.clear();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(/Pharmacy name is required/i)).toBeVisible({ timeout: 5_000 });
  });

  test('profile save does NOT trigger any Supabase network requests', async ({ page }) => {
    const supabaseCalls: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('supabase.co/rest')) supabaseCalls.push(req.url());
    });

    await page.getByRole('button', { name: 'Edit' }).click();
    await page.locator('input[placeholder="Pharmacy Name"]').fill('LocalStorage Check');

    const callsBefore = supabaseCalls.length;
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(500);
    const callsAfter = supabaseCalls.length;

    // Profile is saved to localStorage — no Supabase calls on save
    expect(callsAfter - callsBefore).toBe(0);
  });

  test('profile data persists across navigation and return', async ({ page }) => {
    const uniqueName = `E2E Pharmacy ${Date.now()}`;
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.locator('input[placeholder="Pharmacy Name"]').fill(uniqueName);
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByText(/Profile saved/i).waitFor({ timeout: 5_000 });

    // Navigate to multiple pages then return
    await page.goto('/quick-sale', { waitUntil: 'load' });
    await page.goto('/reports', { waitUntil: 'load' });
    await page.goto('/profile', { waitUntil: 'load' });

    await expect(page.getByRole('heading', { name: uniqueName })).toBeVisible();
  });

  test.afterAll(async ({ browser }) => {
    // Restore a clean pharmacy name after tests
    const page = await browser.newPage();
    await page.goto('/profile', { waitUntil: 'load' });
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.locator('input[placeholder="Pharmacy Name"]').fill('Fahrenheit Pharmacy');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(500);
    await page.close();
  });
});


