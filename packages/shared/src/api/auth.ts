import { createClient } from '@supabase/supabase-js';
import { createDrizzleClient } from '@vesper/db';
import { ApiError, ErrorCode } from '../errors';

/**
 * Authenticated user, sourced from the `public.users` row (§3 table 1) and
 * surfaced by §9 GET /profile. `subscriptionStatus` is read from the
 * denormalized cache column — no extra subscriptions query.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  subscriptionStatus:
    | 'trial'
    | 'active'
    | 'past_due'
    | 'read_only'
    | 'archived'
    | 'deletion_scheduled';
  timezone: string;
  tier: 'standard' | 'optimizer';
}

/**
 * Validate a stateless Bearer access token and load the user record.
 *
 * Stateless on purpose: the Authorization header carries a Supabase access
 * token (no cookies), so we use the public anon-key client + `auth.getUser(token)`
 * — NOT @supabase/ssr (that is the web cookie path). Throws {@link ApiError}
 * (UNAUTHORIZED) on any failure.
 */
export async function validateSession(request: Request): Promise<AuthenticatedUser> {
  const header = request.headers.get('Authorization');
  if (!header || !header.startsWith('Bearer ')) {
    throw new ApiError(
      ErrorCode.UNAUTHORIZED,
      'Missing or malformed Authorization header',
    );
  }
  const accessToken = header.slice('Bearer '.length).trim();
  if (!accessToken) {
    throw new ApiError(
      ErrorCode.UNAUTHORIZED,
      'Missing or malformed Authorization header',
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  );
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data?.user) {
    throw new ApiError(ErrorCode.UNAUTHORIZED, 'Invalid or expired token');
  }
  const authUser = data.user;

  const db = createDrizzleClient();
  const row = await db.query.users.findFirst({
    columns: {
      id: true,
      email: true,
      subscriptionStatus: true,
      timezone: true,
      tier: true,
    },
    where: (users, { eq }) => eq(users.id, authUser.id),
  });
  if (!row) {
    throw new ApiError(ErrorCode.UNAUTHORIZED, 'User record not found');
  }

  return {
    id: row.id,
    email: row.email,
    subscriptionStatus: row.subscriptionStatus,
    timezone: row.timezone,
    tier: row.tier,
  };
}
