# bilo - Technical API & Data Specification

## 1. Executive Overview

This document serves as the complete technical API reference for **bilo**, detailing Angular state signals, service method signatures, utility functions, offline sync mechanisms, and backend Supabase PostgreSQL database schemas with Row-Level Security (RLS).

---

## 2. Core Angular Services Reference

### 2.1 TaskService
`src/app/core/services/task.service.ts`

Manages task items, subtasks, task comments, priority levels, status transitions, and local caching.

#### Reactive Signals
| Signal | Type | Description |
| :--- | :--- | :--- |
| `tasks` | `Signal<Task[]>` | Reactive list of all user tasks. |
| `taskComments` | `Signal<Record<string, TaskComment[]>>` | Map of task ID to associated discussion comments. |
| `taskStatusHistory` | `Signal<Record<string, TaskStatusHistory[]>>` | Status audit log map per task ID. |
| `loading` | `Signal<boolean>` | True when fetching tasks from Supabase. |

#### Methods Signature
```typescript
class TaskService {
  normalizeTaskStatuses(tasks: Task[]): { normalized: Task[]; hasChanges: boolean };
  loadFromStorage(): void;
  loadTasksFromSupabase(): Promise<void>;
  createTask(taskData: Partial<Task>): Promise<Task>;
  updateTask(taskId: string, updates: Partial<Task>): Promise<Task | null>;
  deleteTask(taskId: string): Promise<void>;
  toggleTaskCompletion(taskId: string): Promise<Task | null>;
  reorderTasks(projectId: string, workflowId: string, orderedTasks: Task[]): Promise<void>;
  addComment(taskId: string, content: string): Promise<TaskComment | null>;
  resetState(): void;
}
```

---

### 2.2 ProjectService
`src/app/core/services/project.service.ts`

Manages project workspaces, user roles, workspace members, activity streams, and active workspace selection.

#### Reactive Signals
| Signal | Type | Description |
| :--- | :--- | :--- |
| `projects` | `Signal<Project[]>` | Reactive list of accessible projects. |
| `activeProject` | `Signal<Project | null>` | Currently active selected project. |
| `activities` | `Signal<ProjectActivity[]>` | Activity history stream items. |
| `explicitBoardProjectId` | `Signal<string | null>` | Override project ID for Kanban board filtering. |
| `loading` | `Signal<boolean>` | True during remote data loading. |

#### Methods Signature
```typescript
class ProjectService {
  loadFromStorage(): void;
  loadFromSupabase(): Promise<void>;
  createProject(name: string, description?: string, color?: string): Promise<Project>;
  updateProject(projectId: string, updates: Partial<Project>): Promise<Project | null>;
  deleteProject(projectId: string): Promise<void>;
  setActiveProject(project: Project | null): void;
  joinProjectViaInvite(projectId: string, role: ProjectRole): Promise<Project | null>;
  fetchProjectById(projectId: string): Promise<Project | null>;
  resetState(): void;
}
```

---

### 2.3 WorkflowService
`src/app/core/services/workflow.service.ts`

Manages custom project status columns, column colors, transition constraints, and board position ordering.

#### Reactive Signals
| Signal | Type | Description |
| :--- | :--- | :--- |
| `workflowsByProject` | `Signal<Record<string, Workflow[]>>` | Map of project IDs to ordered workflow stages. |
| `globalWorkflows` | `Signal<Workflow[]>` | Fallback global workflows array. |
| `loading` | `Signal<boolean>` | Loading state indicator. |

#### Methods Signature
```typescript
class WorkflowService {
  getWorkflowsForProject(projectId?: string): Workflow[];
  createWorkflow(projectId: string, name: string, color?: string): Promise<Workflow>;
  updateWorkflow(id: string, updates: Partial<Workflow>, projectId?: string): Promise<Workflow | null>;
  deleteWorkflow(id: string, projectId?: string): Promise<void>;
  updateWorkflowPositions(projectId: string, orderedWorkflows: Workflow[]): Promise<void>;
  resetToDefaultWorkflows(projectId: string): Promise<Workflow[]>;
  canTransition(fromStatusNameOrId: string, toStatusNameOrId: string, projectId?: string): boolean;
  updateWorkflowTransitions(projectId: string, workflowId: string, allowAll: boolean, allowed: string[]): Promise<void>;
  resetToSequentialPipeline(projectId: string): Promise<void>;
  allowAllTransitionsForProject(projectId: string): Promise<void>;
}
```

---

### 2.4 AuthService
`src/app/core/services/auth.service.ts`

Handles Supabase Authentication, user sessions, magic links, display names, and user profiles.

#### Reactive Signals
| Signal | Type | Description |
| :--- | :--- | :--- |
| `user` | `Signal<User | null>` | Currently logged-in Supabase user. |
| `session` | `Signal<Session | null>` | Active auth session object. |
| `isAuthenticated` | `Signal<boolean>` | Computed signal returning true if user is signed in. |
| `userEmail` | `Signal<string>` | User email address string. |
| `userName` | `Signal<string>` | Display name or email prefix. |
| `userAvatar` | `Signal<string | null>` | Profile image URL string. |

