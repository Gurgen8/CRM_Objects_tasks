-- =============================================================================
-- 1. Схема данных: роли, профили, объекты (стройки), задачи, история статусов
-- =============================================================================

-- Служебная схема для внутренних функций. PostgREST публикует наружу только
-- схему public, поэтому всё, что лежит в private, нельзя вызвать через API.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- -----------------------------------------------------------------------------
-- Типы
-- -----------------------------------------------------------------------------
create type public.user_role as enum ('manager', 'executor');
comment on type public.user_role is 'manager — постановщик, executor — исполнитель';

create type public.task_status as enum ('new', 'in_progress', 'review', 'accepted', 'rework');
comment on type public.task_status is
  'new — Новая, in_progress — В работе, review — На проверке, accepted — Принята, rework — На доработке';

-- -----------------------------------------------------------------------------
-- Профили пользователей (1:1 с auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text not null check (char_length(btrim(full_name)) between 1 and 200),
  role        public.user_role not null default 'executor',
  created_at  timestamptz not null default now()
);
comment on table public.profiles is 'Профиль и роль пользователя. Изменяется только администратором (не через API).';

-- -----------------------------------------------------------------------------
-- Объекты (стройки)
-- -----------------------------------------------------------------------------
create table public.sites (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 200),
  address     text not null check (char_length(btrim(address)) between 1 and 500),
  created_by  uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.sites is 'Объекты — строительные площадки.';

-- -----------------------------------------------------------------------------
-- Задачи
-- -----------------------------------------------------------------------------
create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  -- restrict: объект с задачами нельзя удалить случайно вместе со всей историей
  site_id      uuid not null references public.sites (id) on delete restrict,
  title        text not null check (char_length(btrim(title)) between 1 and 200),
  description  text not null default '' check (char_length(description) <= 5000),
  assignee_id  uuid not null references public.profiles (id) on delete restrict,
  status       public.task_status not null default 'new',
  created_by   uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.tasks is 'Задачи по объектам. Статус меняется только функцией change_task_status.';

create index tasks_site_id_idx on public.tasks (site_id);
create index tasks_assignee_id_idx on public.tasks (assignee_id);

-- -----------------------------------------------------------------------------
-- История смены статусов (журнал только на добавление)
-- -----------------------------------------------------------------------------
create table public.task_status_history (
  id           bigint generated always as identity primary key,
  task_id      uuid not null references public.tasks (id) on delete cascade,
  from_status  public.task_status,          -- null для записи о создании задачи
  to_status    public.task_status not null,
  comment      text check (comment is null or char_length(comment) between 1 and 2000),
  changed_by   uuid not null references public.profiles (id) on delete restrict,
  changed_at   timestamptz not null default now()
);
comment on table public.task_status_history is
  'Журнал смен статусов. Пишется только серверными функциями; через API доступен только на чтение.';

create index task_status_history_task_id_idx on public.task_status_history (task_id, changed_at);

-- -----------------------------------------------------------------------------
-- Матрица разрешённых переходов (единственный источник правды для БД и UI)
-- -----------------------------------------------------------------------------
create table public.task_status_transitions (
  from_status       public.task_status not null,
  to_status         public.task_status not null,
  -- executor здесь означает «назначенный исполнитель задачи», а не любой исполнитель
  actor_role        public.user_role not null,
  requires_comment  boolean not null default false,
  primary key (from_status, to_status)
);
comment on table public.task_status_transitions is
  'Разрешённые переходы статусов. Любой переход, которого нет в таблице, запрещён.';

insert into public.task_status_transitions (from_status, to_status, actor_role, requires_comment) values
  ('new',         'in_progress', 'executor', false),
  ('in_progress', 'review',      'executor', false),
  ('review',      'accepted',    'manager',  false),
  ('review',      'rework',      'manager',  true),
  ('rework',      'in_progress', 'executor', false);
