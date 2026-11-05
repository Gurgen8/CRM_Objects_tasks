import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error('Не заданы VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY (см. .env.example)');
}

// Во фронтенде только публичный ключ. Все права проверяет база (RLS),
// поэтому знание этого ключа не даёт доступа к чужим данным.
export const supabase = createClient<Database>(url, publishableKey);
