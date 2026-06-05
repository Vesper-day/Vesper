import { create } from 'zustand';

/**
 * Plan slice — STUB shape only. The concrete plan-editing state lands in
 * Chat 039; this exists so providers/consumers can compile against a stable
 * hook today. Not persisted (Decision 05). MUST NOT import @vesper/db.
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
