import { createRoute } from '@vesper/shared';

export const GET = createRoute(async ({ user, requestId }) => ({
  ok: true,
  userId: user.id,
  requestId,
}));
