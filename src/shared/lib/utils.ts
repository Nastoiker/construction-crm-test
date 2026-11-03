import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
export function errorMessage(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    if (error.message === 'Invalid login credentials')
      return 'Неверный email или пароль.';
    if (/fetch|network/i.test(error.message))
      return 'Нет связи с сервером. Проверьте подключение и повторите.';
    return error.message;
  }
  return 'Не удалось выполнить действие. Попробуйте ещё раз.';
}
