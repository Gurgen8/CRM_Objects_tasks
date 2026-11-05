-- =============================================================================
-- 2. Функции и триггеры: профили, проверки целостности, смена статусов
-- =============================================================================
-- Все security definer функции фиксируют search_path = '' и обращаются к
-- объектам только по полному имени (schema.table) — защита от подмены объектов.

-- -----------------------------------------------------------------------------
-- Вспомогательные функции для RLS
-- -----------------------------------------------------------------------------

-- security definer: читает profiles в обход RLS, иначе политика profiles,
-- которая вызывает эту функцию, ушла бы в бесконечную рекурсию.
create function private.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'manager'
  );
$$;

-- Разрешён ли текущему пользователю переход статуса для задачи с данным исполнителем.
create function private.is_transition_allowed(
  p_from      public.task_status,
  p_to        public.task_status,
  p_assignee  uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.task_status_transitions tr
    where tr.from_status = p_from
      and tr.to_status = p_to
      and case tr.actor_role
            when 'manager'  then private.is_manager()
            when 'executor' then p_assignee = (select auth.uid())
          end
  );
$$;

create function private.status_label(p_status public.task_status)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'new'         then 'Новая'
    when 'in_progress' then 'В работе'
    when 'review'      then 'На проверке'
    when 'accepted'    then 'Принята'
    when 'rework'      then 'На доработке'
  end;
$$;

-- -----------------------------------------------------------------------------
-- Профиль создаётся автоматически при создании пользователя в Supabase Auth.
-- Роль берётся из app_metadata: его может задать только администратор
-- (service_role / Dashboard). user_metadata пользователь меняет сам, поэтому
-- роль оттуда НЕ берём.
-- -----------------------------------------------------------------------------
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    coalesce((new.raw_app_meta_data ->> 'role')::public.user_role, 'executor')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Supabase Auth может записать app_metadata отдельным UPDATE сразу после INSERT,
-- а администратор может сменить роль позже. Держим profiles.role в синхроне.
create function private.sync_user_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role := (new.raw_app_meta_data ->> 'role')::public.user_role;
begin
  if v_role is not null then
    update public.profiles set role = v_role where id = new.id and role is distinct from v_role;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_role_changed
  after update of raw_app_meta_data on auth.users
  for each row
  when (old.raw_app_meta_data ->> 'role' is distinct from new.raw_app_meta_data ->> 'role')
  execute function private.sync_user_role();

-- -----------------------------------------------------------------------------
-- updated_at
-- -----------------------------------------------------------------------------
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger sites_set_updated_at
  before update on public.sites
  for each row execute function private.set_updated_at();

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Проверки задач
-- -----------------------------------------------------------------------------

-- Исполнителем можно назначить только пользователя с ролью executor.
create function private.validate_task_assignee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles where id = new.assignee_id and role = 'executor'
  ) then
    raise exception 'Исполнителем можно назначить только пользователя с ролью «Исполнитель»'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger tasks_validate_assignee
  before insert or update of assignee_id on public.tasks
  for each row execute function private.validate_task_assignee();

-- Задача всегда создаётся в статусе «Новая», автором — текущий пользователь.
-- (Через API эти колонки и так нельзя передать — см. GRANT в миграции 3;
-- триггер — второй рубеж на случай ошибки в правах.)
create function private.prepare_new_task()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.status := 'new';
  new.created_by := coalesce(auth.uid(), new.created_by);
  new.created_at := now();
  return new;
end;
$$;

create trigger tasks_prepare_new
  before insert on public.tasks
  for each row execute function private.prepare_new_task();

-- Первая запись истории: «— → Новая».
create function private.log_task_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.task_status_history (task_id, from_status, to_status, changed_by)
  values (new.id, null, new.status, new.created_by);
  return new;
end;
$$;

create trigger tasks_log_created
  after insert on public.tasks
  for each row execute function private.log_task_created();

