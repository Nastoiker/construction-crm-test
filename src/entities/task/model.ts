import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { supabase } from '@/shared/api/client';

export const statusSchema = z.enum([
  'new',
  'in_progress',
  'review',
  'accepted',
  'rework',
]);
export type TaskStatus = z.infer<typeof statusSchema>;
export const statusLabels: Record<TaskStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  review: 'На проверке',
  accepted: 'Принята',
  rework: 'На доработке',
};
export const taskSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string(),
  object_id: z.uuid(),
  assignee_id: z.uuid(),
  author_id: z.uuid(),
  status: statusSchema,
  created_at: z.string(),
  version: z.number(),
});
export type Task = z.infer<typeof taskSchema>;
const historySchema = z.object({
  id: z.uuid(),
  task_id: z.uuid(),
  actor_id: z.uuid(),
  from_status: statusSchema.nullable(),
  to_status: statusSchema,
  comment: z.string().nullable(),
  created_at: z.string(),
});

export function availableTransitions(
  task: Task,
  role: 'manager' | 'executor',
  userId: string,
): TaskStatus[] {
  if (role === 'manager')
    return task.status === 'review' ? ['accepted', 'rework'] : [];
  if (task.assignee_id !== userId) return [];
  if (task.status === 'new' || task.status === 'rework') return ['in_progress'];
  return task.status === 'in_progress' ? ['review'] : [];
}
export function useTasks(userId: string, objectId?: string) {
  return useQuery({
    queryKey: ['tasks', userId, { objectId }],
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });
      if (objectId) query = query.eq('object_id', objectId);
      const { data, error } = await query;
      if (error) throw error;
      return z.array(taskSchema).parse(data);
    },
  });
}
export function useTask(id: string, userId: string) {
  return useQuery({
    queryKey: ['tasks', userId, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data ? taskSchema.parse(data) : null;
    },
  });
}
export function useTaskHistory(id: string, userId: string) {
  return useQuery({
    queryKey: ['history', userId, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_history')
        .select('*')
        .eq('task_id', id)
        .order('created_at');
      if (error) throw error;
      return z.array(historySchema).parse(data);
    },
  });
}
