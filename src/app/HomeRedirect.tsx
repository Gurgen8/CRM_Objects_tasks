import { Navigate } from 'react-router-dom';
import { useCurrentProfile } from '../features/auth/useAuth';

/** Стартовая страница зависит от роли. */
export function HomeRedirect() {
  const profile = useCurrentProfile();
  return <Navigate to={profile.role === 'executor' ? '/my-tasks' : '/sites'} replace />;
}