-- Статус нельзя изменить обычным UPDATE ни при каких правах: только через
-- change_task_status, которая выставляет флаг на время своей транзакции.
create function private.guard_task_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and coalesce(current_setting('app.status_change_allowed', true), '') <> 'on' then
    raise exception 'Статус задачи меняется только через действия с задачей'
      using errcode = '42501';
  end if;
  if new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Автора и дату создания задачи изменить нельзя' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger tasks_guard_status
  before update on public.tasks
  for each row execute function private.guard_task_status();

-- Журнал истории неизменяем: никаких UPDATE. DELETE допускается только каскадом
-- при удалении самой задачи (постановщиком), напрямую удалить запись нельзя.
create function private.guard_history_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'Историю статусов нельзя изменять' using errcode = '42501';
  end if;
  -- pg_trigger_depth() > 1 — удаление пришло из каскада FK (удаление задачи)
  if tg_op = 'DELETE' and pg_trigger_depth() <= 1 then
    raise exception 'Историю статусов нельзя удалять' using errcode = '42501';
  end if;
  return old;
end;
$$;

create trigger task_status_history_immutable
  before update or delete on public.task_status_history
  for each row execute function private.guard_history_immutable();

-- -----------------------------------------------------------------------------
-- Публичное API смены статуса (вызывается из UI через supabase.rpc)
-- -----------------------------------------------------------------------------

-- Какие действия доступны текущему пользователю для задачи.
-- security invoker: задача читается под RLS вызывающего, чужую задачу
-- исполнитель просто не увидит и получит пустой список.
create function public.get_available_transitions(p_task_id uuid)
returns table (to_status public.task_status, requires_comment boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  select tr.to_status, tr.requires_comment
  from public.tasks t
  join public.task_status_transitions tr on tr.from_status = t.status
  where t.id = p_task_id
    and private.is_transition_allowed(t.status, tr.to_status, t.assignee_id)
  order by tr.to_status;
$$;

-- Смена статуса: проверка прав и перехода, запись в историю — одной транзакцией.
create function public.change_task_status(
  p_task_id    uuid,
  p_to_status  public.task_status,
  p_comment    text default null
)
returns public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_task     public.tasks;
  v_from     public.task_status;
  v_comment  text := nullif(btrim(p_comment), '');
  v_rule     public.task_status_transitions;
begin
  if v_uid is null then
    raise exception 'Требуется вход в систему' using errcode = '28000';
  end if;

  -- for update: блокируем строку, чтобы два одновременных запроса
  -- не провели задачу через два перехода из одного и того же статуса
  select * into v_task from public.tasks where id = p_task_id for update;

  -- Для чужой задачи ответ такой же, как для несуществующей:
  -- исполнитель не должен узнавать даже о факте её существования.
  if not found or not (private.is_manager() or v_task.assignee_id = v_uid) then
    raise exception 'Задача не найдена' using errcode = 'P0002';
  end if;

  v_from := v_task.status;

  select * into v_rule
  from public.task_status_transitions
  where from_status = v_from and to_status = p_to_status;

  if not found or not private.is_transition_allowed(v_from, p_to_status, v_task.assignee_id) then
    raise exception 'Переход «%» → «%» вам недоступен',
      private.status_label(v_from), private.status_label(p_to_status)
      using errcode = '42501';
  end if;

  if v_rule.requires_comment and v_comment is null then
    raise exception 'Для этого действия обязателен комментарий' using errcode = '23514';
  end if;

  if char_length(v_comment) > 2000 then
    raise exception 'Комментарий длиннее 2000 символов' using errcode = '23514';
  end if;

  -- Флаг действует только до конца текущей транзакции (третий аргумент = true)
  perform set_config('app.status_change_allowed', 'on', true);

  update public.tasks
  set status = p_to_status
  where id = p_task_id
  returning * into v_task;

  perform set_config('app.status_change_allowed', 'off', true);

  insert into public.task_status_history (task_id, from_status, to_status, comment, changed_by)
  values (p_task_id, v_from, p_to_status, v_comment, v_uid);

  return v_task;
end;
$$;
