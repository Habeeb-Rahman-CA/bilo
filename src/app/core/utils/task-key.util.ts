import { Task, Project } from '../models/project.model';

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

  let prefix = 'DEV';
  if (task.project_id && projects && projects.length > 0) {
    const proj = projects.find(p => p.id === task.project_id);
    if (proj && proj.name) {
      const cleanName = proj.name.trim();
      const words = cleanName.split(/[\s-_]+/);
      if (words.length >= 2) {
        prefix = (words[0][0] + words[1][0] + (words[2]?.[0] || words[1][1] || '')).toUpperCase();
      } else {
        prefix = cleanName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();
      }
      if (prefix.length < 2) prefix = 'DEV';
    }
  }

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

  // 2. Fallback: 32-bit FNV-1a hash mapped to 4-digit number to minimize hash collision probability when allTasks is unprovided
  let hash = 2166136261;
  for (let i = 0; i < task.id.length; i++) {
    hash ^= task.id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const num = (Math.abs(hash) % 9000) + 1000;

  return `${prefix}-${num}`;
}
