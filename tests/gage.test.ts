import { describe, expect, it } from 'vitest';
import {
  dayKind,
  isGageActive,
  isWithinHours,
  jakartaTime,
  parityOfDay,
  verdict,
} from '../src/gage';

const none = new Set<string>();
const wib = (iso: string) => new Date(`${iso}+07:00`);

describe('jakartaTime', () => {
  it('uses Jakarta time not device time', () => {
    // Pin the process to a non-WIB zone; Node re-reads TZ on assignment.
    const prev = process.env.TZ;
    process.env.TZ = 'America/New_York';
    try {
      const d = new Date('2026-09-21T02:30:00Z'); // 09:30 WIB, 22:30 previous day in New York
      expect(d.getHours()).toBe(22); // proves the device zone really changed
      expect(jakartaTime(d)).toMatchObject({ day: 21, hour: 9, minute: 30, weekday: 1 });
      expect(isGageActive(d, none)).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.TZ;
      else process.env.TZ = prev;
    }
  });
});

describe('parityOfDay', () => {
  it('odd/even', () => {
    expect(parityOfDay(21)).toBe('odd');
    expect(parityOfDay(22)).toBe('even');
  });
});

describe('isWithinHours', () => {
  it('hour boundaries exclusive at end', () => {
    expect(isWithinHours(jakartaTime(wib('2026-09-21T05:59:59')))).toBe(false);
    expect(isWithinHours(jakartaTime(wib('2026-09-21T06:00:00')))).toBe(true);
    expect(isWithinHours(jakartaTime(wib('2026-09-21T09:59:59')))).toBe(true);
    expect(isWithinHours(jakartaTime(wib('2026-09-21T10:00:00')))).toBe(false);
    expect(isWithinHours(jakartaTime(wib('2026-09-21T16:00:00')))).toBe(true);
    expect(isWithinHours(jakartaTime(wib('2026-09-21T20:59:59')))).toBe(true);
    expect(isWithinHours(jakartaTime(wib('2026-09-21T21:00:00')))).toBe(false);
  });
});

describe('isGageActive', () => {
  it('weekday in hours', () => {
    expect(isGageActive(wib('2026-09-21T08:00:00'), none)).toBe(true);
  });
  it('weekend', () => {
    expect(isGageActive(wib('2026-09-20T08:00:00'), none)).toBe(false);
  });
  it('holiday', () => {
    expect(isGageActive(wib('2026-09-21T08:00:00'), new Set(['2026-09-21']))).toBe(false);
  });
  it('midday gap', () => {
    expect(isGageActive(wib('2026-09-21T12:00:00'), none)).toBe(false);
  });
});

describe('verdict', () => {
  it('31st then 1st both odd', () => {
    // Tue 31 Mar → Wed 1 Apr 2026: consecutive weekdays, both odd.
    expect(verdict('odd', wib('2026-03-31T08:00:00'), none)).toBe('ok');
    expect(verdict('odd', wib('2026-04-01T08:00:00'), none)).toBe('ok');
    expect(verdict('even', wib('2026-03-31T08:00:00'), none)).toBe('avoid');
    expect(verdict('even', wib('2026-04-01T08:00:00'), none)).toBe('avoid');
  });
  it('off on weekend regardless of parity', () => {
    expect(verdict('even', wib('2026-09-19T08:00:00'), none)).toBe('off');
  });
  it('verdict independent of hour (day-level), activity is hour-level', () => {
    expect(verdict('odd', wib('2026-09-21T12:00:00'), none)).toBe('ok');
  });
});

describe('dayKind', () => {
  it('holiday beats weekday, weekend otherwise', () => {
    expect(dayKind(jakartaTime(wib('2026-08-17T08:00:00')), new Set(['2026-08-17']))).toBe(
      'holiday',
    );
    expect(dayKind(jakartaTime(wib('2026-08-17T08:00:00')), none)).toBe('weekday');
    expect(dayKind(jakartaTime(wib('2026-09-20T08:00:00')), none)).toBe('weekend');
  });
});
