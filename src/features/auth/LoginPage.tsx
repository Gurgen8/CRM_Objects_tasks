import { Button, Center, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconBuildingSkyscraper } from '@tabler/icons-react';
import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ErrorAlert } from '../../components/ErrorAlert';
import { useAuth } from './useAuth';

interface LocationState {
  from?: { pathname: string };
}

export function LoginPage() {
  const { session, signIn } = useAuth();
  const location = useLocation();
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: (v) => (/^\S+@\S+\.\S+$/.test(v.trim()) ? null : 'Введите корректный email'),
      password: (v) => (v ? null : 'Введите пароль'),
    },
  });

  if (session) {
    const from = (location.state as LocationState | null)?.from?.pathname ?? '/';
    return <Navigate to={from} replace />;
  }

  const handleSubmit = form.onSubmit(async ({ email, password }) => {
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError(e);
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Center mih="100vh" p="md" bg="gray.0">
      <Paper withBorder shadow="sm" radius="md" p="xl" w="100%" maw={400}>
        <form onSubmit={handleSubmit} noValidate>
          <Stack>
            <Stack gap={4} align="center">
              <IconBuildingSkyscraper size={40} stroke={1.5} />
              <Title order={2}>СтройCRM</Title>
              <Text c="dimmed" size="sm">
                Объекты и задачи
              </Text>
            </Stack>

            {error ? <ErrorAlert error={error} /> : null}

            <TextInput
              label="Email"
              type="email"
              autoComplete="email"
              required
              {...form.getInputProps('email')}
            />
            <PasswordInput
              label="Пароль"
              autoComplete="current-password"
              required
              {...form.getInputProps('password')}
            />
            <Button type="submit" loading={submitting} fullWidth>
              Войти
            </Button>
            <Text c="dimmed" size="xs" ta="center">
              Регистрация закрыта. Доступ выдаёт администратор.
            </Text>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}
