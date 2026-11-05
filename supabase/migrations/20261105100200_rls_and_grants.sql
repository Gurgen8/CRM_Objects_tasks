-- =============================================================================
-- 3. Права доступа: GRANT (что вообще можно делать с таблицей)
--    + RLS (к каким строкам это применимо)
-- =============================================================================
-- Два слоя:
--   GRANT  — какие операции и КОЛОНКИ доступны роли authenticated.
--            Например, колонку tasks.status нельзя изменить через API вообще.
--   RLS    — какие СТРОКИ видит/меняет конкретный пользователь.
-- Роль anon (не вошедший пользователь) не получает ничего.

-- -----------------------------------------------------------------------------
-- GRANT
-- -----------------------------------------------------------------------------
revoke all on public.profiles, public.sites, public.tasks,
              public.task_status_history, public.task_status_transitions
  from anon, authenticated;

-- Профили: только чтение. Роль и имя меняет администратор.
grant select on public.profiles to authenticated;

-- Объекты: автор и даты выставляются базой.
grant select, delete on public.sites to authenticated;
grant insert (name, address), update (name, address) on public.sites to authenticated;

-- Задачи: status / created_by / created_at через API не передать.
grant select, delete on public.tasks to authenticated;
grant insert (site_id, title, description, assignee_id),
      update (site_id, title, description, assignee_id)
  on public.tasks to authenticated;

-- История и матрица переходов: только чтение.
grant select on public.task_status_history to authenticated;
grant select on public.task_status_transitions to authenticated;

-- Функции. По умолчанию EXECUTE выдаётся PUBLIC — забираем и выдаём явно.
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_manager() to authenticated;
grant execute on function private.is_transition_allowed(public.task_status, public.task_status, uuid)
  to authenticated;

revoke execute on function public.get_available_transitions(uuid) from public, anon;
revoke execute on function public.change_task_status(uuid, public.task_status, text) from public, anon;
grant execute on function public.get_available_transitions(uuid) to authenticated;
grant execute on function public.change_task_status(uuid, public.task_status, text) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.profiles                enable row level security;
alter table public.sites                   enable row level security;
alter table public.tasks                   enable row level security;
alter table public.task_status_history     enable row level security;
alter table public.task_status_transitions enable row level security;

-- (select auth.uid()) вместо auth.uid(): Postgres вычисляет значение один раз
-- на запрос, а не для каждой строки.

-- ---------- tasks ----------
create policy "tasks: менеджер видит все, исполнитель — свои"
  on public.tasks for select to authenticated
  using (private.is_manager() or assignee_id = (select auth.uid()));

create policy "tasks: создаёт только постановщик"
  on public.tasks for insert to authenticated
  with check (private.is_manager());

create policy "tasks: редактирует только постановщик"
  on public.tasks for update to authenticated
  using (private.is_manager())
  with check (private.is_manager());

create policy "tasks: удаляет только постановщик"
  on public.tasks for delete to authenticated
  using (private.is_manager());

-- ---------- sites ----------
create policy "sites: менеджер видит все, исполнитель — где есть его задачи"
  on public.sites for select to authenticated
  using (
    private.is_manager()
    or exists (
      select 1 from public.tasks t
      where t.site_id = sites.id and t.assignee_id = (select auth.uid())
    )
  );

create policy "sites: создаёт только постановщик"
  on public.sites for insert to authenticated
  with check (private.is_manager());

create policy "sites: редактирует только постановщик"
  on public.sites for update to authenticated
  using (private.is_manager())
  with check (private.is_manager());

create policy "sites: удаляет только постановщик"
  on public.sites for delete to authenticated
  using (private.is_manager());

-- ---------- task_status_history ----------
-- Только SELECT. Политик на INSERT/UPDATE/DELETE нет — значит, запрещено.
create policy "history: видна тем, кто видит задачу"
  on public.task_status_history for select to authenticated
  using (
    private.is_manager()
    or exists (
      select 1 from public.tasks t
      where t.id = task_status_history.task_id and t.assignee_id = (select auth.uid())
    )
  );

-- ---------- profiles ----------
-- Исполнитель видит себя и тех, кто фигурирует в его задачах
-- (автор задачи, участники истории). Список всех сотрудников ему не нужен.
create policy "profiles: видимость по участию в задачах"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or private.is_manager()
    or exists (
      select 1 from public.tasks t
      where t.assignee_id = (select auth.uid()) and t.created_by = profiles.id
    )
    or exists (
      select 1
      from public.task_status_history h
      join public.tasks t on t.id = h.task_id
      where t.assignee_id = (select auth.uid()) and h.changed_by = profiles.id
    )
  );

-- ---------- task_status_transitions ----------
-- Справочник правил, секретов в нём нет.
create policy "transitions: читают все вошедшие"
  on public.task_status_transitions for select to authenticated
  using (true);
