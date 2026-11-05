import { Alert } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { getErrorMessage } from '../lib/errors';

export function ErrorAlert({ error, title = 'Ошибка' }: { error: unknown; title?: string }) {
  return (
    <Alert color="red" variant="light" title={title} icon={<IconAlertCircle size={18} />}>
      {getErrorMessage(error)}
    </Alert>
  );
}
