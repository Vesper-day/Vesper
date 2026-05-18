export type PlanContext = {
  userId: string;
  archetype: string;
  timezone: string;
  locationLat: number | null;
  locationLng: number | null;
  baseProfile: unknown;
  baseProfileVersion: number;
  modulesEnabled: unknown;
  regenerationCount: number;
  pendingTasks: Array<{
    id: string;
    title: string;
    estimatedMinutes: number;
    priority: string;
    deadline: string | null;
  }>;
  calendarEvents: Array<{
    id: string;
    title: string;
    startTime: string;
    endTime: string;
  }>;
  workoutTemplates: unknown[];
  recipeTemplates: unknown[];
  energyScore: number | null;
  planDate: string;
};

export async function buildPlanContext(userId: string): Promise<PlanContext> {
  throw new Error(`buildPlanContext not yet implemented for user ${userId}`);
}
