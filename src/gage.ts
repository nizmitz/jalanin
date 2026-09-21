export type Parity = 'odd' | 'even';
export type Verdict = 'ok' | 'avoid' | 'off';
export const HOURS = [
  [6, 10],
  [16, 21],
] as const;
export const TZ = 'Asia/Jakarta';

export interface JakartaTime {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
  second: number;
}

const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hourCycle: 'h23',
  weekday: 'short',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});
const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function jakartaTime(d: Date): JakartaTime {
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    weekday: WD[p.weekday ?? 'Sun'] ?? 0,
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
  };
}

export function parityOfDay(day: number): Parity {
  return day % 2 === 0 ? 'even' : 'odd';
}

export function isWithinHours(t: JakartaTime): boolean {
  return HOURS.some(([a, b]) => t.hour >= a && t.hour < b);
}

export function isoDate(t: JakartaTime): string {
  const mm = String(t.month).padStart(2, '0');
  const dd = String(t.day).padStart(2, '0');
  return `${String(t.year)}-${mm}-${dd}`;
}

export type DayKind = 'weekday' | 'weekend' | 'holiday';

export function dayKind(t: JakartaTime, holidays: ReadonlySet<string>): DayKind {
  if (holidays.has(isoDate(t))) return 'holiday';
  return t.weekday >= 1 && t.weekday <= 5 ? 'weekday' : 'weekend';
}

export function isGageDay(t: JakartaTime, holidays: ReadonlySet<string>): boolean {
  return dayKind(t, holidays) === 'weekday';
}

export function isGageActive(d: Date, holidays: ReadonlySet<string>): boolean {
  const t = jakartaTime(d);
  return isGageDay(t, holidays) && isWithinHours(t);
}

export function verdict(userParity: Parity, d: Date, holidays: ReadonlySet<string>): Verdict {
  const t = jakartaTime(d);
  if (!isGageDay(t, holidays)) return 'off';
  return parityOfDay(t.day) === userParity ? 'ok' : 'avoid';
}
