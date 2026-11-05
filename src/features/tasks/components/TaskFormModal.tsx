import { Button, Group, Modal, Select, Stack, Textarea, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { getErrorMessage } from '../../../lib/errors';
import { useSites } from '../../sites/api';
import { useCreateTask, useExecutors, useUpdateTask } from '../api';
import type { TaskInput } from '../api';

interface Props {
  opened: boolean;
  onClose: () => void;
  /** Если передан — режим редактирования */
  task?: TaskInput & { id: string };
  /** Объект по умолчанию при создании из карточки объекта */
  defaultSiteId?: string;
  onCreated?: (id: string) => void;
}

export function TaskFormModal({ opened, onClose, task, ...rest }: Props) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={task ? 'Редактировать задачу' : 'Новая задача'}
      size="lg"
    >
      {/* Форма монтируется заново при каждом открытии и берёт актуальные значения */}
      {opened ? <TaskForm task={task} onClose={onClose} {...rest} /> : null}
    </Modal>
  );
}

function TaskForm({ onClose, task, defaultSiteId, onCreated }: Omit<Props, 'opened'>) {
  const executors = useExecutors();
  const sites = useSites();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask(task?.id ?? '');
  const isPending = createTask.isPending || updateTask.isPending;

  const form = useForm<TaskInput>({
    initialValues: {
      title: task?.title ?? '',
      description: task?.description ?? '',
      site_id: task?.site_id ?? defaultSiteId ?? '',
      assignee_id: task?.assignee_id ?? '',
    },
    validate: {
      title: (v) => {
        const t = v.trim();
        if (!t) return 'Укажите название';
        return t.length > 200 ? 'Не длиннее 200 символов' : null;
      },
      description: (v) => (v.length > 5000 ? 'Не длиннее 5000 символов' : null),
      site_id: (v) => (v ? null : 'Выберите объект'),
      assignee_id: (v) => (v ? null : 'Выберите исполнителя'),
    },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    const input: TaskInput = {
      ...values,
      title: values.title.trim(),
      description: values.description.trim(),
    };
    try {
      if (task) {
        await updateTask.mutateAsync(input);
        notifications.show({ color: 'green', message: 'Задача сохранена' });
        onClose();
      } else {
        const created = await createTask.mutateAsync(input);
        notifications.show({ color: 'green', message: 'Задача создана' });
        onClose();
        onCreated?.(created.id);
      }
    } catch (e) {
      notifications.show({ color: 'red', title: 'Не удалось сохранить', message: getErrorMessage(e) });
    }
  });

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack>
        <TextInput label="Название" required data-autofocus {...form.getInputProps('title')} />
        <Textarea
          label="Описание"
          autosize
          minRows={3}
          maxRows={10}
          {...form.getInputProps('description')}
        />
        <Select
          label="Объект"
          required
          searchable
          nothingFoundMessage="Не найдено"
          data={(sites.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
          disabled={sites.isPending}
          {...form.getInputProps('site_id')}
        />
        <Select
          label="Исполнитель"
          required
          searchable
          nothingFoundMessage="Не найдено"
          data={(executors.data ?? []).map((p) => ({ value: p.id, label: p.full_name }))}
          disabled={executors.isPending}
          {...form.getInputProps('assignee_id')}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" loading={isPending}>
            {task ? 'Сохранить' : 'Создать'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