#### Methods Signature
```typescript
class AuthService {
  signInWithEmailPassword(email: string, password: string): Promise<AuthResponse>;
  signUpWithEmailPassword(email: string, password: string): Promise<AuthResponse>;
  signInWithMagicLink(email: string): Promise<AuthOtpResponse>;
  signOut(): Promise<void>;
  updateProfile(updates: { display_name?: string; avatar_url?: string | null }): Promise<void>;
  claimUnassignedData(): Promise<void>;
}
```

---

### 2.5 WorkspaceService
`src/app/core/services/workspace.service.ts`

Manages global workspace section navigation, modal overlays, and keyboard shortcut event handlers.

#### Reactive Signals
| Signal | Type | Description |
| :--- | :--- | :--- |
| `activeWorkspace` | `Signal<WorkspaceSection>` | Current workspace section (`'01 TODAY'`, `'02 BACKLOG'`, `'03 TASKS'`, `'04 CALENDAR'`, `'05 ARCHIVE'`, `'06 SETTINGS'`). |
| `commandPaletteOpen` | `Signal<boolean>` | Command Palette modal visibility. |
| `shortcutsModalOpen` | `Signal<boolean>` | Keyboard Shortcuts modal visibility. |
| `globalCreateTaskModalOpen` | `Signal<boolean>` | Quick Task modal visibility. |
| `reportIssueModalOpen` | `Signal<boolean>` | Feedback modal visibility. |

#### Methods Signature
```typescript
class WorkspaceService {
  setWorkspace(workspace: WorkspaceSection, updateHash?: boolean): void;
  toggleCommandPalette(): void;
  toggleShortcutsModal(): void;
  openCreateTaskModal(): void;
  closeCreateTaskModal(): void;
  openReportIssueModal(): void;
  closeReportIssueModal(): void;
}
```

---

### 2.6 TaskShareService
`src/app/core/services/task-share.service.ts`

Handles generating share URLs, task key matching, and displaying toast feedback messages.

#### Reactive Signals
| Signal | Type | Description |
| :--- | :--- | :--- |
| `toastMessage` | `Signal<string | null>` | Active toast message string. |
| `activeSharedTask` | `Signal<Task | null>` | Shared task detail modal payload. |

#### Methods Signature
```typescript
class TaskShareService {
  copyTaskShareLink(task: Task, event?: Event): Promise<string>;
  showToast(msg: string): void;
  checkUrlForTaskParam(): void;
  openTaskByParam(param: string): boolean;
  closeSharedTaskModal(): void;
}
```

---

### 2.7 SyncService
`src/app/core/services/sync.service.ts`

Monitors offline/online network status and manages the offline mutation retry queue.

#### Reactive Signals
| Signal | Type | Description |
| :--- | :--- | :--- |
| `isOnline` | `Signal<boolean>` | True when network connection is active. |
| `pendingSyncQueue` | `Signal<SyncOperation[]>` | Array of queued mutations waiting for online reconnection. |

#### Methods Signature
```typescript
class SyncService {
  queueOperation(op: SyncOperation): void;
  syncLocalDataWithSupabase(): Promise<void>;
}
```

---

### 2.8 ThemeService & PwaInstallService
`src/app/core/services/theme.service.ts` & `pwa-install.service.ts`

- **ThemeService**: Manages `dark` / `light` theme mode, `data-theme` document root attributes, and system preference changes.
- **PwaInstallService**: Intercepts `beforeinstallprompt` browser events and manages standalone PWA installation signals.

---

## 3. Core Utility Reference

### `getTaskKey`
`src/app/core/utils/task-key.util.ts`

Generates human-readable task keys (e.g., `BMS-104`, `DEV-215`) based on project names and task ID hash values.

```typescript
export function getTaskKey(task: Task | null | undefined, projects?: Project[]): string;
```

---

## 4. PostgreSQL Database Schema & Row-Level Security (RLS)

### 4.1 Projects Table DDL
```sql
create table public.projects (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users(id) on delete cascade not null,
    name text not null,
    slug text not null,
    description text,
    repository_url text,
    status text not null default 'active',
    color text default '#3b82f6',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.projects enable row level security;

create policy "Individual user project access"
    on public.projects for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
```

### 4.2 Workflows Table DDL
```sql
create table public.workflows (
    id uuid primary key default uuid_generate_v4(),
    project_id uuid references public.projects(id) on delete cascade not null,
    name text not null,
    color text default '#06b6d4',
    position integer not null default 0,
    allow_all_transitions boolean default true,
    allowed_transitions text[],
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.workflows enable row level security;
```

### 4.3 Tasks Table DDL
```sql
create table public.tasks (
    id uuid primary key default uuid_generate_v4(),
    project_id uuid references public.projects(id) on delete cascade not null,
    workflow_id uuid references public.workflows(id) on delete set null,
    user_id uuid references auth.users(id) on delete cascade not null,
    title text not null,
    description text,
    type text not null default 'task',
    priority text not null default 'medium',
    labels text[],
    attachments text[],
    due_date date,
    position integer not null default 0,
    is_next boolean default false,
    completed boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.tasks enable row level security;

create policy "Individual user task access"
    on public.tasks for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
```
