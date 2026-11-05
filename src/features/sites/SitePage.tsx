import { Anchor, Breadcrumbs, Button, Card, Group, Skeleton, Stack, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconMapPin, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ErrorAlert } from '../../components/ErrorAlert';
import { NotFound } from '../../components/NotFound';
import { PageLoader } from '../../components/PageLoader';
import { getErrorMessage } from '../../lib/errors';
import { useAuth } from '../auth/useAuth';
import { useSiteTasks } from '../tasks/api';
import { TaskFormModal } from '../tasks/components/TaskFormModal';
import { TasksTable } from '../tasks/components/TasksTable';
import { sortByStatus } from '../tasks/status';
import { useDeleteSite, useSite } from './api';
import { SiteFormModal } from './components/SiteFormModal';

export function SitePage() {
  const { siteId = '' } = useParams();
  const { isManager } = useAuth();
  const navigate = useNavigate();
  const site = useSite(siteId);
  const tasks = useSiteTasks(siteId);
  const deleteSite = useDeleteSite();
  const [editOpened, edit] = useDisclosure(false);
  const [taskOpened, taskModal] = useDisclosure(false);

  if (site.isPending) return <PageLoader fullscreen={false} />;
  if (site.isError) return <ErrorAlert error={site.error} />;
  if (!site.data) return <NotFound title="Объект не найден" />;

  const s = site.data;
  const taskCount = tasks.data?.length ?? 0;

  const confirmDelete = () => {
    if (taskCount > 0) {
      notifications.show({
        color: 'yellow',
        title: 'Нельзя удалить объект',
        message: 'Сначала удалите задачи этого объекта.',
      });
      return;
    }
    modals.openConfirmModal({
      title: 'Удалить объект?',
      children: <Text size="sm">Объект «{s.name}» будет удалён.</Text>,
      labels: { confirm: 'Удалить', cancel: 'Отмена' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await deleteSite.mutateAsync(s.id);
          notifications.show({ color: 'green', message: 'Объект удалён' });
          navigate('/sites', { replace: true });
        } catch (e) {
          notifications.show({ color: 'red', title: 'Не удалось удалить', message: getErrorMessage(e) });
        }
      },
    });
  };

  return (
    <Stack gap="lg">
      <Breadcrumbs>
        <Anchor component={Link} to="/sites" size="sm">
          Объекты
        </Anchor>
        <Text size="sm" c="dimmed">
          {s.name}
        </Text>
      </Breadcrumbs>

      <Group justify="space-between" align="flex-start" wrap="wrap">
        <Stack gap={4}>
          <Title order={2}>{s.name}</Title>
          <Group gap={6} c="dimmed">
            <IconMapPin size={16} />
            <Text size="sm">{s.address}</Text>
          </Group>
        </Stack>
        {isManager ? (
          <Group gap="xs">
            <Button variant="default" leftSection={<IconPencil size={16} />} onClick={edit.open}>
              Редактировать
            </Button>
            <Button
              variant="subtle"
              color="red"
              leftSection={<IconTrash size={16} />}
              onClick={confirmDelete}
            >
              Удалить
            </Button>
          </Group>
        ) : null}
      </Group>

      <Card withBorder radius="md" p={0}>
        <Group justify="space-between" p="md">
          <Title order={4}>{isManager ? 'Задачи' : 'Мои задачи на объекте'}</Title>
          {isManager ? (
            <Button size="xs" leftSection={<IconPlus size={14} />} onClick={taskModal.open}>
              Новая задача
            </Button>
          ) : null}
        </Group>
        {tasks.isPending ? (
          <Skeleton h={120} />
        ) : tasks.isError ? (
          <ErrorAlert error={tasks.error} />
        ) : (
          <TasksTable tasks={sortByStatus(tasks.data)} showAssignee={isManager} />
        )}
      </Card>

      {isManager ? (
        <>
          <SiteFormModal opened={editOpened} onClose={edit.close} site={s} />
          <TaskFormModal
            opened={taskOpened}
            onClose={taskModal.close}
            defaultSiteId={s.id}
            onCreated={(id) => navigate(`/tasks/${id}`)}
          />
        </>
      ) : null}
    </Stack>
  );
}
