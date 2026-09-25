import { Task, Project, Workflow, ProjectActivity, TaskType, TaskPriority } from '../models/project.model';
import { sanitizeLabels } from './label.util';

/**
 * Validates and sanitizes a raw task object to enforce strict runtime type safety.
 * Protects against application crashes caused by corrupt imported data or malformed JSON payloads.
 */
export function validateAndSanitizeTask(raw: any): Task | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  // Sanitize ID
  let id = typeof raw.id === 'string' ? raw.id.trim() : typeof raw.id === 'number' ? String(raw.id) : '';
  if (!id) {
    id = `task-recovered-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  }

  // Sanitize Title
  let title = typeof raw.title === 'string' ? raw.title.trim() : typeof raw.title === 'number' ? String(raw.title) : 'Untitled Task';
  if (!title) {
    title = 'Untitled Task';
  }

  // Sanitize Status
  let status = typeof raw.status === 'string' ? raw.status.trim() : 'Backlog';
  if (!status) {
    status = 'Backlog';
  }

  // Sanitize Priority
  const validPriorities: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];
  let priority: TaskPriority = typeof raw.priority === 'string' ? (raw.priority.toLowerCase().trim() as TaskPriority) : 'medium';
  if (!validPriorities.includes(priority)) {
    priority = 'medium';
  }

  // Sanitize Task Type
  const validTypes: TaskType[] = ['story', 'bug', 'task', 'epic'];
  let type: TaskType = typeof raw.type === 'string' ? (raw.type.toLowerCase().trim() as TaskType) : 'task';
  if (!validTypes.includes(type)) {
    type = 'task';
  }

  // Sanitize Completed
  let completed = false;
  if (typeof raw.completed === 'boolean') {
    completed = raw.completed;
  } else if (typeof raw.completed === 'string') {
    completed = raw.completed.toLowerCase().trim() === 'true';
  } else if (status.toLowerCase() === 'done' || status.toLowerCase() === 'completed') {
    completed = true;
  }

  // Sanitize Labels
  let rawLabels: string[] = [];
  if (Array.isArray(raw.labels)) {
    rawLabels = raw.labels.filter((l: any) => typeof l === 'string' || typeof l === 'number').map((l: any) => String(l));
  } else if (typeof raw.labels === 'string' && raw.labels.trim()) {
    rawLabels = raw.labels.split(',').map((s: string) => s.trim()).filter(Boolean);
  }
  const labels = sanitizeLabels(rawLabels);

  // Sanitize Numbers
  let estimated_hours: number | undefined;
  if (typeof raw.estimated_hours === 'number' && !isNaN(raw.estimated_hours) && raw.estimated_hours >= 0) {
    estimated_hours = raw.estimated_hours;
  } else if (typeof raw.estimated_hours === 'string') {
    const parsed = parseFloat(raw.estimated_hours);
    if (!isNaN(parsed) && parsed >= 0) estimated_hours = parsed;
  }

  let logged_hours: number | undefined;
  if (typeof raw.logged_hours === 'number' && !isNaN(raw.logged_hours) && raw.logged_hours >= 0) {
    logged_hours = raw.logged_hours;
  } else if (typeof raw.logged_hours === 'string') {
    const parsed = parseFloat(raw.logged_hours);
    if (!isNaN(parsed) && parsed >= 0) logged_hours = parsed;
  }

  let position = typeof raw.position === 'number' && !isNaN(raw.position) ? raw.position : 0;
  let is_next = typeof raw.is_next === 'boolean' ? raw.is_next : false;

  // Sanitize Dates
  const now = new Date().toISOString();
  let created_at = typeof raw.created_at === 'string' && !isNaN(Date.parse(raw.created_at)) ? raw.created_at : now;
  let updated_at = typeof raw.updated_at === 'string' && !isNaN(Date.parse(raw.updated_at)) ? raw.updated_at : created_at;

  let due_date: string | undefined;
  if (typeof raw.due_date === 'string' && !isNaN(Date.parse(raw.due_date))) {
    due_date = raw.due_date;
  }

  let project_id: string = typeof raw.project_id === 'string' && raw.project_id.trim() ? raw.project_id.trim() : 'global';
  let workflow_id: string | undefined = typeof raw.workflow_id === 'string' ? raw.workflow_id.trim() : undefined;
  let user_id: string | undefined = typeof raw.user_id === 'string' ? raw.user_id.trim() : undefined;

  return {
    id,
    project_id,
    workflow_id,
    user_id,
    title,
    description: typeof raw.description === 'string' ? raw.description : '',
    type,
    status,
    priority,
    labels,
    due_date,
    estimated_hours,
    logged_hours,
    position,
    is_next,
    completed,
    created_at,
    updated_at
  };
}

/**
 * Validates and sanitizes a raw project object.
 */
export function validateAndSanitizeProject(raw: any): Project | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  let id = typeof raw.id === 'string' ? raw.id.trim() : typeof raw.id === 'number' ? String(raw.id) : '';
  if (!id) {
    id = `proj-recovered-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  }

  let name = typeof raw.name === 'string' ? raw.name.trim() : 'Untitled Project';
  if (!name) {
    name = 'Untitled Project';
  }

  let slug = typeof raw.slug === 'string' && raw.slug.trim() ? raw.slug.trim() : name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const validStatus = ['active', 'archived', 'completed'];
  let status: 'active' | 'archived' | 'completed' = typeof raw.status === 'string' && validStatus.includes(raw.status.toLowerCase().trim())
    ? (raw.status.toLowerCase().trim() as any)
    : 'active';

  let rawLabels: string[] = [];
  if (Array.isArray(raw.labels)) {
    rawLabels = raw.labels.filter((l: any) => typeof l === 'string').map(String);
  }
  const labels = sanitizeLabels(rawLabels);

  let color = typeof raw.color === 'string' && /^#[0-9a-fA-F]{3,6}$/.test(raw.color.trim()) ? raw.color.trim() : '#3b82f6';
  const now = new Date().toISOString();
  let created_at = typeof raw.created_at === 'string' && !isNaN(Date.parse(raw.created_at)) ? raw.created_at : now;
  let updated_at = typeof raw.updated_at === 'string' && !isNaN(Date.parse(raw.updated_at)) ? raw.updated_at : created_at;

  return {
    id,
    name,
    slug,
    status,
    labels,
    description: typeof raw.description === 'string' ? raw.description : '',
    color,
    icon: typeof raw.icon === 'string' ? raw.icon : undefined,
    user_id: typeof raw.user_id === 'string' ? raw.user_id : undefined,
    created_at,
    updated_at
  };
}

