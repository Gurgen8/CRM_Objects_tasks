import { Card, SegmentedControl, Skeleton, Stack, Title } from '@mantine/core';
import { useState } from 'react';
import { ErrorAlert } from '../../components/ErrorAlert';
import { useCurrentProfile } from '../auth/useAuth';
import { useMyTasks } from './api';
import { TasksTable } from './components/TasksTable';
import { sortByStatus } from './status';

type Filter = 'active' | 'all';

export function MyTasksPage() {
  const profile = useCurrentProfile();
  const tasks = useMyTasks(profile.id);
  const [filter, setFilter] = useState<Filter>('active');

  const visible = sortByStatus(
    (tasks.data ?? []).filter((t) => filter === 'all' || t.status !== 'accepted'),
  );

  return (
    <Stack gap="lg">
      <Title order={2}>Мои задачи</Title>
      <SegmentedControl
        w="fit-content"
        value={filter}
        onChange={(v) => setFilter(v as Filter)}
        data={[
          { value: 'active', label: 'Активные' },
          { value: 'all', label: 'Все' },
        ]}
      />
      <Card withBorder radius="md" p={0}>
        {tasks.isPending ? (
          <Skeleton h={160} />
        ) : tasks.isError ? (
          <ErrorAlert error={tasks.error} />
        ) : (
          <TasksTable
            tasks={visible}
            showSite
            showAssignee={false}
            emptyText={filter === 'active' ? 'Активных задач нет' : 'Задач пока нет'}
          />
        )}
      </Card>
    </Stack>
  );
}
