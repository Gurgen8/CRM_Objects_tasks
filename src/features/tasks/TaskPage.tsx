import {
  Anchor,
  Breadcrumbs,
  Button,
  Card,
  Grid,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconPencil, IconTrash } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ErrorAlert } from '../../components/ErrorAlert';
import { NotFound } from '../../components/NotFound';
import { PageLoader } from '../../components/PageLoader';
import { getErrorMessage } from '../../lib/errors';
import { formatDateTime } from '../../lib/format';
import { useAuth } from '../auth/useAuth';
import { useDeleteTask, useTask } from './api';
import { StatusBadge } from './components/StatusBadge';
import { TaskActions } from './components/TaskActions';
import { TaskFormModal } from './components/TaskFormModal';
import { TaskHistory } from './components/TaskHistory';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text component="div" size="sm" mt={2}>
        {children}
      </Text>
    </div>
  );
}

export function TaskPage() {
  const { taskId = '' } = useParams();
  const { isManager } = useAuth();
  const navigate = useNavigate();
  const task = useTask(taskId);
  const deleteTask = useDeleteTask();
  const [editOpened, edit] = useDisclosure(false);

  if (task.isPending) return <PageLoader fullscreen={false} />;
  if (task.isError) return <ErrorAlert error={task.error} />;
  if (!task.data) return <NotFound title="Задача не найдена" />;

  const t = task.data;

  const confirmDelete = () =>
    modals.openConfirmModal({
      title: 'Удалить задачу?',
      children: (
        <Text size="sm">
          Задача «{t.title}» и её история будут удалены без возможности восстановления.
        </Text>
      ),
      labels: { confirm: 'Удалить', cancel: 'Отмена' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await deleteTask.mutateAsync(t.id);
          notifications.show({ color: 'green', message: 'Задача удалена' });
          navigate(t.site ? `/sites/${t.site.id}` : '/sites', { replace: true });
        } catch (e) {
          notifications.show({ color: 'red', title: 'Не удалось удалить', message: getErrorMessage(e) });
        }
      },
    });

  return (
    <Stack gap="lg">
      <Breadcrumbs>
        <Anchor component={Link} to="/sites" size="sm">
          Объекты
        </Anchor>
        {t.site ? (
          <Anchor component={Link} to={`/sites/${t.site.id}`} size="sm">
            {t.site.name}
          </Anchor>
        ) : null}
        <Text size="sm" c="dimmed">
          Задача
        </Text>
      </Breadcrumbs>

      <Group justify="space-between" align="flex-start" wrap="wrap">
        <Stack gap={6}>
          <Title order={2}>{t.title}</Title>
          <StatusBadge status={t.status} size="lg" />
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

      <TaskActions taskId={t.id} />

      <Grid gap="lg">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Card withBorder radius="md" p="lg">
            <Stack>
              <SimpleGrid cols={{ base: 1, xs: 2 }}>
                <Field label="Объект">
                  {t.site ? (
                    <Anchor component={Link} to={`/sites/${t.site.id}`}>
                      {t.site.name}
                    </Anchor>
                  ) : (
                    '—'
                  )}
                  {t.site ? (
                    <Text size="xs" c="dimmed">
                      {t.site.address}
                    </Text>
                  ) : null}
                </Field>
                <Field label="Исполнитель">{t.assignee?.full_name ?? '—'}</Field>
                <Field label="Автор">{t.author?.full_name ?? '—'}</Field>
                <Field label="Создана">{formatDateTime(t.created_at)}</Field>
              </SimpleGrid>
              <Field label="Описание">
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }} c={t.description ? undefined : 'dimmed'}>
                  {t.description || 'Без описания'}
                </Text>
              </Field>
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Card withBorder radius="md" p="lg">
            <Title order={4} mb="md">
              История
            </Title>
            <TaskHistory taskId={t.id} />
          </Card>
        </Grid.Col>
      </Grid>

      {isManager ? (
        <TaskFormModal
          opened={editOpened}
          onClose={edit.close}
          task={{
            id: t.id,
            title: t.title,
            description: t.description,
            site_id: t.site_id,
            assignee_id: t.assignee_id,
          }}
        />
      ) : null}
    </Stack>
  );
}
