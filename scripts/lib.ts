// Общие помощники для локальных скриптов (seed и проверка безопасности).
// Запуск: node --env-file=.env.scripts scripts/<name>.ts  (Node 22.18+ / 24)

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database.ts';

export type Client = SupabaseClient<Database>;

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Не задана переменная ${name}. Скопируйте .env.scripts.example в .env.scripts.`);
    process.exit(1);
  }
  return value;
}

export const SUPABASE_URL = env('SUPABASE_URL');
const PUBLISHABLE_KEY = env('SUPABASE_PUBLISHABLE_KEY');

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

/** Админ-клиент: обходит RLS. Используется ТОЛЬКО для создания пользователей. */
export function adminClient(): Client {
  return createClient<Database>(SUPABASE_URL, env('SUPABASE_SECRET_KEY'), noSession);
}

/** Клиент с публичным ключом — ровно то, что есть у браузера. */
export function anonClient(): Client {
  return createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, noSession);
}

/** Клиент, вошедший как конкретный пользователь — все запросы идут под RLS. */
export async function signedInClient(email: string, password: string): Promise<Client> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Вход ${email}: ${error.message}`);
  return client;
}

export const DEMO_USERS = {
  manager: {
    email: 'manager@stroycrm.demo',
    password: process.env.SEED_MANAGER_PASSWORD ?? 'Manager-2026!',
    full_name: 'Анна Смирнова',
    role: 'manager',
  },
  manager2: {
    email: 'manager2@stroycrm.demo',
    password: process.env.SEED_MANAGER_PASSWORD ?? 'Manager-2026!',
    full_name: 'Олег Кузнецов',
    role: 'manager',
  },
  executor1: {
    email: 'petrov@stroycrm.demo',
    password: process.env.SEED_EXECUTOR_PASSWORD ?? 'Executor-2026!',
    full_name: 'Иван Петров',
    role: 'executor',
  },
  executor2: {
    email: 'sidorov@stroycrm.demo',
    password: process.env.SEED_EXECUTOR_PASSWORD ?? 'Executor-2026!',
    full_name: 'Сергей Сидоров',
    role: 'executor',
  },
} as const;

export type DemoUserKey = keyof typeof DEMO_USERS;
