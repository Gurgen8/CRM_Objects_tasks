import { Button, Center, Stack } from '@mantine/core';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ErrorAlert } from '../../components/ErrorAlert';
import { PageLoader } from '../../components/PageLoader';
import type { UserRole } from '../../types/domain';
import { useAuth } from './useAuth';

/** Пускает только вошедших пользователей с загруженным профилем. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, profile, isProfileLoading, profileError, signOut } = useAuth();
  const location = useLocation();

  if (session === undefined || isProfileLoading) return <PageLoader />;
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />;

  if (!profile) {
    return (
      <Center h="100vh" p="md">
        <Stack maw={420}>
          <ErrorAlert error={profileError ?? new Error('Профиль пользователя не найден')} />
          <Button variant="default" onClick={signOut}>
            Выйти
          </Button>
        </Stack>
      </Center>
    );
  }

  return children;
}

/**
 * Скрывает страницу от неподходящей роли. Это только удобство интерфейса —
 * реальная защита данных на стороне БД (RLS).
 */
export function RequireRole({ role, children }: { role: UserRole; children: ReactNode }) {
  const { profile } = useAuth();
  if (profile?.role !== role) return <Navigate to="/" replace />;
  return children;
}
