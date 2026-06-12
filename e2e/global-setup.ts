import { SUPABASE_URL, SUPABASE_ANON_KEY, E2E_CUSTOMER } from './constants';

// Purge any leftover E2E records before the suite begins
async function globalSetup() {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  };

  // Delete by customer_name prefix
  await fetch(
    `${SUPABASE_URL}/rest/v1/sales?customer_name=like.${encodeURIComponent(E2E_CUSTOMER + '%')}`,
    { method: 'DELETE', headers },
  );

  // Also delete by medicine name prefix (in case customer was blank)
  await fetch(
    `${SUPABASE_URL}/rest/v1/sales?medicine_name=like.E2E-%25`,
    { method: 'DELETE', headers },
  );

  console.log('[global-setup] E2E test data cleaned up.');
}

export default globalSetup;
