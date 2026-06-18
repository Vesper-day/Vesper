// effective_status (TECHNICAL_SPEC §9) — computed at serializer time, NOT stored
// (TECHNICAL_SPEC line 2551). A 'scheduled' block whose `now` falls in
// [startTime, endTime) renders as 'in_progress'; every other case returns the
// stored status verbatim.
//
// Extracted here in chat 027 so both the plan-retrieval serializer
// (app/api/v1/plans/operations.ts) and the block-mutation serializer
// (app/api/v1/blocks/operations.ts) share one implementation.
//
// Guards (deliberately do NOT trust the synthesis invariant): user-added blocks
// may legitimately omit times, so startTime/endTime are treated as nullable and
// the end > start ordering is re-checked. The `now` parameter is injectable for
// deterministic tests. Blocks never cross local midnight (synthesis splits
// spanning intervals at the day boundary), so no wraparound handling is needed.

export function computeEffectiveStatus(
  status: string,
  startTime: Date | null,
  endTime: Date | null,
  now: Date = new Date(),
): string {
  if (
    status === 'scheduled' &&
    startTime !== null &&
    endTime !== null &&
    endTime.getTime() > startTime.getTime() &&
    now.getTime() >= startTime.getTime() &&
    now.getTime() < endTime.getTime()
  ) {
    return 'in_progress';
  }
  return status;
}
