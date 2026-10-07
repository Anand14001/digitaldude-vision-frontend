import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  format,
  formatDistanceToNow,
  isAfter,
  isToday,
  isTomorrow,
  parseISO,
} from 'date-fns';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

const toDate = (value: string | Date | null | undefined): Date | null => {
  if (!value) return null;
  const date = typeof value === 'string' ? parseISO(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
};

export const fmtDate = (value: string | Date | null | undefined, pattern = 'dd MMM yyyy') => {
  const date = toDate(value);
  return date ? format(date, pattern) : '—';
};

export const fmtDateTime = (value: string | Date | null | undefined) =>
  fmtDate(value, 'dd MMM yyyy, h:mm a');

export const fmtRelative = (value: string | Date | null | undefined) => {
  const date = toDate(value);
  return date ? formatDistanceToNow(date, { addSuffix: true }) : '—';
};

/** Due dates read better as "Today"/"Tomorrow" than as a date. */
export const fmtDue = (value: string | Date | null | undefined) => {
  const date = toDate(value);
  if (!date) return 'No due date';
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'dd MMM');
};

export const isOverdue = (value: string | Date | null | undefined) => {
  const date = toDate(value);
  return date ? !isAfter(date, new Date()) && !isToday(date) : false;
};

/** Indian number formatting, which is what the team reads budgets in. */
export const fmtCurrency = (
  value: number | string | null | undefined,
  currency = 'INR',
) => {
  if (value === null || value === undefined || value === '') return '—';
  const amount = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(amount)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const fmtCompactCurrency = (value: number | string | null | undefined) => {
  const amount = typeof value === 'string' ? Number(value) : (value ?? 0);
  if (!amount) return '₹0';
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(1)}Cr`;
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(1)}L`;
  if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(0)}K`;
  return `₹${amount}`;
};

export const fmtNumber = (value: number | string | null | undefined, digits = 0) => {
  const amount = typeof value === 'string' ? Number(value) : value;
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
};

export const fmtHours = (value: number | string | null | undefined) => {
  const hours = typeof value === 'string' ? Number(value) : (value ?? 0);
  if (!hours) return '0h';
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  return minutes ? `${whole}h ${minutes}m` : `${whole}h`;
};

/** ENUM_VALUE -> Enum value */
export const humanise = (value: string | null | undefined) => {
  if (!value) return '—';
  const lower = value.replace(/_/g, ' ').toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

export const initials = (name: string | null | undefined) =>
  (name ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

/** Deterministic avatar colour from a name, so a person looks the same everywhere. */
export const colourFor = (seed: string) => {
  const palette = [
    'bg-indigo-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-sky-500',
    'bg-violet-500',
    'bg-teal-500',
    'bg-orange-500',
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 9973;
  return palette[hash % palette.length] as string;
};

export const toISODate = (date: Date = new Date()) => format(date, 'yyyy-MM-dd');

/** Strips empty values so they do not become `?status=` in the query string. */
export const cleanParams = <T extends Record<string, unknown>>(params: T) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  );

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const fileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
