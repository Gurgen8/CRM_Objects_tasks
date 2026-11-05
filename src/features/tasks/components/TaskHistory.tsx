import { Blockquote, Group, Skeleton, Text, Timeline } from '@mantine/core';
import { IconArrowRight } from '@tabler/icons-react';
import { ErrorAlert } from '../../../components/ErrorAlert';
import { formatDateTime } from '../../../lib/format';
import { useTaskHistory } from '../api';
import { STATUS_COLOR } from '../status';
import { StatusBadge } from './StatusBadge';

export function TaskHistory({ taskId }: { taskId: string }) {
  const history = useTaskHistory(taskId);

  if (history.isPending) return <Skeleton h={120} />;
  if (history.isError) return <ErrorAlert error={history.error} />;
  if (history.data.length === 0) return <Text c="dimmed">История пуста</Text>;

  return (
    <Timeline active={history.data.length - 1} bulletSize={14} lineWidth={2}>
      {history.data.map((entry) => (
        <Timeline.Item
          key={entry.id}
          color={STATUS_COLOR[entry.to_status]}
          title={
            <Group gap={6} wrap="wrap">
              {entry.from_status ? (
                <>
                  <StatusBadge status={entry.from_status} size="sm" />
                  <IconArrowRight size={14} />
                </>
              ) : (
                <Text size="sm" fw={500}>
                  Задача создана:
                </Text>
              )}
              <StatusBadge status={entry.to_status} size="sm" />
            </Group>
          }
        >
          <Text size="xs" c="dimmed" mt={4}>
            {entry.actor?.full_name ?? 'Пользователь'} · {formatDateTime(entry.changed_at)}
          </Text>
          {entry.comment ? (
            <Blockquote
              color={STATUS_COLOR[entry.to_status]}
              p="xs"
              mt="xs"
              style={{ whiteSpace: 'pre-wrap' }}
            >
              <Text size="sm">{entry.comment}</Text>
            </Blockquote>
          ) : null}
        </Timeline.Item>
      ))}
    </Timeline>
  );
}
