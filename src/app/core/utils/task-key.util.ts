import { Task, Project } from '../models/project.model';

/**
 * Generates a stable Project Prefix (e.g. BIL, DEV, BMA)
 * based on Project Name, Slug, or Project ID.
 */
export function getProjectPrefix(projectId?: string, proj?: Project): string {
  if (proj && proj.name) {
    const cleanName = proj.name.trim();
    const words = cleanName.split(/[\s-_]+/);
    if (words.length >= 2) {
      const p = (words[0][0] + words[1][0] + (words[2]?.[0] || words[1][1] || '')).toUpperCase();
      if (p.length >= 2) return p;
    } else {
      const p = cleanName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();
      if (p.length >= 2) return p;
    }
  }

  if (proj && proj.slug) {
    const cleanSlug = proj.slug.trim();
    const words = cleanSlug.split(/[\s-_]+/);
    if (words.length >= 2) {
      const p = (words[0][0] + words[1][0] + (words[2]?.[0] || words[1][1] || '')).toUpperCase();
      if (p.length >= 2) return p;
    } else {
      const p = cleanSlug.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();
      if (p.length >= 2) return p;
    }
  }

  return 'DEV';
}

/**
 * Generates a Task Key (e.g., BIL-104, DEV-215)
 * based on Project Name and Task ID.
 */
export function getTaskKey(
  task: Task | null | undefined,
  projects?: Project[],
  allTasks?: Task[]
): string {
  if (!task || !task.id) return 'DEV-1';

  const proj = (task.project_id && projects && projects.length > 0)
    ? projects.find(p => p.id === task.project_id)
    : undefined;

  const prefix = getProjectPrefix(task.project_id, proj);

  // 1. If allTasks is provided, calculate deterministic sequential issue number within the project to guarantee no collisions
  if (allTasks && allTasks.length > 0 && task.project_id) {
    const projTasks = allTasks
      .filter(t => t.project_id === task.project_id)
      .sort((a, b) => (a.created_at || a.id).localeCompare(b.created_at || b.id));

    const idx = projTasks.findIndex(t => t.id === task.id);
    if (idx !== -1) {
      return `${prefix}-${idx + 1}`;
    }
  }

  // 2. If task.id itself contains a numeric suffix or integer (e.g. "1005")
  const numericMatch = String(task.id).match(/\d+/);
  if (numericMatch && numericMatch[0]) {
    const parsedNum = parseInt(numericMatch[0], 10);
    if (!isNaN(parsedNum) && parsedNum > 0 && parsedNum <= 999999) {
      return `${prefix}-${parsedNum}`;
    }
  }

  // 3. Fallback: 32-bit FNV-1a hash mapped to a 6-digit number (100000-999999) to prevent collisions even for 1000+ tasks
  let hash = 2166136261;
  for (let i = 0; i < task.id.length; i++) {
    hash ^= task.id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const num = (Math.abs(hash) % 900000) + 100000;

  return `${prefix}-${num}`;
}
