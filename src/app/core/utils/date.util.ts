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
