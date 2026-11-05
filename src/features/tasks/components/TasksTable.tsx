import { Anchor, Table, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { formatDate } from '../../../lib/format';
import type { TaskStatus } from '../../../types/domain';
import { StatusBadge } from './StatusBadge';

export interface TaskRow {
  id: string;
  title: string;
  status: TaskStatus;
  created_at: string;
  assignee: { id: string; full_name: string } | null;
  site?: { id: string; name: string } | null;
}

interface Props {
  tasks: TaskRow[];
  showSite?: boolean;
  showAssignee?: boolean;
  emptyText?: string;
}

export function TasksTable({ tasks, showSite, showAssignee = true, emptyText = 'Задач нет' }: Props) {
  if (tasks.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="lg">
        {emptyText}
      </Text>
    );
  }

  return (
    <Table.ScrollContainer minWidth={560}>
      <Table highlightOnHover verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Задача</Table.Th>
            {showSite ? <Table.Th>Объект</Table.Th> : null}
            {showAssignee ? <Table.Th>Исполнитель</Table.Th> : null}
            <Table.Th>Статус</Table.Th>
            <Table.Th>Создана</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {tasks.map((task) => (
            <Table.Tr key={task.id}>
              <Table.Td>
                <Anchor component={Link} to={`/tasks/${task.id}`} fw={500}>
                  {task.title}
                </Anchor>
              </Table.Td>
              {showSite ? (
                <Table.Td>
                  {task.site ? (
                    <Anchor component={Link} to={`/sites/${task.site.id}`} c="dimmed" size="sm">
                      {task.site.name}
                    </Anchor>
                  ) : null}
                </Table.Td>
              ) : null}
              {showAssignee ? <Table.Td>{task.assignee?.full_name ?? '—'}</Table.Td> : null}
              <Table.Td>
                <StatusBadge status={task.status} />
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="dimmed">
                  {formatDate(task.created_at)}
                </Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
