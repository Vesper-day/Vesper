import { z } from 'zod';

export const PrioritySchema = z.enum(['low', 'medium', 'high']);
export type Priority = z.infer<typeof PrioritySchema>;

export const TaskStatusSchema = z.enum(['pending', 'in_progress', 'completed']);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().min(1),
  estimatedMinutes: z.number().int().positive(),
  deadline: z.string().datetime().nullable(),
  priority: PrioritySchema,
  status: TaskStatusSchema,
  completedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Task = z.infer<typeof TaskSchema>;

export const CreateTaskSchema = TaskSchema.pick({
  title: true,
  estimatedMinutes: true,
  priority: true,
}).extend({
  deadline: z.string().datetime().optional(),
});
export type CreateTask = z.infer<typeof CreateTaskSchema>;
