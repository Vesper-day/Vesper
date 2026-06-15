// Daily-plan context assembler (Chat 021).
//
// ASSEMBLES ONLY. This module builds the four-layer AI-SDK message array and
// returns it. It MUST NOT submit anything to Anthropic: no generateText /
// generateObject / streamText / client call, no ANTHROPIC_API_KEY use. The caller
// (chat 022 synthesizePlan) submits the array.
//
// Four-layer cache layout (TECHNICAL_SPEC.md §5; 3 cache breakpoints total):
//   Layer 1 = SYSTEM message    -> cache_control ephemeral  (CACHED)
//   Layer 2 = USER message part -> cache_control ephemeral  (CACHED)
//   Layer 3 = USER message part -> cache_control ephemeral  (CACHED)
//   Layer 4 = USER message part -> NO cache_control         (UNCACHED, per-day)
//
// The cache_control syntax is reused verbatim from cacheConfig.ts
// (getProviderOptions) — not re-invented here. The result is a 2-message array:
// one system message + one user message carrying three text parts.

import type { CoreMessage } from 'ai';
import type { Database } from '@vesper/db';

import { getProviderOptions } from '../cacheConfig';
import {
  DAILY_PLAN_SYNTHESIS_PROMPT,
  DAILY_PLAN_SYNTHESIS_VERSION,
} from '../prompts/dailyPlanSynthesis';
import { buildUserContext } from './userContext';
import { buildTemplateSubset } from './templateSubset';

/** Per-day calendar event (volatile Layer-4 input). */
export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
}

/** Per-day pending task (volatile Layer-4 input). */
export interface PendingTask {
  id: string;
  title: string;
  estimatedMinutes: number;
  priority: string;
  deadline: string | null;
}

/** The assembled, ready-to-submit message array. */
export type PlanContext = CoreMessage[];

/**
 * Assemble the four-layer daily-plan context for a user/day.
 *
 * @param db Optional Drizzle client (injected in tests); forwarded to buildUserContext.
 */
export async function buildPlanContext(
  userId: string,
  planDate: string,
  energyScore: number | null,
  calendarEvents: CalendarEvent[],
  pendingTasks: PendingTask[],
  db?: Database,
): Promise<PlanContext> {
  const userContext = await buildUserContext(userId, db);
  const templateSubset = await buildTemplateSubset(userContext.modulesEnabled);

  // Reused, not re-invented: { anthropic: { cacheControl: { type: 'ephemeral' } } }.
  const cache = getProviderOptions('daily-plan');

  // Layer 1 — the live v4 system prompt (chat 112). Equals the constant exactly;
  // the version travels in Layer 4 so this stays byte-identical to the constant.
  const systemMessage: CoreMessage = {
    role: 'system',
    content: DAILY_PLAN_SYNTHESIS_PROMPT,
    providerOptions: cache,
  };

  // Layer 2 — static-ish user context. Layer 3 — template subset. Both cached.
  const layer2 = `USER CONTEXT\n${JSON.stringify(userContext, null, 2)}`;
  const layer3 = `TEMPLATE LIBRARY SUBSET\n${JSON.stringify(templateSubset, null, 2)}`;

  // Layer 4 — volatile per-day inputs. NOT cached. promptVersion rides here so a
  // prompt bump is observable without disturbing the cached Layer 1 bytes.
  const layer4 = `TODAY\n${JSON.stringify(
    {
      planDate,
      energyScore,
      calendarEvents,
      pendingTasks,
      promptVersion: DAILY_PLAN_SYNTHESIS_VERSION,
    },
    null,
    2,
  )}`;

  const userMessage: CoreMessage = {
    role: 'user',
    content: [
      { type: 'text', text: layer2, providerOptions: cache },
      { type: 'text', text: layer3, providerOptions: cache },
      { type: 'text', text: layer4 },
    ],
  };

  return [systemMessage, userMessage];
}
