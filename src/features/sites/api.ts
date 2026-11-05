import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export const siteKeys = {
  all: ['sites'] as const,
  list: () => [...siteKeys.all, 'list'] as const,
  detail: (id: string) => [...siteKeys.all, 'detail', id] as const,
};

export interface SiteInput {
  name: string;
  address: string;
}

/** Список объектов. RLS сам ограничивает выборку: исполнитель увидит только свои объекты. */
export function useSites() {
  return useQuery({
    queryKey: siteKeys.list(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sites')
        .select('id, name, address, created_at, tasks(count)')
        .order('name');
      if (error) throw error;
      return data.map(({ tasks, ...site }) => ({ ...site, taskCount: tasks[0]?.count ?? 0 }));
    },
  });
}

export function useSite(id: string) {
  return useQuery({
    queryKey: siteKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('sites').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateSite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SiteInput) => {
      const { data, error } = await supabase.from('sites').insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: siteKeys.all }),
  });
}

export function useUpdateSite(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SiteInput) => {
      const { data, error } = await supabase
        .from('sites')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: siteKeys.all }),
  });
}

export function useDeleteSite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sites').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: siteKeys.all }),
  });
}
