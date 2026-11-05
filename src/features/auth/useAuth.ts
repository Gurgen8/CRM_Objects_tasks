import type { Session } from '@supabase/supabase-js';
import { createContext, useContext } from 'react';
import type { Profile } from '../../types/domain';

export interface AuthContextValue {
  /** undefined — сессия ещё загружается, null — пользователь не вошёл */
  session: Session | null | undefined;
  profile: Profile | null;
  isProfileLoading: boolean;
  profileError: unknown;
  isManager: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Профиль текущего пользователя; использовать только внутри RequireAuth. */
export function useCurrentProfile(): Profile {
  const { profile } = useAuth();
  if (!profile) throw new Error('useCurrentProfile used outside of RequireAuth');
  return profile;
}
