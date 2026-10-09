import type { CalendarConfig } from '../types';

export const DAY_MS = 86_400_000;
/** reference date for working-day indexes (any fixed date works) */
export const EPOCH = '2000-01-01';

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTHS_ID_LONG = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];
const DAYS_ID_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const DAYS_ID_LONG = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export function parseISO(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isValidISO(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_RE.test(value)) return false;
  const date = parseISO(value);
  if (Number.isNaN(date.getTime())) return false;
  return toISO(date) === value;
}

export function addDays(iso: string, days: number): string {
  return toISO(new Date(parseISO(iso).getTime() + days * DAY_MS));
}

/** days from `from` to `to` (to - from) in calendar days */
export function dayDiff(from: string, to: string): number {
  return Math.round((parseISO(to).getTime() - parseISO(from).getTime()) / DAY_MS);
}

export function todayISO(): string {
  const now = new Date();
  return toISO(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

export function getWeekendDays(cal: CalendarConfig): number[] {
  return [...new Set(cal.weekendDays)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
}

export function isWeekendDay(iso: string, cal: CalendarConfig): boolean {
  return cal.weekendDays.includes(parseISO(iso).getUTCDay());
}

export function isHoliday(iso: string, cal: CalendarConfig): boolean {
  return cal.holidays.some((h) => h.date === iso);
}

export function isWorkingDay(iso: string, cal: CalendarConfig): boolean {
  return !isWeekendDay(iso, cal) && !isHoliday(iso, cal);
}

/** strictly the next working day after `iso` */
export function nextWorkingDay(iso: string, cal: CalendarConfig): string {
  let cursor = addDays(iso, 1);
  let guard = 0;
  while (!isWorkingDay(cursor, cal) && guard < 400) {
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return cursor;
}

/** strictly the previous working day before `iso` */
export function previousWorkingDay(iso: string, cal: CalendarConfig): string {
  let cursor = addDays(iso, -1);
  let guard = 0;
  while (!isWorkingDay(cursor, cal) && guard < 400) {
    cursor = addDays(cursor, -1);
    guard += 1;
  }
  return cursor;
}

interface CalCache {
  /** sorted ISO dates of every working day from the epoch onwards */
  list: string[];
  /** last examined date while extending the list */
  cursor: string;
  /** true when the calendar has no working days at all (degenerate config) */
  degenerate: boolean;
}

const cache = new Map<string, CalCache>();

function calendarKey(cal: CalendarConfig): string {
  const weekend = getWeekendDays(cal).join(',');
  const holidays = cal.holidays
    .map((h) => h.date)
    .slice()
    .sort()
    .join(',');
  return `${weekend}|${holidays}`;
}

function getCache(cal: CalendarConfig): CalCache {
  const key = calendarKey(cal);
  const existing = cache.get(key);
  if (existing) return existing;

  let first: string | null = null;
  let cursor = EPOCH;
  for (let i = 0; i < 8; i += 1) {
    if (isWorkingDay(cursor, cal)) {
      first = cursor;
      break;
    }
    cursor = addDays(cursor, 1);
  }
  const entry: CalCache = first
    ? { list: [first], cursor: first, degenerate: false }
    : { list: [], cursor, degenerate: true };
  cache.set(key, entry);
  return entry;
}

function extendToDate(cal: CalendarConfig, entry: CalCache, until: string): void {
  if (entry.degenerate || entry.cursor >= until) return;
  let cursor = entry.cursor;
  while (cursor < until) {
    cursor = addDays(cursor, 1);
    if (isWorkingDay(cursor, cal)) entry.list.push(cursor);
  }
  entry.cursor = cursor;
}

function extendToIndex(cal: CalendarConfig, entry: CalCache, index: number): void {
  if (entry.degenerate) return;
  let cursor = entry.cursor;
  while (entry.list.length <= index) {
    cursor = addDays(cursor, 1);
    if (isWorkingDay(cursor, cal)) entry.list.push(cursor);
    if (dayDiff(EPOCH, cursor) > 40_000) break; // hard safety net (~110 years)
  }
  entry.cursor = cursor;
}

/** first index i where list[i] >= value */
function lowerBound(list: string[], value: string): number {
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Working-day index of `iso`: number of working days strictly before it.
 * A non-working date therefore maps to the next working day (snap forward).
 */
export function dateToIndex(iso: string, cal: CalendarConfig): number {
  const entry = getCache(cal);
  extendToDate(cal, entry, iso);
  return lowerBound(entry.list, iso);
}

/** Index of the last working day on or before `iso` (-1 when before the epoch). */
export function lastWorkingIndexOnOrBefore(iso: string, cal: CalendarConfig): number {
  return dateToIndex(addDays(iso, 1), cal) - 1;
}

/** ISO date of the working day with the given index (clamped at the epoch). */
export function indexToDate(index: number, cal: CalendarConfig): string {
  const entry = getCache(cal);
  if (entry.degenerate) return EPOCH;
  const wanted = Math.max(0, Math.floor(index));
  extendToIndex(cal, entry, wanted);
  if (entry.list.length === 0) return EPOCH;
  return entry.list[Math.min(wanted, entry.list.length - 1)];
}

/** number of working days in the inclusive range [start, end] */
export function workingDaysInclusive(start: string, end: string, cal: CalendarConfig): number {
  if (end < start) return 0;
  return Math.max(0, lastWorkingIndexOnOrBefore(end, cal) - dateToIndex(start, cal) + 1);
}

/** `iso` shifted by `days` working days (0 keeps the same working day) */
export function addWorkingDays(iso: string, days: number, cal: CalendarConfig): string {
  return indexToDate(dateToIndex(iso, cal) + days, cal);
}

export function formatDateID(iso: string): string {
  const d = parseISO(iso);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${dd} ${MONTHS_ID[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatFullDateID(iso: string): string {
  const d = parseISO(iso);
  return `${DAYS_ID_SHORT[d.getUTCDay()]}, ${formatDateID(iso)}`;
}

export function formatMonthYear(iso: string): string {
  const d = parseISO(iso);
  return `${MONTHS_ID_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatMonthShort(iso: string): string {
  return MONTHS_ID[parseISO(iso).getUTCMonth()];
}

export function formatDayName(iso: string): string {
  return DAYS_ID_LONG[parseISO(iso).getUTCDay()];
}

export function weekdayName(dayNumber: number): string {
  return DAYS_ID_LONG[dayNumber] ?? '';
}

/** first day of the month containing `iso` */
export function startOfMonth(iso: string): string {
  const d = parseISO(iso);
  return toISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
}

/** first day of the month after the month containing `iso` */
export function startOfNextMonth(iso: string): string {
  const d = parseISO(iso);
  return toISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)));
}
