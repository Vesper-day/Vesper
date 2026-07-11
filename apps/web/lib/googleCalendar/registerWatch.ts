// registerWatch — thin re-export (Chat 066).
//
// Chat 065 authored the implementation here. Chat 066 re-homed it to @vesper/ai so the
// daily-cron renewal worker can import it worker-safely (a Cloudflare Worker cannot
// cleanly import a Next app's internal lib/). The single implementation now lives at
// packages/ai/src/integrations/registerWatch.ts; this file preserves 065's landed
// import path (apps/web/lib/googleCalendar/registerWatch) and its co-located test.
//
// IMPORTANT: re-export from the @vesper/ai SUBPATH, not the barrel. The barrel's
// client.ts constructs an Anthropic SDK client at import, which throws in apps/web's
// jsdom test environment ("browser-like environment"). The subpath loads only the
// registerWatch module (its deps are @vesper/db + a dynamic @vesper/db/encryption).
export { registerWatch } from '@vesper/ai/integrations/registerWatch';
export type { WatchChannel, RegisterWatchOptions } from '@vesper/ai/integrations/registerWatch';
