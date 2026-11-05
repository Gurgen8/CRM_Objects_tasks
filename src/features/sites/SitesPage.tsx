import { Badge, Button, Card, Group, SimpleGrid, Skeleton, Stack, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconMapPin, IconPlus } from '@tabler/icons-react';
import { Link, useNavigate } from 'react-router-dom';
import { ErrorAlert } from '../../components/ErrorAlert';
import { pluralize } from '../../lib/format';
import { useAuth } from '../auth/useAuth';
import { useSites } from './api';
import { SiteFormModal } from './components/SiteFormModal';

export function SitesPage() {
  const { isManager } = useAuth();
  const sites = useSites();
  const navigate = useNavigate();
  const [createOpened, create] = useDisclosure(false);

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Объекты</Title>
        {isManager ? (
          <Button leftSection={<IconPlus size={16} />} onClick={create.open}>
            Добавить объект
          </Button>
        ) : null}
      </Group>

      {sites.isPending ? (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} h={110} radius="md" />
          ))}
        </SimpleGrid>
      ) : sites.isError ? (
        <ErrorAlert error={sites.error} />
      ) : sites.data.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          {isManager ? 'Объектов пока нет — добавьте первый.' : 'У вас пока нет задач ни на одном объекте.'}
        </Text>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {sites.data.map((site) => (
            <Card
              key={site.id}
              component={Link}
              to={`/sites/${site.id}`}
              withBorder
              radius="md"
              p="lg"
              style={{ textDecoration: 'none' }}
            >
              <Stack gap="xs">
                <Text fw={600} size="lg" lineClamp={2}>
                  {site.name}
                </Text>
                <Group gap={6} wrap="nowrap" c="dimmed">
                  <IconMapPin size={16} style={{ flexShrink: 0 }} />
                  <Text size="sm" lineClamp={2}>
                    {site.address}
                  </Text>
                </Group>
                <Badge variant="light" color="gray" w="fit-content">
                  {site.taskCount} {pluralize(site.taskCount, ['задача', 'задачи', 'задач'])}
                </Badge>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      )}

      {isManager ? (
        <SiteFormModal
          opened={createOpened}
          onClose={create.close}
          onCreated={(id) => navigate(`/sites/${id}`)}
        />
      ) : null}
    </Stack>
  );
}
