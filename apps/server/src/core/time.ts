/**
 * Utilitas waktu per zona (tanpa dependensi). Kuota harian dan "hari kantor"
 * mengikuti `office.timezone` (default Asia/Jakarta), bukan UTC.
 */

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let fmt = formatterCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formatterCache.set(timeZone, fmt);
  }
  return fmt;
}

/** Zona waktu valid, atau 'UTC' bila tidak dikenal Intl. */
export function normalizeTimeZone(timeZone: string | undefined): string {
  if (!timeZone) return 'UTC';
  try {
    formatterFor(timeZone);
    return timeZone;
  } catch {
    return 'UTC';
  }
}

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const out: Record<string, number> = {};
  for (const part of formatterFor(timeZone).formatToParts(date)) {
    if (part.type !== 'literal') out[part.type] = Number(part.value);
  }
  return {
    year: out.year!,
    month: out.month!,
    day: out.day!,
    hour: out.hour! % 24,
    minute: out.minute!,
    second: out.second!,
  };
}

/** Selisih (ms) waktu lokal zona terhadap UTC pada saat `date`. */
function offsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "YYYY-MM-DD" menurut kalender zona. */
export function zonedDayKey(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Tengah malam berikutnya di zona tersebut, sebagai instan UTC. */
export function nextZonedMidnight(date: Date, timeZone: string): Date {
  const p = zonedParts(date, timeZone);
  const midnightAsUtc = Date.UTC(p.year, p.month - 1, p.day + 1, 0, 0, 0);
  const first = midnightAsUtc - offsetMs(date, timeZone);
  // Koreksi sekali bila offset berubah di tengah jalan (DST).
  return new Date(midnightAsUtc - offsetMs(new Date(first), timeZone));
}
