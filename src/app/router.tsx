import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { NotFound } from '../components/NotFound';
import { PageLoader } from '../components/PageLoader';
import { LoginPage } from '../features/auth/LoginPage';
import { RequireAuth, RequireRole } from '../features/auth/RequireAuth';
import { HomeRedirect } from './HomeRedirect';

// Страницы грузятся по требованию — экран входа открывается быстрее.
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    hydrateFallbackElement: <PageLoader />,
    children: [
      { index: true, element: <HomeRedirect /> },
      {
        path: 'sites',
        lazy: async () => ({ Component: (await import('../features/sites/SitesPage')).SitesPage }),
      },
      {
        path: 'sites/:siteId',
        lazy: async () => ({ Component: (await import('../features/sites/SitePage')).SitePage }),
      },
      {
        path: 'tasks/:taskId',
        lazy: async () => ({ Component: (await import('../features/tasks/TaskPage')).TaskPage }),
      },
      {
        path: 'my-tasks',
        lazy: async () => {
          const { MyTasksPage } = await import('../features/tasks/MyTasksPage');
          return {
            Component: () => (
              <RequireRole role="executor">
                <MyTasksPage />
              </RequireRole>
            ),
          };
        },
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
