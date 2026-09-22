import { Task, Project } from '../models/project.model';

/**
 * Generates a Task Key (e.g., BIL-104, DEV-215)
 * based on Project Name and Task ID.
 */
export function getTaskKey(task: Task | null | undefined, projects?: Project[]): string {
  if (!task || !task.id) return 'DEV-100';

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

  // Generate clean 3-digit issue number (100 - 999) from task ID
  let num = 100;
  if (task.id) {
    let hash = 0;
    for (let i = 0; i < task.id.length; i++) {
      hash = (hash * 31 + task.id.charCodeAt(i)) % 899;
    }
    num = 101 + Math.abs(hash);
  }

  return `${prefix}-${num}`;
}
