import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export function formatRelativeTime(date: Date | string) {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: zhCN });
}

export function compactText(value: string, maxLength = 72) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}
