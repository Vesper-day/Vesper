// Verification helper for chat 063 — inspects the integrations table and its
// audit trail after a live connect/disconnect cycle, WITHOUT needing psql
// installed (Windows-friendly). Uses postgres-js directly.
//
// Run (local Supabase): pnpm --filter @vesper/db exec tsx scripts/inspect-integrations.ts
// Defaults to the local Supabase direct URL; override with SUPABASE_DIRECT_URL.
//
// Expected after a Connect:  one integrations row, status='connected',
//   ct_len > 40 (24-byte nonce + 16-byte tag + token), and one INSERT audit row.
// Expected after Disconnect: zero integrations rows, plus a DELETE audit row.
import postgres from 'postgres';

const url =
  process.env.SUPABASE_DIRECT_URL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

async function main(): Promise<void> {
  const sql = postgres(url, { prepare: false });
  try {
    const rows = await sql`
      SELECT user_id, provider, status,
             octet_length(access_token_encrypted) AS ct_len,
             refresh_token_encrypted IS NOT NULL  AS has_refresh,
             expires_at, last_error
      FROM integrations
      ORDER BY created_at
    `;
    console.log('\n=== integrations ===');
    console.table(rows);

    const audit = await sql`
      SELECT operation, row_id, changed_at
      FROM security_audit_log
      WHERE table_name = 'integrations'
      ORDER BY changed_at
    `;
    console.log('\n=== security_audit_log (integrations) ===');
    console.table(audit);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
