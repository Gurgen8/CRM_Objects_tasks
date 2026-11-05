# СтройCRM — объекты и задачи

Мини-CRM для строительной компании: постановщик ставит задачи по объектам (стройкам), исполнители берут их в работу и отдают на проверку. Каждая смена статуса записывается в историю.

**Демо:** https://crm-objects-tasks-alpha.vercel.app

| Роль        | Email                    | Пароль           |
|-------------|--------------------------|------------------|
| Постановщик | `manager@stroycrm.demo`  | `Manager-2026!`  |
| Постановщик | `manager2@stroycrm.demo` | `Manager-2026!`  |
| Исполнитель | `petrov@stroycrm.demo`   | `Executor-2026!` |
| Исполнитель | `sidorov@stroycrm.demo`  | `Executor-2026!` |

Документы для сдачи:
- [Как устроена система — для руководителя](docs/FOR_MANAGER.md)
- [Решения и допущения](docs/DECISIONS.md)

## Стек

- **Фронтенд:** React 19, TypeScript, Vite, Mantine (UI), TanStack Query (запросы и кэш), React Router.
- **Бэкенд:** Supabase — Postgres, Auth, PostgREST. Отдельного сервера нет: правила доступа и бизнес-логика статусов находятся в самой базе (RLS, функции, триггеры), поэтому их нельзя обойти запросом мимо интерфейса.

## Запуск локально

Нужны Node.js 22.18+ и Docker.

```bash
npm install
npx supabase start            # поднимает Supabase в Docker и применяет миграции
npx supabase status -o env    # здесь URL, PUBLISHABLE_KEY и SECRET_KEY

cp .env.example .env.local                  # VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
cp .env.scripts.example .env.scripts        # то же + SUPABASE_SECRET_KEY (только для скриптов)

npm run db:seed               # пользователи, 3 объекта, 7 задач во всех статусах
npm run dev                   # http://localhost:5173
npm run test:security         # 33 попытки обойти защиту — все должны быть отклонены
```

Сбросить базу до чистого состояния: `npm run db:reset && npm run db:seed`.

## Деплой

**Supabase (облако)**

1. Создать проект на supabase.com.
2. Authentication → Sign In / Providers → выключить **Allow new users to sign up**.
3. Применить миграции:
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push --remote
   ```
4. Заполнить `.env.scripts` значениями облачного проекта (Project Settings → API Keys) и выполнить `npm run db:seed`.
5. Authentication → URL Configuration → Site URL = адрес фронтенда.

**Vercel**

Импортировать репозиторий и задать переменные окружения `VITE_SUPABASE_URL` и `VITE_SUPABASE_PUBLISHABLE_KEY`. SPA-маршрутизация настроена в `vercel.json`.

## Пользователи

Регистрация закрыта. Пользователя создаёт администратор:

- **Скриптом** — добавить в `scripts/lib.ts` и выполнить `npm run db:seed` (идемпотентен).
- **Вручную в Dashboard** — Authentication → Add user. Роль по умолчанию — исполнитель. Чтобы сделать постановщиком, задать роль в `app_metadata` через Admin API или в SQL Editor:
  ```sql
  update auth.users
  set raw_app_meta_data = raw_app_meta_data || '{"role": "manager"}'
  where email = 'user@example.com';
  ```
  Триггер синхронизирует роль в `profiles`. Роль хранится именно в `app_metadata`: его может менять только администратор, а `user_metadata` пользователь меняет сам.

## Структура

```
supabase/
  migrations/
    …_schema.sql                  таблицы, типы, матрица переходов статусов
    …_functions_and_triggers.sql  смена статуса, история, проверки целостности
    …_rls_and_grants.sql          права доступа: GRANT по колонкам + RLS по строкам
  config.toml                     локальный Supabase (регистрация выключена)
scripts/
  seed.ts                         демо-данные (через API, от имени пользователей)
  security-check.ts               проверка защиты запросами в обход UI
src/
  app/                            роутинг
  components/                     общие компоненты (layout, ошибки, загрузка)
  features/
    auth/                         вход, сессия, защита маршрутов
    sites/                        объекты: API-хуки, страницы, форма
    tasks/                        задачи: API-хуки, страницы, действия, история
  lib/                            клиент Supabase, ошибки, форматирование
  types/database.ts               типы, сгенерированные из схемы (npm run db:types)
```

## Как устроена защита

| Требование | Где реализовано |
|---|---|
| Доступ по ролям на уровне БД | RLS-политики на всех таблицах (`…_rls_and_grants.sql`) |
| Исполнитель не видит и не меняет чужие задачи | политики `tasks`, `sites`, `task_status_history`, `profiles` |
| Переходы статусов проверяются базой | `change_task_status()` + таблица `task_status_transitions`; колонка `status` закрыта на запись через API, триггер `guard_task_status` — второй рубеж |
| Историю нельзя подделать, изменить или удалить | на историю выдано только право чтения; пишет её только серверная функция, автор и время берутся из сессии и `now()`; триггер запрещает UPDATE/DELETE |
| Открытая регистрация отключена | `enable_signup = false` в `config.toml` и в настройках облачного проекта |
| Секретные ключи не во фронтенде | во фронтенде только publishable key; секретный ключ — в `.env.scripts`, без префикса `VITE_`, в `.gitignore` |

Интерфейс получает список доступных кнопок у базы (`get_available_transitions`) и поэтому не может показать действие, которое база не разрешит.

## Скрипты

| Команда | Что делает |
|---|---|
| `npm run dev` | dev-сервер |
| `npm run build` | проверка типов и production-сборка |
| `npm run lint` | линтер (oxlint) |
| `npm run db:start` / `db:stop` | локальный Supabase |
| `npm run db:reset` | пересоздать локальную БД из миграций |
| `npm run db:types` | сгенерировать TypeScript-типы из схемы |
| `npm run db:seed` | демо-данные |
| `npm run test:security` | проверка защиты |
