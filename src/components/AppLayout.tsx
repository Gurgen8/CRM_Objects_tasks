import { AppShell, Badge, Burger, Button, Group, NavLink, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconBuildingSkyscraper, IconChecklist, IconLogout, IconMapPin } from '@tabler/icons-react';
import { NavLink as RouterNavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth, useCurrentProfile } from '../features/auth/useAuth';

const ROLE_LABEL = { manager: 'Постановщик', executor: 'Исполнитель' } as const;

export function AppLayout() {
  const profile = useCurrentProfile();
  const { signOut } = useAuth();
  const [opened, { toggle, close }] = useDisclosure(false);
  const location = useLocation();

  // На мобильном закрываем меню после перехода
  useEffect(close, [location.pathname, close]);

  const links = [
    ...(profile.role === 'executor'
      ? [{ to: '/my-tasks', label: 'Мои задачи', icon: IconChecklist }]
      : []),
    { to: '/sites', label: 'Объекты', icon: IconMapPin },
  ];

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="lg"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="xs">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <IconBuildingSkyscraper size={24} stroke={1.5} />
            <Text fw={700}>СтройCRM</Text>
          </Group>
          <Group gap="sm" visibleFrom="xs">
            <Stack gap={0} align="flex-end">
              <Text size="sm" fw={500}>
                {profile.full_name}
              </Text>
              <Text size="xs" c="dimmed">
                {profile.email}
              </Text>
            </Stack>
            <Badge variant="light">{ROLE_LABEL[profile.role]}</Badge>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <AppShell.Section grow>
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              component={RouterNavLink}
              to={to}
              label={label}
              leftSection={<Icon size={18} />}
              active={location.pathname.startsWith(to)}
            />
          ))}
        </AppShell.Section>
        <AppShell.Section>
          <Stack gap={4} hiddenFrom="xs" mb="sm" px="sm">
            <Text size="sm" fw={500}>
              {profile.full_name}
            </Text>
            <Badge variant="light" w="fit-content">
              {ROLE_LABEL[profile.role]}
            </Badge>
          </Stack>
          <Button
            variant="subtle"
            color="gray"
            fullWidth
            justify="flex-start"
            leftSection={<IconLogout size={18} />}
            onClick={signOut}
          >
            Выйти
          </Button>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main bg="gray.0">
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
