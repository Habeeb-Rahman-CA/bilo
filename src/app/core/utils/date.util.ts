/**
 * Timezone-aware date utilities for Bilo tasks and calendar filters.
 * Prevents timezone offset bugs (where ISO UTC conversion shifts dates by +/-1 day)
 * and ensures cross-timezone due date consistency.
 */

export function getLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getOffsetDateString(offsetDays: number, startDate: Date = new Date()): string {
  const target = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + offsetDays);
  return getLocalDateString(target);
}

export function parseYMDDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const clean = dateStr.split('T')[0].trim();
  const parts = clean.split('-');
  if (parts.length !== 3) return null;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  const d = new Date(year, month, day);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDueDate(dateInput?: string | null): string {
  if (!dateInput || typeof dateInput !== 'string') return '';
  const d = parseYMDDate(dateInput);
  if (!d) return dateInput;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function normalizeDueDate(dueDateInput?: string | null): string | null {
  if (!dueDateInput || typeof dueDateInput !== 'string') return null;
  const clean = dueDateInput.split('T')[0].trim();
  return clean.length >= 10 ? clean.slice(0, 10) : null;
}

export function isOverdue(dueDateInput?: string | null, isCompleted: boolean = false): boolean {
  if (!dueDateInput || isCompleted) return false;
  const cleanDate = normalizeDueDate(dueDateInput);
  if (!cleanDate) return false;
  const todayStr = getLocalDateString();
  return cleanDate < todayStr;
}

export function isDueSoon(dueDateInput?: string | null, isCompleted: boolean = false, daysAhead: number = 7): boolean {
  if (!dueDateInput || isCompleted) return false;
  const taskDate = normalizeDueDate(dueDateInput);
  if (!taskDate) return false;

  const todayStr = getLocalDateString();
  const futureStr = getOffsetDateString(daysAhead);

  return taskDate >= todayStr && taskDate <= futureStr;
}

/**
 * Safely compares two task due dates for sorting.
 * Ensures unscheduled tasks (null / empty due_date) are ALWAYS placed consistently
 * at the end of the list, regardless of ascending or descending sort order.
 */
export function compareDueDates(
  aDueDate?: string | null,
  bDueDate?: string | null,
  mult: number = 1,
  aCreatedAt?: string,
  bCreatedAt?: string
): number {
  const normA = normalizeDueDate(aDueDate);
  const normB = normalizeDueDate(bDueDate);

  const hasA = normA !== null;
  const hasB = normB !== null;

  if (!hasA && !hasB) {
    const da = aCreatedAt ? new Date(aCreatedAt).getTime() : 0;
    const db = bCreatedAt ? new Date(bCreatedAt).getTime() : 0;
    return (da - db) * mult;
  }

  if (!hasA) return 1;  // Unscheduled task 'a' always comes AFTER scheduled task 'b'
  if (!hasB) return -1; // Scheduled task 'a' always comes BEFORE unscheduled task 'b'

  let diff = normA!.localeCompare(normB!);
  if (diff === 0) {
    const da = aCreatedAt ? new Date(aCreatedAt).getTime() : 0;
    const db = bCreatedAt ? new Date(bCreatedAt).getTime() : 0;
    diff = da - db;
  }

  return diff * mult;
}

