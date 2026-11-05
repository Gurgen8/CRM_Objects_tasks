// Перевод ошибок Supabase/Postgres в понятные пользователю сообщения.

interface ErrorLike {
  message?: string;
  code?: string;
}

const CYRILLIC = /[а-яё]/i;

const BY_CODE: Record<string, string> = {
  '23503': 'Действие невозможно: есть связанные данные. Например, в объекте ещё есть задачи.',
  '23514': 'Проверьте правильность заполнения полей.',
  '42501': 'Недостаточно прав для этого действия.',
  P0002: 'Запись не найдена или у вас нет к ней доступа.',
  PGRST116: 'Запись не найдена или у вас нет к ней доступа.',
};

const AUTH_MESSAGES: Record<string, string> = {
  'Invalid login credentials': 'Неверный email или пароль.',
  'Email not confirmed': 'Email не подтверждён.',
};

export function getErrorMessage(error: unknown): string {
  if (!error) return 'Неизвестная ошибка';
  const { message = '', code = '' } = error as ErrorLike;

  // Сообщения из наших функций в БД уже написаны по-русски
  if (CYRILLIC.test(message)) return message;
  if (AUTH_MESSAGES[message]) return AUTH_MESSAGES[message];
  if (BY_CODE[code]) return BY_CODE[code];
  if (message.includes('Failed to fetch')) return 'Нет соединения с сервером.';
  return 'Что-то пошло не так. Попробуйте ещё раз.';
}
