// Наполнение базы демо-данными.
//
// 1. Пользователи создаются через Admin API (регистрация закрыта, роль кладётся
//    в app_metadata, которое пользователь сам изменить не может).
// 2. Объекты и задачи создаются и проводятся по статусам ОТ ИМЕНИ пользователей,
//    обычными запросами под RLS, через change_task_status. Поэтому история
//    в базе настоящая, а скрипт заодно проверяет, что рабочий сценарий проходит.
//
// Запуск: npm run db:seed

import type { Database } from '../src/types/database.ts';
import { DEMO_USERS, adminClient, signedInClient } from './lib.ts';
import type { Client, DemoUserKey } from './lib.ts';

type TaskStatus = Database['public']['Enums']['task_status'];

async function ensureUsers(): Promise<Record<DemoUserKey, string>> {
  const admin = adminClient();
  const { data: list, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;

  const ids = {} as Record<DemoUserKey, string>;
  for (const [key, u] of Object.entries(DEMO_USERS) as [DemoUserKey, (typeof DEMO_USERS)[DemoUserKey]][]) {
    const existing = list.users.find((x) => x.email === u.email);
    if (existing) {
      ids[key] = existing.id;
      console.log(`  = ${u.email} уже есть`);
      continue;
    }
    const { data, error: createError } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: u.full_name },
      app_metadata: { role: u.role },
    });
    if (createError) throw createError;
    ids[key] = data.user.id;
    console.log(`  + ${u.email} (${u.role})`);
  }
  return ids;
}

function must<T>(result: { data: T; error: unknown }, what: string): NonNullable<T> {
  if (result.error || result.data === null || result.data === undefined) {
    throw new Error(`${what}: ${JSON.stringify(result.error)}`);
  }
  return result.data;
}

async function move(client: Client, taskId: string, to: TaskStatus, comment?: string) {
  must(
    await client.rpc('change_task_status', { p_task_id: taskId, p_to_status: to, p_comment: comment }),
    `Переход в ${to}`,
  );
}

async function main() {
  console.log('Пользователи:');
  const ids = await ensureUsers();

  const manager = await signedInClient(DEMO_USERS.manager.email, DEMO_USERS.manager.password);
  const manager2 = await signedInClient(DEMO_USERS.manager2.email, DEMO_USERS.manager2.password);
  const petrov = await signedInClient(DEMO_USERS.executor1.email, DEMO_USERS.executor1.password);
  const sidorov = await signedInClient(DEMO_USERS.executor2.email, DEMO_USERS.executor2.password);

  const { count } = await manager.from('sites').select('*', { count: 'exact', head: true });
  if (count && count > 0) {
    console.log('Объекты уже есть — данные не добавляю (чтобы не задвоить).');
    return;
  }

  console.log('Объекты:');
  const sites = must(
    await manager
      .from('sites')
      .insert([
        { name: 'ЖК «Северный парк», корпус 2', address: 'г. Москва, ул. Лесная, д. 12' },
        { name: 'Склад «Логистик-Юг»', address: 'Московская обл., г. Подольск, Промышленная ул., 5' },
        { name: 'Частный дом в Истре', address: 'Московская обл., Истринский р-н, д. Лешково, уч. 48' },
      ])
      .select('id, name'),
    'Создание объектов',
  );
  sites.forEach((s) => console.log(`  + ${s.name}`));
  const [park, sklad, dom] = sites;

  const createTask = async (
    author: Client,
    siteId: string,
    title: string,
    description: string,
    assignee: DemoUserKey,
  ) =>
    must(
      await author
        .from('tasks')
        .insert({ site_id: siteId, title, description, assignee_id: ids[assignee] })
        .select('id')
        .single(),
      `Создание задачи «${title}»`,
    ).id;

  console.log('Задачи:');

  // Новая
  await createTask(manager, park.id, 'Завезти арматуру на 3 этаж',
    'Арматура А500С Ø12, 2,5 т. Согласовать время с прорабом.', 'executor1');
  await createTask(manager2, sklad.id, 'Проверить ворота погрузочной зоны',
    'Секционные ворота №2 закрываются с перекосом.', 'executor2');

  // В работе
  const t3 = await createTask(manager, park.id, 'Монтаж опалубки перекрытия 4 этажа',
    'По проекту КЖ-14. Шаг стоек — не более 1,2 м.', 'executor1');
  await move(petrov, t3, 'in_progress', 'Начали, бригада 4 человека');

  // На проверке
  const t4 = await createTask(manager, dom.id, 'Утеплить фундамент',
    'ЭППС 100 мм по периметру, гидроизоляция обмазочная.', 'executor2');
  await move(sidorov, t4, 'in_progress');
  await move(sidorov, t4, 'review', 'Готово, фото в общем чате');

  // Принята
  const t5 = await createTask(manager2, sklad.id, 'Демонтаж старой кровли',
    'Снять профлист и утеплитель над осями 1–4.', 'executor1');
  await move(petrov, t5, 'in_progress');
  await move(petrov, t5, 'review');
  await move(manager2, t5, 'accepted', 'Принято, мусор вывезен');

  // На доработке
  const t6 = await createTask(manager, dom.id, 'Разводка электрики на 1 этаже',
    'По схеме ЭО-1, кабель ВВГнг-LS.', 'executor2');
  await move(sidorov, t6, 'in_progress');
  await move(sidorov, t6, 'review');
  await move(manager, t6, 'rework', 'Нет заземления в санузле, переделать по схеме');

  // Полный цикл с доработкой и снова в работе
  const t7 = await createTask(manager, park.id, 'Кладка перегородок в секции Б',
    'Газобетон D500, 100 мм. Армирование каждого 3-го ряда.', 'executor1');
  await move(petrov, t7, 'in_progress');
  await move(petrov, t7, 'review');
  await move(manager, t7, 'rework', 'Отклонение от вертикали 15 мм у кв. 42');
  await move(petrov, t7, 'in_progress', 'Переделываем');

  console.log('  + 7 задач во всех статусах');
  console.log('\nГотово. Доступы:');
  for (const u of Object.values(DEMO_USERS)) {
    console.log(`  ${u.role.padEnd(8)}  ${u.email.padEnd(26)}  ${u.password}`);
  }
}

main().catch((e) => {
  console.error('\nОшибка:', e instanceof Error ? e.message : e);
  process.exit(1);
});
