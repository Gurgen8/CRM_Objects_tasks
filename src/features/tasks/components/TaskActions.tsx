import { Button, Group, Modal, Skeleton, Stack, Text, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { getErrorMessage } from '../../../lib/errors';
import type { AvailableTransition } from '../../../types/domain';
import { useAvailableTransitions, useChangeTaskStatus } from '../api';
import { ACTION_COLOR, ACTION_LABEL, STATUS_LABEL } from '../status';

const COMMENT_MAX = 2000;

/**
 * Кнопки смены статуса. Список действий приходит из БД, поэтому интерфейс
 * не может показать то, что база всё равно не разрешит.
 */
export function TaskActions({ taskId }: { taskId: string }) {
  const transitions = useAvailableTransitions(taskId);
  const changeStatus = useChangeTaskStatus(taskId);
  const [selected, setSelected] = useState<AvailableTransition | null>(null);
  const [comment, setComment] = useState('');
  const [touched, setTouched] = useState(false);

  if (transitions.isPending) return <Skeleton h={36} w={220} />;
  if (transitions.isError || transitions.data.length === 0) return null;

  const open = (t: AvailableTransition) => {
    setSelected(t);
    setComment('');
    setTouched(false);
  };
  const close = () => setSelected(null);

  const commentError = (() => {
    if (!selected || !touched) return null;
    if (selected.requires_comment && !comment.trim()) return 'Опишите, что нужно доработать';
    if (comment.length > COMMENT_MAX) return `Не длиннее ${COMMENT_MAX} символов`;
    return null;
  })();

  const submit = async () => {
    if (!selected) return;
    setTouched(true);
    if ((selected.requires_comment && !comment.trim()) || comment.length > COMMENT_MAX) return;
    try {
      await changeStatus.mutateAsync({ toStatus: selected.to_status, comment });
      notifications.show({
        color: 'green',
        message: `Статус изменён: ${STATUS_LABEL[selected.to_status]}`,
      });
      close();
    } catch (e) {
      notifications.show({ color: 'red', title: 'Не удалось', message: getErrorMessage(e) });
      close();
    }
  };

  return (
    <>
      <Group gap="sm">
        {transitions.data.map((t) => (
          <Button
            key={t.to_status}
            color={ACTION_COLOR[t.to_status]}
            variant={t.to_status === 'rework' ? 'light' : 'filled'}
            onClick={() => open(t)}
          >
            {ACTION_LABEL[t.to_status]}
          </Button>
        ))}
      </Group>

      <Modal
        opened={selected !== null}
        onClose={close}
        title={selected ? ACTION_LABEL[selected.to_status] : ''}
      >
        {selected ? (
          <Stack>
            <Text size="sm">
              Новый статус задачи: <b>{STATUS_LABEL[selected.to_status]}</b>
            </Text>
            <Textarea
              label={selected.requires_comment ? 'Комментарий' : 'Комментарий (необязательно)'}
              required={selected.requires_comment}
              autosize
              minRows={3}
              maxRows={8}
              data-autofocus
              value={comment}
              error={commentError}
              onChange={(e) => setComment(e.currentTarget.value)}
              onBlur={() => setTouched(true)}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={close}>
                Отмена
              </Button>
              <Button
                color={ACTION_COLOR[selected.to_status]}
                loading={changeStatus.isPending}
                onClick={submit}
              >
                Подтвердить
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>
    </>
  );
}