/**
 * Validates and sanitizes a raw workflow object.
 */
export function validateAndSanitizeWorkflow(raw: any): Workflow | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  let id = typeof raw.id === 'string' ? raw.id.trim() : '';
  if (!id) return null;

  let project_id = typeof raw.project_id === 'string' ? raw.project_id.trim() : 'global';
  let name = typeof raw.name === 'string' ? raw.name.trim() : 'Column';
  if (!name) name = 'Column';

  let color = typeof raw.color === 'string' && /^#[0-9a-fA-F]{3,6}$/.test(raw.color.trim()) ? raw.color.trim() : '#64748b';
  let position = typeof raw.position === 'number' && !isNaN(raw.position) ? raw.position : 0;
  const now = new Date().toISOString();
  let created_at = typeof raw.created_at === 'string' && !isNaN(Date.parse(raw.created_at)) ? raw.created_at : now;

  return {
    id,
    project_id,
    name,
    color,
    position,
    allow_all_transitions: raw.allow_all_transitions !== false,
    allowed_transitions: Array.isArray(raw.allowed_transitions)
      ? raw.allowed_transitions.filter((t: any) => typeof t === 'string')
      : [],
    created_at
  };
}

/**
 * Parse and deeply validate imported JSON payload data structures AND field types.
 */
export function validateAndSanitizeImportData(input: string | object): {
  tasks: Task[];
  projects: Project[];
  workflows: Workflow[];
  activities: ProjectActivity[];
  errors: string[];
} {
  const errors: string[] = [];
  let parsed: any = input;

  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input);
    } catch (e: any) {
      return {
        tasks: [],
        projects: [],
        workflows: [],
        activities: [],
        errors: [`Invalid JSON format: ${e.message || 'Syntax error'}`]
      };
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      tasks: [],
      projects: [],
      workflows: [],
      activities: [],
      errors: ['Import payload must be a JSON object or array']
    };
  }

  const resultTasks: Task[] = [];
  const resultProjects: Project[] = [];
  const resultWorkflows: Workflow[] = [];
  const resultActivities: ProjectActivity[] = [];

  // Handle direct task array import
  if (Array.isArray(parsed)) {
    parsed.forEach((item: any, index: number) => {
      const sanitized = validateAndSanitizeTask(item);
      if (sanitized) {
        resultTasks.push(sanitized);
      } else {
        errors.push(`Item at index ${index} is not a valid task record.`);
      }
    });
    return { tasks: resultTasks, projects: resultProjects, workflows: resultWorkflows, activities: resultActivities, errors };
  }

  // Handle payload containing tasks array
  if (Array.isArray(parsed.tasks)) {
    parsed.tasks.forEach((t: any, index: number) => {
      const sanitized = validateAndSanitizeTask(t);
      if (sanitized) {
        resultTasks.push(sanitized);
      } else {
        errors.push(`Task at index ${index} has invalid field types and was skipped.`);
      }
    });
  }

  // Handle payload containing projects array
  if (Array.isArray(parsed.projects)) {
    parsed.projects.forEach((p: any, index: number) => {
      const sanitized = validateAndSanitizeProject(p);
      if (sanitized) {
        resultProjects.push(sanitized);
      } else {
        errors.push(`Project at index ${index} has invalid field types and was skipped.`);
      }
    });
  }

  // Handle payload containing workflows array
  if (Array.isArray(parsed.workflows)) {
    parsed.workflows.forEach((w: any, index: number) => {
      const sanitized = validateAndSanitizeWorkflow(w);
      if (sanitized) {
        resultWorkflows.push(sanitized);
      } else {
        errors.push(`Workflow at index ${index} has invalid field types and was skipped.`);
      }
    });
  }

  // Handle payload containing activities array
  if (Array.isArray(parsed.activities)) {
    parsed.activities.forEach((a: any) => {
      if (a && typeof a === 'object' && typeof a.id === 'string' && typeof a.project_id === 'string') {
        const timestamp = typeof a.timestamp === 'string' && !isNaN(Date.parse(a.timestamp))
          ? a.timestamp
          : typeof a.created_at === 'string' && !isNaN(Date.parse(a.created_at))
          ? a.created_at
          : new Date().toISOString();

        resultActivities.push({
          id: a.id,
          project_id: a.project_id,
          user_id: typeof a.user_id === 'string' ? a.user_id : undefined,
          action: typeof a.action === 'string' ? a.action : 'activity',
          description: typeof a.description === 'string' ? a.description : '',
          timestamp
        });
      }
    });
  }

  return {
    tasks: resultTasks,
    projects: resultProjects,
    workflows: resultWorkflows,
    activities: resultActivities,
    errors
  };
}
