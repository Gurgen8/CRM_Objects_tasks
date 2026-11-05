import { Badge } from '@mantine/core';
import type { BadgeProps } from '@mantine/core';
import type { TaskStatus } from '../../../types/domain';
import { STATUS_COLOR, STATUS_LABEL } from '../status';

export function StatusBadge({ status, ...props }: { status: TaskStatus } & BadgeProps) {
  return (
    <Badge color={STATUS_COLOR[status]} variant="light" {...props}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
