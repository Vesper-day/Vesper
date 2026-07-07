import type React from 'react';
import type { PlanResponse } from '@/app/api/v1/plans/operations';
import { BlockCard } from './BlockCard';
import { blockSortComparator } from './planViewHelpers';

/**
 * Vertical block timeline for the day view (build chat 039). Renders the §9
 * PlanResponse blocks as a single ordered column of BlockCards — startTime
 * ascending with displayOrder as the tiebreaker (blockSortComparator). The API
 * already orders by display_order; re-sorting here makes the render order
 * independent of that and matches the documented §9 render contract.
 *
 * Renders against PlanResponse ONLY (never DailyPlanSchema). Read-only: no
 * expansion, no actions, no drag-reorder.
 */
export function BlockTimeline({
  plan,
}: {
  plan: PlanResponse['plan'];
}): React.JSX.Element {
  const blocks = [...plan.blocks].sort(blockSortComparator);

  return (
    <ol className="flex flex-col gap-3">
      {blocks.map((block) => (
        <li key={block.id}>
          <BlockCard block={block} />
        </li>
      ))}
    </ol>
  );
}
