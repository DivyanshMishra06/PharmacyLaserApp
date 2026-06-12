# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Vite dev server at http://127.0.0.1:5173
npm run build        # TypeScript check + Vite production build
npm run lint         # ESLint
npx tsc --noEmit     # Type check only (no emit)

# E2E tests — dev server starts automatically via webServer config
npx playwright test                                   # All tests (Desktop Chrome + Pixel 5)
npx playwright test e2e/04-sales-list.spec.ts         # Single spec file
npx playwright test --grep "search"                   # Tests matching a name
npx playwright test --project "Desktop Chrome"        # One browser only
npx playwright show-report                            # Open last HTML report

node generate-qa-report.js   # Generates qa-report.html from playwright-report/results.json
```

## Architecture

**Stack:** Vite + React 19 + TypeScript + Tailwind CSS SPA. Backend is Supabase (PostgreSQL + RLS). No server-side rendering.

**Database:** Single table `public.sales` (schema in `supabase/schema.sql`). One invoice = multiple rows sharing the same `invoice_number` — one row per medicine. The `invoice_number` column is intentionally **not** unique.

**Key computed fields:**
- `selling_rate = mrp × (1 − discount/100)` — stored per row for margin reporting
- `total_amount = qty × mrp × (1 − discount/100) × (1 − bill_discount/100)` — final charged amount

**Data layer:** `src/hooks/useSales.ts` is the only file that talks to Supabase. All pages go through this hook. The single `loading` boolean is shared across all fetches from one hook instance — `Reports.tsx` works around this by using a direct `supabase.from('sales')` query for its all-time fetch to avoid blocking the date-filtered fetch.

**Routing:** `src/App.tsx` → `<Layout>` wraps all pages via React Router v7. Pages live in `src/pages/`, shared UI in `src/components/`.

**Dual rendering pattern:** `SalesList.tsx` and `ImportData.tsx` render both mobile cards (`sm:hidden`) and a desktop table (`hidden sm:block`) from the same data. When writing Playwright locators, always scope to the `table` element (e.g. `page.locator('table button')`) to avoid strict-mode violations from hidden duplicates.

**Reports tabs:** `Reports.tsx` has 7 tabs (Sales Register, Revenue, Medicines, Expiry, Credit Ledger, Customers, Discounts). The Credit Ledger tab appends a numeric badge to its label when `creditCount > 0`, changing the accessible name from `"Credit Ledger"` to `"Credit Ledger 3"`. Always use `exact: false` when locating this button in Playwright.

**Import page (`ImportData.tsx`):** Accepts `.xlsx`, `.xls`, `.csv`. Uses `xlsx` library to parse. Column headers are matched flexibly via keyword substrings (e.g. "amount" matches "Amount (_)"). Payment modes are normalised from any case. Date parser handles `DD/MM/YYYY`, `DD-MM-YYYY`, `YYYY-MM-DD`, and Excel serial numbers.

**Profile:** Pharmacy name/address stored in `localStorage` via `src/hooks/usePharmacyProfile.ts` — no DB involvement.

## E2E Test Setup

Tests live in `e2e/`, numbered `01`–`08`. `global-setup.ts` deletes any leftover test rows by `customer_name LIKE 'E2E-%'` and `medicine_name LIKE 'E2E-%'` before the suite runs. `global-teardown.ts` repeats the same cleanup. Test constants (Supabase URL, anon key, E2E sentinel values) are in `e2e/constants.ts`.

Playwright config: `fullyParallel: false`, 2 workers, 1 retry, 60 s timeout. Projects: Desktop Chrome + Pixel 5 (Mobile Chrome). Dev server is auto-started and reused if already running.
