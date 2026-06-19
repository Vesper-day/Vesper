-- Down for migration 23 — auth-event trigger.
-- Drops the trigger + function. Extensions (pg_net, supabase_vault) are left in
-- place: they are shared infrastructure that other features may rely on, and
-- dropping them could break unrelated objects. Vault secrets are operational data,
-- not migration-owned, so they are not touched here.

BEGIN;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
DROP FUNCTION IF EXISTS public.handle_auth_user_event();

COMMIT;
