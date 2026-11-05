// Проверка защиты данных «в обход интерфейса».
//
// Скрипт ведёт себя как злоумышленник с публичным ключом и логином исполнителя
// (или постановщика) и шлёт в Supabase запросы, которые интерфейс никогда
// не отправит. Каждая попытка должна быть отклонена базой.
//
// Запуск (после npm run db:seed): npm run test:security

import { DEMO_USERS, adminClient, anonClient, signedInClient } from './lib.ts';

interface Result {
  name: string;
  ok: boolean;
  details?: string;
}

const results: Result[] = [];

/** fn возвращает true, если защита сработала. */
async function check(name: string, fn: () => Promise<boolean | { ok: boolean; details: string }>) {
  try {
    const r = await fn();
    const res = typeof r === 'boolean' ? { ok: r } : r;
    results.push({ name, ...res });
  } catch (e) {
    results.push({ name, ok: false, details: `исключение: ${e instanceof Error ? e.message : e}` });
  }
}

/** Запись отклонена: ошибка либо ни одна строка не затронута. */
const denied = (r: { error: unknown; data: unknown[] | null }) =>
  Boolean(r.error) || (r.data?.length ?? 0) === 0;

async function main() {
  const admin = adminClient();
  const anon = anonClient();
  const manager = await signedInClient(DEMO_USERS.manager.email, DEMO_USERS.manager.password);
  const petrov = await signedInClient(DEMO_USERS.executor1.email, DEMO_USERS.executor1.password);

  // ---------- Подготовка: смотрим реальные данные глазами админа ----------
  const { data: profiles } = await admin.from('profiles').select('id, email, role');
  const idOf = (email: string) => profiles!.find((p) => p.email === email)!.id;
  const petrovId = idOf(DEMO_USERS.executor1.email);
  const sidorovId = idOf(DEMO_USERS.executor2.email);
  const managerId = idOf(DEMO_USERS.manager.email);

  const { data: allTasks } = await admin.from('tasks').select('*');
  if (!allTasks?.length) throw new Error('В базе нет задач — сначала npm run db:seed');

  const petrovTasks = allTasks.filter((t) => t.assignee_id === petrovId);
  const sidorovTask = allTasks.find((t) => t.assignee_id === sidorovId)!;
  const petrovTask = petrovTasks[0];
  const petrovNewTask = petrovTasks.find((t) => t.status === 'new');
  const reviewTask = allTasks.find((t) => t.status === 'review');
  const newTask = allTasks.find((t) => t.status === 'new');
  const { data: allSites } = await admin.from('sites').select('id');
  const petrovSiteIds = new Set(petrovTasks.map((t) => t.site_id));

  const historyCount = async () =>
    (await admin.from('task_status_history').select('*', { count: 'exact', head: true })).count;
  const historyBefore = await historyCount();

  // ---------- Без входа ----------
  await check('Аноним не видит задачи', async () => {
    const r = await anon.from('tasks').select('id');
    return Boolean(r.error) || r.data!.length === 0;
  });
  await check('Аноним не видит объекты и историю', async () => {
    const s = await anon.from('sites').select('id');
    const h = await anon.from('task_status_history').select('id');
    return (Boolean(s.error) || s.data!.length === 0) && (Boolean(h.error) || h.data!.length === 0);
  });
  await check('Открытая регистрация отключена', async () => {
    const r = await anonClient().auth.signUp({
      email: `hacker-${Date.now()}@example.com`,
      password: 'Sup3r-Secret-Pass!',
    });
    return { ok: Boolean(r.error), details: r.error?.message ?? 'регистрация прошла!' };
  });
  await check('Аноним не может вызвать смену статуса', async () => {
    const r = await anon.rpc('change_task_status', { p_task_id: newTask!.id, p_to_status: 'in_progress' });
    return Boolean(r.error);
  });

  // ---------- Исполнитель: чтение ----------
  await check('Исполнитель видит только свои задачи', async () => {
    const r = await petrov.from('tasks').select('id, assignee_id');
    const ok = !r.error && r.data!.length === petrovTasks.length && r.data!.every((t) => t.assignee_id === petrovId);
    return { ok, details: `видит ${r.data?.length} из ${allTasks.length}, своих ${petrovTasks.length}` };
  });
  await check('Исполнитель не читает чужую задачу по id', async () => {
    const r = await petrov.from('tasks').select('id').eq('id', sidorovTask.id).maybeSingle();
    return r.data === null;
  });
  await check('Исполнитель видит только объекты со своими задачами', async () => {
    const r = await petrov.from('sites').select('id');
    const ok = !r.error && r.data!.length === petrovSiteIds.size && r.data!.every((s) => petrovSiteIds.has(s.id));
    return { ok, details: `видит ${r.data?.length} из ${allSites!.length}` };
  });
  await check('Исполнитель не читает историю чужой задачи', async () => {
    const r = await petrov.from('task_status_history').select('id').eq('task_id', sidorovTask.id);
    return !r.error && r.data!.length === 0;
  });
  await check('Исполнитель не видит профиль другого исполнителя', async () => {
    const r = await petrov.from('profiles').select('id').eq('id', sidorovId);
    return !r.error && r.data!.length === 0;
  });
  await check('Исполнитель не узнаёт доступные действия по чужой задаче', async () => {
    const r = await petrov.rpc('get_available_transitions', { p_task_id: sidorovTask.id });
    return !r.error && r.data!.length === 0;
  });

  // ---------- Исполнитель: изменения ----------
  await check('Исполнитель не меняет чужую задачу', async () =>
    denied(await petrov.from('tasks').update({ title: 'взлом' }).eq('id', sidorovTask.id).select()));
  await check('Исполнитель не редактирует поля своей задачи', async () =>
    denied(await petrov.from('tasks').update({ title: 'взлом' }).eq('id', petrovTask.id).select()));
  await check('Исполнитель не меняет статус прямым UPDATE', async () => {
    const r = await petrov.from('tasks').update({ status: 'accepted' }).eq('id', petrovTask.id).select();
    return { ok: denied(r), details: (r.error as { message?: string } | null)?.message ?? '' };
  });
  await check('Исполнитель не переводит чужую задачу через RPC', async () => {
    const r = await petrov.rpc('change_task_status', { p_task_id: sidorovTask.id, p_to_status: 'in_progress' });
    return { ok: Boolean(r.error), details: r.error?.message ?? 'переход прошёл!' };
  });
  await check('Исполнитель не принимает свою задачу сам', async () => {
    const r = await petrov.rpc('change_task_status', { p_task_id: petrovTask.id, p_to_status: 'accepted' });
    return { ok: Boolean(r.error), details: r.error?.message ?? 'переход прошёл!' };
  });
  if (petrovNewTask) {
    await check('Запрещённый переход «Новая → На проверке» не проходит', async () => {
      const r = await petrov.rpc('change_task_status', { p_task_id: petrovNewTask.id, p_to_status: 'review' });
      return { ok: Boolean(r.error), details: r.error?.message ?? 'переход прошёл!' };
    });
  }
  await check('Исполнитель не создаёт объект', async () =>
    denied(await petrov.from('sites').insert({ name: 'x', address: 'y' }).select()));
  await check('Исполнитель не создаёт задачу', async () =>
    denied(
      await petrov
        .from('tasks')
        .insert({ title: 'x', site_id: petrovTask.site_id, assignee_id: petrovId })
        .select(),
    ));
  await check('Исполнитель не удаляет свою задачу', async () =>
    denied(await petrov.from('tasks').delete().eq('id', petrovTask.id).select()));
  await check('Исполнитель не меняет себе роль', async () => {
    const r = await petrov.from('profiles').update({ role: 'manager' }).eq('id', petrovId).select();
    return denied(r);
  });

  // ---------- История: подделка, изменение, удаление ----------
  await check('Нельзя добавить запись в историю напрямую', async () => {
    const r = await petrov
      .from('task_status_history')
      .insert({ task_id: petrovTask.id, from_status: 'review', to_status: 'accepted', changed_by: managerId })
      .select();
    return denied(r);
  });
  await check('Постановщик не может добавить запись в историю', async () => {
    const r = await manager
      .from('task_status_history')
      .insert({ task_id: petrovTask.id, to_status: 'accepted', changed_by: managerId })
      .select();
    return denied(r);
  });
  await check('Нельзя изменить запись истории', async () => {
    const r1 = await manager.from('task_status_history').update({ comment: 'подделка' }).eq('task_id', petrovTask.id).select();
    const r2 = await petrov.from('task_status_history').update({ comment: 'подделка' }).eq('task_id', petrovTask.id).select();
    return denied(r1) && denied(r2);
  });
  await check('Нельзя удалить запись истории', async () => {
    const r1 = await manager.from('task_status_history').delete().eq('task_id', petrovTask.id).select();
    const r2 = await petrov.from('task_status_history').delete().eq('task_id', petrovTask.id).select();
    return denied(r1) && denied(r2);
  });

  // ---------- Постановщик: правила тоже действуют ----------
  await check('Постановщик не меняет статус прямым UPDATE', async () => {
    const r = await manager.from('tasks').update({ status: 'accepted' }).eq('id', newTask!.id).select();
    return denied(r);
  });
  await check('Постановщик не берёт задачу в работу за исполнителя', async () => {
    const r = await manager.rpc('change_task_status', { p_task_id: newTask!.id, p_to_status: 'in_progress' });
    return { ok: Boolean(r.error), details: r.error?.message ?? 'переход прошёл!' };
  });
  if (reviewTask) {
    await check('«На доработку» без комментария не проходит', async () => {
      const r1 = await manager.rpc('change_task_status', { p_task_id: reviewTask.id, p_to_status: 'rework' });
      const r2 = await manager.rpc('change_task_status', {
        p_task_id: reviewTask.id, p_to_status: 'rework', p_comment: '   ',
      });
      return { ok: Boolean(r1.error && r2.error), details: r1.error?.message ?? 'переход прошёл!' };
    });
  }
  await check('Нельзя создать задачу сразу в статусе «Принята»', async () => {
    const r = await manager
      .from('tasks')
      .insert({ title: 'x', site_id: petrovTask.site_id, assignee_id: petrovId, status: 'accepted' })
      .select();
    return denied(r);
  });
  await check('Нельзя подменить автора задачи', async () => {
    const r = await manager.from('tasks').update({ created_by: petrovId }).eq('id', petrovTask.id).select();
    return denied(r);
  });
  await check('Нельзя назначить исполнителем постановщика', async () =>
    denied(await manager.from('tasks').update({ assignee_id: managerId }).eq('id', petrovTask.id).select()));
  await check('Нельзя удалить объект, в котором есть задачи', async () =>
    denied(await manager.from('sites').delete().eq('id', petrovTask.site_id).select()));

  // ---------- Итог: данные не пострадали ----------
  await check('История не изменилась после всех атак', async () => {
    const after = await historyCount();
    return { ok: after === historyBefore, details: `было ${historyBefore}, стало ${after}` };
  });
  await check('Задачи не изменились после всех атак', async () => {
    const { data: tasksAfter } = await admin.from('tasks').select('*');
    const same = JSON.stringify(tasksAfter!.sort((a, b) => a.id.localeCompare(b.id)))
      === JSON.stringify([...allTasks].sort((a, b) => a.id.localeCompare(b.id)));
    return same;
  });

  // ---------- Отчёт ----------
  console.log('\nПроверка защиты данных\n');
  for (const r of results) {
    console.log(`${r.ok ? '  ✓' : '  ✗'} ${r.name}${r.details ? `  — ${r.details}` : ''}`);
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} из ${results.length} проверок пройдено`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('Ошибка:', e instanceof Error ? e.message : e);
  process.exit(1);
});
