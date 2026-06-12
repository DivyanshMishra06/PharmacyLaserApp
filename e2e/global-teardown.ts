import { SUPABASE_URL, SUPABASE_ANON_KEY, E2E_CUSTOMER } from './constants';

async function globalTeardown() {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  };

  await fetch(
    `${SUPABASE_URL}/rest/v1/sales?customer_name=like.${encodeURIComponent(E2E_CUSTOMER + '%')}`,
    { method: 'DELETE', headers },
  );
  await fetch(
    `${SUPABASE_URL}/rest/v1/sales?medicine_name=like.E2E-%25`,
    { method: 'DELETE', headers },
  );

  console.log('[global-teardown] E2E test data purged.');
}

export default globalTeardown;
