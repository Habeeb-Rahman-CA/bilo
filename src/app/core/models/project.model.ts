export type TaskType = 'story' | 'bug' | 'task' | 'epic';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskSeverity = 'critical' | 'major' | 'minor' | 'trivial';
export type TaskReproducibility = 'always' | 'often' | 'sometimes' | 'rarely' | 'unable';

export type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface UserProfile {
  id: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
  created_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectRole;
  user_email?: string;
  created_at: string;
}

export interface Workflow {
  id: string;
  project_id: string;
  user_id?: string;
  name: string;
  color: string;
  position: number;
  created_at: string;
}

export interface Project {
  id: string;
  user_id?: string;
  name: string;
  slug: string;
  description?: string;
  repository_url?: string;
  status: 'active' | 'archived' | 'completed';
  labels: string[];
  color: string;
  image_url?: string;
  icon?: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectActivity {
  id: string;
  project_id: string;
  user_id?: string;
  action: string;
  description: string;
  timestamp: string;
}

export interface Task {
  id: string;
  project_id: string;
  workflow_id?: string;
  user_id?: string;
  title: string;
  description?: string;
  type: TaskType;
  status: string; // Workflow column name or workflow_id
  priority: TaskPriority;
  severity?: TaskSeverity;
  reproducibility?: TaskReproducibility;
  reporter?: string;
  labels?: string[];
  assignee?: string;
  due_date?: string;
  attachments?: string[];
  position: number;
  is_next: boolean;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id?: string;
  author_name: string;
  content: string;
  created_at: string;
  updated_at?: string;
}

export interface TaskStatusHistory {
  id: string;
  task_id: string;
  user_id?: string;
  from_status?: string;
  to_status: string;
  changed_by?: string;
  created_at: string;
}
