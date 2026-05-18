import { parseISO, differenceInMinutes } from 'date-fns';

export function formatDateInTimezone(
  date: Date | string,
  timezone: string,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' },
): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return new Intl.DateTimeFormat('en-CA', { ...options, timeZone: timezone }).format(d);
}

export function formatTimeInTimezone(date: Date | string, timezone: string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(d);
}

export function blockDurationMinutes(startTime: string, endTime: string): number {
  return differenceInMinutes(parseISO(endTime), parseISO(startTime));
}

export function energyScoreLabel(score: number): string {
  if (score <= 3) return 'Low';
  if (score <= 6) return 'Moderate';
  return 'High';
}

export function isActiveSubscription(status: string): boolean {
  return status === 'active' || status === 'trial';
}
