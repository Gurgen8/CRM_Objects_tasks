import type { TaskStatus } from '../../types/domain';

// Только отображение. Правила переходов живут в БД (task_status_transitions),
// UI получает доступные действия функцией get_available_transitions.

export const STATUS_LABEL: Record<TaskStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  review: 'На проверке',
  accepted: 'Принята',
  rework: 'На доработке',
};

export const STATUS_COLOR: Record<TaskStatus, string> = {
  new: 'blue',
  in_progress: 'yellow',
  review: 'violet',
  accepted: 'green',
  rework: 'red',
};

// Порядок для сортировки: сначала то, что требует внимания
export const STATUS_ORDER: TaskStatus[] = ['rework', 'new', 'in_progress', 'review', 'accepted'];

export const ACTION_LABEL: Record<TaskStatus, string> = {
  new: 'Новая',
  in_progress: 'Взять в работу',
  review: 'Отправить на проверку',
  accepted: 'Принять',
  rework: 'Вернуть на доработку',
};

export const ACTION_COLOR: Record<TaskStatus, string> = {
  new: 'blue',
  in_progress: 'blue',
  review: 'violet',
  accepted: 'green',
  rework: 'red',
};

export const sortByStatus = <T extends { status: TaskStatus; created_at: string }>(tasks: T[]) =>
  [...tasks].sort(
    (a, b) =>
      STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
      b.created_at.localeCompare(a.created_at),
  );
