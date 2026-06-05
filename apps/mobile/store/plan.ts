import { create } from 'zustand';

/**
 * Plan slice — STUB shape only. Mirrors apps/web/store/plan.ts so plan
 * consumers compile against a stable hook today; concrete plan-editing state
 * lands in Chat 039. Not persisted (ARCHITECTURE_DECISIONS Decision 05 — plan
 * state is always refetched on mount). MUST NOT import @vesper/db.
 */
interface PlanState {
  currentPlanDate: string | null;
  isStreamingPlan: boolean;
  optimisticBlockUpdates: Record<string, unknown>;

  setCurrentPlanDate: (date: string | null) => void;
  setIsStreamingPlan: (streaming: boolean) => void;
  setOptimisticBlockUpdate: (blockId: string, update: unknown) => void;
  clearOptimisticBlockUpdates: () => void;
}

export const usePlanStore = create<PlanState>((set) => ({
  currentPlanDate: null,
  isStreamingPlan: false,
  optimisticBlockUpdates: {},

  setCurrentPlanDate: (date) => set({ currentPlanDate: date }),
  setIsStreamingPlan: (streaming) => set({ isStreamingPlan: streaming }),
  setOptimisticBlockUpdate: (blockId, update) =>
    set((state) => ({
      optimisticBlockUpdates: {
        ...state.optimisticBlockUpdates,
        [blockId]: update,
      },
    })),
  clearOptimisticBlockUpdates: () => set({ optimisticBlockUpdates: {} }),
}));
