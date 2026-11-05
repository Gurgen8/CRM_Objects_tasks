import { Button, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';

export function NotFound({
  title = 'Страница не найдена',
  description = 'Возможно, она была удалена или у вас нет к ней доступа.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <Stack align="center" py="xl" gap="sm">
      <Title order={3}>{title}</Title>
      <Text c="dimmed" ta="center">
        {description}
      </Text>
      <Button component={Link} to="/" variant="light">
        На главную
      </Button>
    </Stack>
  );
}
