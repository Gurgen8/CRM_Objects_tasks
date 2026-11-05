import { Button, Group, Modal, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { getErrorMessage } from '../../../lib/errors';
import type { Site } from '../../../types/domain';
import { useCreateSite, useUpdateSite } from '../api';
import type { SiteInput } from '../api';

interface Props {
  opened: boolean;
  onClose: () => void;
  /** Если передан — режим редактирования */
  site?: Pick<Site, 'id' | 'name' | 'address'>;
  onCreated?: (id: string) => void;
}

const required = (label: string, max: number) => (value: string) => {
  const v = value.trim();
  if (!v) return `Укажите ${label}`;
  if (v.length > max) return `Не длиннее ${max} символов`;
  return null;
};

export function SiteFormModal({ opened, onClose, site, onCreated }: Props) {
  return (
    <Modal opened={opened} onClose={onClose} title={site ? 'Редактировать объект' : 'Новый объект'}>
      {/* Форма монтируется заново при каждом открытии и берёт актуальные значения */}
      {opened ? <SiteForm site={site} onClose={onClose} onCreated={onCreated} /> : null}
    </Modal>
  );
}

function SiteForm({ site, onClose, onCreated }: Omit<Props, 'opened'>) {
  const createSite = useCreateSite();
  const updateSite = useUpdateSite(site?.id ?? '');
  const mutation = site ? updateSite : createSite;

  const form = useForm<SiteInput>({
    initialValues: { name: site?.name ?? '', address: site?.address ?? '' },
    validate: { name: required('название', 200), address: required('адрес', 500) },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      const saved = await mutation.mutateAsync({
        name: values.name.trim(),
        address: values.address.trim(),
      });
      notifications.show({ color: 'green', message: site ? 'Объект сохранён' : 'Объект создан' });
      onClose();
      if (!site) onCreated?.(saved.id);
    } catch (e) {
      notifications.show({ color: 'red', title: 'Не удалось сохранить', message: getErrorMessage(e) });
    }
  });

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack>
        <TextInput label="Название" required data-autofocus {...form.getInputProps('name')} />
        <TextInput label="Адрес" required {...form.getInputProps('address')} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            {site ? 'Сохранить' : 'Создать'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
