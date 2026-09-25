import { describe, it, expect } from 'vitest';
import { getLocalDateString, getOffsetDateString, parseYMDDate, formatDueDate, isOverdue, normalizeDueDate, isDueSoon } from './date.util';

describe('Date Utilities', () => {
  it('should return YYYY-MM-DD in local time without UTC offset shifting', () => {
    const testDate = new Date(2026, 8, 25, 22, 30, 0); // Sept 25, 2026 10:30 PM local
    expect(getLocalDateString(testDate)).toBe('2026-09-25');
  });

  it('should calculate offset dates accurately in local timezone', () => {
    const testDate = new Date(2026, 8, 25); // Sept 25, 2026
    expect(getOffsetDateString(1, testDate)).toBe('2026-09-26');
    expect(getOffsetDateString(7, testDate)).toBe('2026-10-02');
  });

  it('should parse YYYY-MM-DD dates without date-shifting', () => {
    const parsed = parseYMDDate('2026-09-25');
    expect(parsed).not.toBeNull();
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(8);
    expect(parsed?.getDate()).toBe(25);
  });

  it('should format due date into user-friendly string', () => {
    expect(formatDueDate('2026-09-25')).toBe('Sep 25, 2026');
    expect(formatDueDate('')).toBe('');
  });

  it('should evaluate overdue state in local date space', () => {
    const yesterdayStr = getOffsetDateString(-1);
    const tomorrowStr = getOffsetDateString(1);

    expect(isOverdue(yesterdayStr, false)).toBe(true);
    expect(isOverdue(yesterdayStr, true)).toBe(false); // Completed tasks are not overdue
    expect(isOverdue(tomorrowStr, false)).toBe(false);
  });

  it('should normalize ISO timestamp due dates to local YYYY-MM-DD', () => {
    expect(normalizeDueDate('2026-09-25T18:30:00Z')).toBe('2026-09-25');
    expect(normalizeDueDate('2026-09-25')).toBe('2026-09-25');
    expect(normalizeDueDate(null)).toBeNull();
  });

  it('should evaluate isDueSoon accurately for upcoming tasks', () => {
    const todayStr = getLocalDateString();
    const in3DaysStr = getOffsetDateString(3);
    const in10DaysStr = getOffsetDateString(10);
    const yesterdayStr = getOffsetDateString(-1);

    expect(isDueSoon(todayStr, false, 7)).toBe(true);
    expect(isDueSoon(in3DaysStr, false, 7)).toBe(true);
    expect(isDueSoon(in10DaysStr, false, 7)).toBe(false);
    expect(isDueSoon(yesterdayStr, false, 7)).toBe(false); // Overdue, not due soon
    expect(isDueSoon(todayStr, true, 7)).toBe(false); // Completed task
  });
});
