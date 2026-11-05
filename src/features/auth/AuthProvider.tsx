import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import { AuthContext } from './useAuth';
import type { AuthContextValue } from './useAuth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    // В колбэке только обновляем состояние: асинхронные вызовы supabase
    // внутри onAuthStateChange могут заблокировать клиент.
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;

  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    enabled: Boolean(userId),
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // Данные прошлого пользователя не должны остаться в кэше
    queryClient.clear();
  }, [queryClient]);

  const profile = profileQuery.data ?? null;

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      isProfileLoading: Boolean(userId) && profileQuery.isPending,
      profileError: profileQuery.error,
      isManager: profile?.role === 'manager',
      signIn,
      signOut,
    }),
    [session, profile, userId, profileQuery.isPending, profileQuery.error, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
