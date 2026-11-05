import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { TaskStatus } from '../../types/domain';
import { siteKeys } from '../sites/api';

export const taskKeys = {
  all: ['tasks'] as const,
  bySite: (siteId: string) => [...taskKeys.all, 'site', siteId] as const,
  mine: (userId: string) => [...taskKeys.all, 'mine', userId] as const,
  detail: (id: string) => [...taskKeys.all, 'detail', id] as const,
  history: (id: string) => [...taskKeys.all, 'history', id] as const,
  transitions: (id: string) => [...taskKeys.all, 'transitions', id] as const,
};

export interface TaskInput {
  title: string;
  description: string;
  site_id: string;
  assignee_id: string;
}

// У tasks две связи с profiles (исполнитель и автор), поэтому связь
// указывается явно через имя колонки: profiles!assignee_id.
const TASK_LIST_SELECT =
  'id, title, status, created_at, site_id, assignee:profiles!assignee_id(id, full_name)';

export function useSiteTasks(siteId: string) {
  return useQuery({
    queryKey: taskKeys.bySite(siteId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(TASK_LIST_SELECT)
        .eq('site_id', siteId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useMyTasks(userId: string) {
  return useQuery({
    queryKey: taskKeys.mine(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(`${TASK_LIST_SELECT}, site:sites(id, name)`)
        .eq('assignee_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(
          `*,
           site:sites(id, name, address),
           assignee:profiles!assignee_id(id, full_name, email),
           author:profiles!created_by(id, full_name)`,
        )
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useTaskHistory(taskId: string) {
  return useQuery({
    queryKey: taskKeys.history(taskId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_status_history')
        .select('*, actor:profiles!changed_by(id, full_name)')
        .eq('task_id', taskId)
        .order('changed_at')
        .order('id');
      if (error) throw error;
      return data;
    },
  });
}

/** Действия, которые база разрешает текущему пользователю для этой задачи. */
export function useAvailableTransitions(taskId: string) {
  return useQuery({
    queryKey: taskKeys.transitions(taskId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_available_transitions', {
        p_task_id: taskId,
      });
      if (error) throw error;
      return data;
    },
  });
}

export function useChangeTaskStatus(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ toStatus, comment }: { toStatus: TaskStatus; comment?: string }) => {
      const { data, error } = await supabase.rpc('change_task_status', {
        p_task_id: taskId,
        p_to_status: toStatus,
        p_comment: comment?.trim() || undefined,
      });
      if (error) throw error;
      return data;
    },
    // Даже при ошибке (например, задачу уже перевёл кто-то другой) перечитываем данные
    onSettled: () => queryClient.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

function useInvalidateTasksAndSites() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: taskKeys.all }),
      queryClient.invalidateQueries({ queryKey: siteKeys.all }),
    ]);
}

export function useCreateTask() {
  const invalidate = useInvalidateTasksAndSites();
  return useMutation({
    mutationFn: async (input: TaskInput) => {
      const { data, error } = await supabase.from('tasks').insert(input).select('id').single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateTask(id: string) {
  const invalidate = useInvalidateTasksAndSites();
  return useMutation({
    mutationFn: async (input: TaskInput) => {
      const { error } = await supabase.from('tasks').update(input).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteTask() {
  const invalidate = useInvalidateTasksAndSites();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/** Список исполнителей для назначения (доступен постановщику). */
export function useExecutors() {
  return useQuery({
    queryKey: ['profiles', 'executors'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'executor')
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });
}
