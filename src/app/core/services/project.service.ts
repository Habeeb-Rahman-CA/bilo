import { Injectable, signal, Injector } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { SyncService } from './sync.service';
import { AuthService } from './auth.service';
import { TaskService } from './task.service';
import { WorkflowService } from './workflow.service';
import { Project, ProjectActivity, Task, ProjectMember, ProjectRole } from '../models/project.model';
import { compressImageFile, MAX_ATTACHMENT_FILE_SIZE_BYTES } from '../utils/image-compressor.util';
import { createSecureInviteToken } from '../utils/invite-token.util';
import { validateAndSanitizeProject } from '../utils/data-validator.util';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  projects = signal<Project[]>([]);
  activities = signal<ProjectActivity[]>([]);
  tasks = signal<Task[]>([]);
  activeProject = signal<Project | null>(null);
  explicitBoardProjectId = signal<string | null>(null);
  loading = signal<boolean>(false);

  constructor(
    private supabaseService: SupabaseService,
    private syncService: SyncService,
    private authService: AuthService,
    private injector: Injector
  ) {
    this.loadFromStorage();
    this.loadFromSupabase();

    this.syncService.onConnectionRestored(() => {
      console.log('[ProjectService] Connection restored. Reloading remote projects...');
      this.loadFromSupabase();
    });
  }

  loadFromStorage() {
    localStorage.removeItem('bilo_projects_data');
    const currentUser = this.authService.user();
    if (!currentUser?.id) {
      this.projects.set([]);
      this.activities.set([]);
      this.activeProject.set(null);
      return;
    }

    const cached = localStorage.getItem(`bilo_projects_data_${currentUser.id}`);
    const savedActiveId = localStorage.getItem('bilo_active_project_id');

    if (cached) {
      try {
        const data = JSON.parse(cached);
        if (data.projects && Array.isArray(data.projects) && data.projects.length > 0) {
          const cleanProjects = data.projects
            .map((p: any) => validateAndSanitizeProject(p))
            .filter((p: Project | null): p is Project => p !== null && p.id !== 'proj-default-1');
          this.projects.set(cleanProjects);
          const found = savedActiveId ? cleanProjects.find((p: Project) => p.id === savedActiveId) : null;
          this.activeProject.set(found || cleanProjects[0] || null);
          if (data.activities && Array.isArray(data.activities)) {
            const sanitized = data.activities
              .filter((a: any) => a && typeof a === 'object' && typeof a.action === 'string')
              .map((a: ProjectActivity) => ({
                ...a,
                action: this.sanitizeActivityText(a.action),
                description: this.sanitizeActivityText(a.description || '')
              }));
            this.activities.set(sanitized);
          }
          return;
        }
      } catch (e) {
        console.error('Failed to load local cache', e);
      }
    }

    // Auto-initialize a default workspace for a new user ONLY if no project exists at all
    const defaultProjName = this.getDefaultWorkspaceName();
    const defaultProj: Project = {
      id: 'proj-bilo-main',
      user_id: currentUser.id,
      name: defaultProjName,
      slug: this.generateSlug(defaultProjName),
      description: 'Primary workspace for task management and kanban board',
      status: 'active',
      color: '#06b6d4',
      icon: 'fi fi-rr-folder',
      labels: ['core', 'workspace'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.projects.set([defaultProj]);
    this.activeProject.set(defaultProj);
    this.saveToStorage();
  }

  getDefaultWorkspaceName(): string {
    const userName = this.authService.userName();
    const name = userName && userName.trim() && userName.trim() !== 'User' ? userName.trim() : null;
    if (name) {
      return `${name}'s Workspace`;
    }
    const email = this.authService.userEmail();
    if (email) {
      const emailName = email.split('@')[0];
      if (emailName) {
        const capitalized = emailName.charAt(0).toUpperCase() + emailName.slice(1);
        return `${capitalized}'s Workspace`;
      }
    }
    return `My Workspace`;
  }

  generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'workspace';
  }

  generateUniqueName(name: string, excludeProjectId?: string): string {
    const trimmed = (name || 'Untitled Project').trim();
    const existingNames = new Set(
      this.projects()
        .filter(p => p.id !== excludeProjectId)
        .map(p => (p.name || '').trim().toLowerCase())
    );

    if (!existingNames.has(trimmed.toLowerCase())) {
      return trimmed;
    }

    let counter = 2;
    let candidate = `${trimmed} (${counter})`;
    while (existingNames.has(candidate.toLowerCase())) {
      counter++;
      candidate = `${trimmed} (${counter})`;
    }
    return candidate;
  }

  generateUniqueSlug(nameOrSlug: string, excludeProjectId?: string): string {
    const baseSlug = this.generateSlug(nameOrSlug);
    const existingSlugs = new Set(
      this.projects()
        .filter(p => p.id !== excludeProjectId)
        .map(p => (p.slug || '').trim().toLowerCase())
    );

    if (!existingSlugs.has(baseSlug.toLowerCase())) {
      return baseSlug;
    }

    let counter = 2;
    let candidate = `${baseSlug}-${counter}`;
    while (existingSlugs.has(candidate.toLowerCase())) {
      counter++;
      candidate = `${baseSlug}-${counter}`;
    }
    return candidate;
  }

  private saveToStorage() {
    const currentUser = this.authService.user();
    if (!currentUser?.id) return;
    localStorage.setItem(`bilo_projects_data_${currentUser.id}`, JSON.stringify({
      projects: this.projects(),
      activities: this.activities()
    }));
    if (this.activeProject()) {
      localStorage.setItem('bilo_active_project_id', this.activeProject()!.id);
    }
  }

  async loadFromSupabase() {
    if (!this.syncService.isOnline() || !this.supabaseService.isConfigured) return;

    const currentUser = this.authService.user();
    if (!currentUser) {
      this.projects.set([]);
      this.activities.set([]);
      this.activeProject.set(null);
      return;
    }

    this.loading.set(true);
    try {
      const { data, error } = await this.supabaseService.supabase
        .from('projects')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const projects = data as Project[];
        this.projects.set(projects);
        const savedActiveId = localStorage.getItem('bilo_active_project_id');
        const found = savedActiveId ? projects.find(p => p.id === savedActiveId) : null;
        this.activeProject.set((found as Project) || (projects[0] as Project));
      } else if (!error && (!data || data.length === 0)) {
        // Auto-create initial project in Supabase if new user
        const defaultName = this.getDefaultWorkspaceName();
        await this.createProject({
          name: defaultName,
          slug: this.generateSlug(defaultName),
          description: 'Primary workspace for task management and kanban board',
          color: '#06b6d4',
          icon: 'fi fi-rr-folder'
        });
      }

      // Load activities from Supabase project_activities
      const { data: actData, error: actError } = await this.supabaseService.supabase
        .from('project_activities')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('timestamp', { ascending: false })
        .limit(100);

      if (!actError && actData) {
        const sanitized = (actData as ProjectActivity[]).map(a => ({
          ...a,
          action: this.sanitizeActivityText(a.action),
          description: this.sanitizeActivityText(a.description)
        }));
        this.activities.set(sanitized);
      } else {
        this.activities.set([]);
      }

    } catch (e) {
      console.warn('Could not load data from Supabase', e);
    } finally {
      this.loading.set(false);
    }
  }

  setActiveProject(projectIdOrProject: string | Project | null | undefined): boolean {
    if (!projectIdOrProject) {
      const current = this.activeProject();
      if (current && this.projects().some(p => p.id === current.id)) {
        return false;
      }
      const fallback = this.projects()[0] || null;
      this.activeProject.set(fallback);
      this.saveToStorage();
      return fallback !== null;
    }

    if (typeof projectIdOrProject === 'object') {
      const projId = projectIdOrProject.id;
      const found = this.projects().find(p => p.id === projId) || projectIdOrProject;
      if (found && !this.projects().some(p => p.id === found.id)) {
        this.projects.update(list => [found, ...list]);
      }
      this.activeProject.set(found);
      this.saveToStorage();
      return true;
    }

    if (typeof projectIdOrProject === 'string') {
      const found = this.projects().find(p => p.id === projectIdOrProject || p.slug === projectIdOrProject);
      if (found) {
        this.activeProject.set(found);
        this.saveToStorage();
        return true;
      }
    }

    // Invalid or unknown project ID provided
    const current = this.activeProject();
    if (current && this.projects().some(p => p.id === current.id)) {
      console.warn(`[ProjectService] setActiveProject called with non-matching ID "${projectIdOrProject}". Retaining active project "${current.name}".`);
      return false;
    }

    const fallback = this.projects()[0] || null;
    console.warn(`[ProjectService] setActiveProject called with non-matching ID "${projectIdOrProject}". Falling back to project "${fallback?.name || 'none'}".`);
    this.activeProject.set(fallback);
    this.saveToStorage();
    return fallback !== null;
  }

  // --- CRUD Operations ---

  async createProject(projectData: Partial<Project>): Promise<Project> {
    const currentUser = this.authService.user();
    const generatedId = crypto.randomUUID();

    const rawName = (projectData.name || 'Untitled Project').trim();
    const uniqueName = this.generateUniqueName(rawName);
    const uniqueSlug = projectData.slug
      ? this.generateUniqueSlug(projectData.slug)
      : this.generateUniqueSlug(uniqueName);

    const newProj: Project = {
      id: generatedId,
      user_id: currentUser?.id,
      name: uniqueName,
      slug: uniqueSlug,
      description: projectData.description || '',
      repository_url: projectData.repository_url || '',
      status: projectData.status || 'active',
      labels: projectData.labels || [],
      color: projectData.color || '#06b6d4',
      image_url: projectData.image_url || '',
      icon: projectData.icon || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Update state immediately
    this.projects.update(list => [newProj, ...list]);
    this.activeProject.set(newProj);
    this.logActivity(newProj.id, 'Created', `Project "${newProj.name}" created`);
    this.saveToStorage();

    const payload: any = {
      id: newProj.id,
      name: newProj.name,
      slug: newProj.slug,
      description: newProj.description,
      repository_url: newProj.repository_url,
      status: newProj.status,
      labels: newProj.labels,
      color: newProj.color,
      image_url: newProj.image_url,
      icon: newProj.icon
    };
    if (currentUser?.id) {
      payload.user_id = currentUser.id;
    }

    if (currentUser?.id && this.syncService.isOnline()) {
      try {
        const { error: projErr } = await this.supabaseService.supabase
          .from('projects')
          .upsert([payload]);

        if (projErr) {
          console.warn('Failed to save project to Supabase directly, queueing for sync:', projErr);
          this.syncService.enqueue('CREATE_PROJECT', payload);
        } else {
          // Project row created in Supabase! Now insert owner record in project_members
          const { error: memberErr } = await this.supabaseService.supabase
            .from('project_members')
            .upsert([{
              project_id: newProj.id,
              user_id: currentUser.id,
              role: 'owner',
              user_email: currentUser.email || undefined,
              user_name: this.authService.userName() || undefined
            }]);
          if (memberErr) {
            console.warn('Failed to add owner to project_members:', memberErr);
          }
        }
      } catch (e) {
        console.warn('Error saving project to Supabase:', e);
        this.syncService.enqueue('CREATE_PROJECT', payload);
      }
    } else {
      this.syncService.enqueue('CREATE_PROJECT', payload);
    }

    return newProj;
  }

  async uploadProjectImage(file: File): Promise<string> {
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
    if (!file || !allowedMimeTypes.includes(file.type.toLowerCase())) {
      console.warn('[ProjectService] Invalid or untrusted image file type:', file?.type);
      return '';
    }

    if (file.size > MAX_ATTACHMENT_FILE_SIZE_BYTES) {
      console.warn(`[ProjectService] Image size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds 10MB limit`);
      return '';
    }

    if (this.syncService.isOnline() && this.supabaseService.isConfigured) {
      try {
        const fileExt = file.name.split('.').pop() || 'png';
        const fileName = `project-${crypto.randomUUID()}.${fileExt}`;

        const timeoutPromise = new Promise<{ data: null; error: any }>((resolve) => {
          setTimeout(() => resolve({ data: null, error: new Error('Upload request timed out after 15s') }), 15000);
        });

        const uploadPromise = this.supabaseService.supabase.storage
          .from('project-images')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: true
          });

        const result = await Promise.race([uploadPromise, timeoutPromise]);

        if (result && !result.error && result.data) {
          const { data: publicUrlData } = this.supabaseService.supabase.storage
            .from('project-images')
            .getPublicUrl(fileName);

          if (publicUrlData?.publicUrl) {
            return publicUrlData.publicUrl;
          }
        } else if (result?.error) {
          console.warn('[Supabase Storage] Upload failed or timed out:', result.error?.message);
        }
      } catch (e) {
        console.warn('[Supabase Storage] Exception during upload:', e);
      }
    }

    // Compressed Fallback: Downscale and compress image to lightweight base64 Data URL (max 600x600, ~30-50KB)
    try {
      return await compressImageFile(file, 600, 600, 0.75);
    } catch (e) {
      console.warn('Failed to compress project image fallback:', e);
      return '';
    }
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
    const currentProj = this.projects().find(p => p.id === id);
    if (!currentProj) return null;

    let finalName = updates.name ? updates.name.trim() : undefined;
    let finalSlug = updates.slug ? updates.slug.trim() : undefined;

    if (finalName && currentProj.name.trim().toLowerCase() !== finalName.toLowerCase()) {
      finalName = this.generateUniqueName(finalName, id);
      finalSlug = this.generateUniqueSlug(finalName, id);
    } else if (finalSlug) {
      finalSlug = this.generateUniqueSlug(finalSlug, id);
    }

    const updatedProj: Project = {
      ...currentProj,
      ...updates,
      ...(finalName ? { name: finalName } : {}),
      ...(finalSlug ? { slug: finalSlug } : {}),
      updated_at: new Date().toISOString()
    };

    this.projects.update(list => list.map(p => (p.id === id ? updatedProj : p)));

    if (this.activeProject()?.id === id) {
      this.activeProject.set(updatedProj);
    }
    this.logActivity(id, 'Updated', `Project metadata updated`);
    this.saveToStorage();

    this.syncService.enqueue('UPDATE_PROJECT', {
      id,
      name: updatedProj.name,
      slug: updatedProj.slug,
      description: updatedProj.description,
      repository_url: updatedProj.repository_url,
      status: updatedProj.status,
      labels: updatedProj.labels,
      color: updatedProj.color,
      image_url: updatedProj.image_url,
      icon: updatedProj.icon,
      updated_at: updatedProj.updated_at
    });

    return updatedProj;
  }

  async archiveProject(id: string) {
    const proj = this.projects().find(p => p.id === id);
    if (!proj) return;
    const newStatus = proj.status === 'archived' ? 'active' : 'archived';
    await this.updateProject(id, { status: newStatus });
  }

  async deleteProject(id: string) {
    const proj = this.projects().find(p => p.id === id);
    if (!proj) return;

    // 1) Cascade delete tasks, comments, and history from TaskService memory & storage
    try {
      const taskService = this.injector.get(TaskService);
      taskService.deleteTasksForProject(id);
    } catch (e) {
      console.warn('Could not cascade delete tasks for project:', e);
    }

    // 2) Cascade delete custom workflows from WorkflowService memory & storage
    try {
      const workflowService = this.injector.get(WorkflowService);
      workflowService.deleteWorkflowsForProject(id);
    } catch (e) {
      console.warn('Could not cascade delete workflows for project:', e);
    }

    // 3) Filter out project and its activities from ProjectService state
    this.projects.update(list => list.filter(p => p.id !== id));
    this.tasks.update(list => list.filter(t => t.project_id !== id));
    this.activities.update(list => list.filter(a => a.project_id !== id));

    if (this.activeProject()?.id === id) {
      const remaining = this.projects();
      this.activeProject.set(remaining.length > 0 ? remaining[0] : null);
    }

    this.saveToStorage();
    this.syncService.enqueue('DELETE_PROJECT', { id });
  }

  sanitizeActivityText(input?: string): string {
    if (!input) return '';
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }

  logActivity(projectId: string, action: string, description: string) {
    const currentUser = this.authService.user();
    const cleanAction = this.sanitizeActivityText(action);
    const cleanDescription = this.sanitizeActivityText(description);

    const newAct: ProjectActivity = {
      id: crypto.randomUUID(),
      project_id: projectId || 'global',
      user_id: currentUser?.id,
      action: cleanAction,
      description: cleanDescription,
      timestamp: new Date().toISOString()
    };
    this.activities.update(list => [newAct, ...list]);
    this.saveToStorage();
    this.syncService.enqueue('ADD_PROJECT_ACTIVITY', newAct);
  }

  resetState() {
    const currentUser = this.authService.user();
    if (currentUser?.id) {
      localStorage.removeItem(`bilo_projects_data_${currentUser.id}`);
    }
    localStorage.removeItem('bilo_projects_data');
    this.projects.set([]);
    this.activities.set([]);
    this.tasks.set([]);
    this.activeProject.set(null);
  }

  getProjectProgress(projectId: string): { completed: number; total: number; percent: number } {
    const projTasks = (this.tasks() || []).filter(t => t && t.project_id === projectId);
    const total = projTasks.length;
    if (!total || total <= 0) return { completed: 0, total: 0, percent: 0 };
    const completed = projTasks.filter(t => t && (t.completed || (t.status || '').toLowerCase() === 'done')).length;
    const rawPercent = Math.round((completed / total) * 100);
    const percent = Number.isFinite(rawPercent) ? Math.min(100, Math.max(0, rawPercent)) : 0;
    return { completed, total, percent };
  }

  getProjectRecentActivity(projectId: string): ProjectActivity[] {
    return this.activities()
      .filter(a => a.project_id === projectId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);
  }

  // --- Project Members & Ownership ---

  async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    let rawMembers: ProjectMember[] = [];
    if (this.syncService.isOnline()) {
      try {
        const { data, error } = await this.supabaseService.supabase
          .from('project_members')
          .select('*')
          .eq('project_id', projectId);

        if (error) {
          console.error('Failed to fetch project members from Supabase:', error.message || error);
        } else if (data) {
          rawMembers = data as ProjectMember[];
        }
      } catch (e) {
        console.error('Exception while fetching project members:', e);
      }
    } else {
      console.warn('SyncService is offline; loading fallback project members from local state.');
    }

    // If database query produced no members (due to offline state, error, or empty database response), build fallback members from local memory
    if (rawMembers.length === 0) {
      const fallbackMap = new Map<string, ProjectMember>();

      // 1. Add current user as member/owner
      const currentUser = this.authService.user();
      if (currentUser) {
        const meta = currentUser.user_metadata;
        const name = meta?.['display_name'] || meta?.['full_name'] || meta?.['name'] ||
          (currentUser.email ? currentUser.email.split('@')[0].split(/[\._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ') : 'User');
        const userKey = (currentUser.id || currentUser.email || 'user').toLowerCase();
        fallbackMap.set(userKey, {
          id: `local_m_${currentUser.id || 'user'}`,
          project_id: projectId,
          user_id: currentUser.id || currentUser.email || 'user',
          role: 'owner',
          user_email: currentUser.email,
          user_name: name,
          created_at: new Date().toISOString()
        });
      }

      // 2. Add project creator/owner if known
      const proj = this.projects().find(p => p.id === projectId);
      if (proj?.user_id && !fallbackMap.has(proj.user_id.toLowerCase())) {
        fallbackMap.set(proj.user_id.toLowerCase(), {
          id: `local_m_${proj.user_id}`,
          project_id: projectId,
          user_id: proj.user_id,
          role: 'owner',
          user_name: proj.user_id.includes('@') ? proj.user_id.split('@')[0] : `Owner (${proj.user_id.slice(0, 6)})`,
          created_at: new Date().toISOString()
        });
      }

      // 3. Add assignees from local tasks for this project
      const projTasks = this.tasks().filter(t => t.project_id === projectId);
      for (const t of projTasks) {
        if (t.assignee && t.assignee !== 'Unassigned' && t.assignee !== 'Self') {
          const key = t.assignee.toLowerCase();
          if (!fallbackMap.has(key)) {
            fallbackMap.set(key, {
              id: `local_m_task_${t.id}`,
              project_id: projectId,
              user_id: t.assignee,
              role: 'member',
              user_name: t.assignee,
              created_at: new Date().toISOString()
            });
          }
        }
      }

      rawMembers = Array.from(fallbackMap.values());
    }

    const currentUser = this.authService.user();
    const uniqueMembersMap = new Map<string, ProjectMember>();

    rawMembers.forEach(m => {
      const key = (m.user_id || m.user_email || m.id).toLowerCase();
      if (!uniqueMembersMap.has(key)) {
        uniqueMembersMap.set(key, m);
      } else {
        const existing = uniqueMembersMap.get(key)!;
        if (m.role === 'owner' || (m.role === 'admin' && existing.role !== 'owner')) {
          uniqueMembersMap.set(key, m);
        }
      }
    });

    const members = Array.from(uniqueMembersMap.values());
    return members.map(m => {
      if (currentUser && (m.user_id === currentUser.id || m.user_email === currentUser.email)) {
        const meta = currentUser.user_metadata;
        const name = meta?.['display_name'] || meta?.['full_name'] || meta?.['name'] ||
          (currentUser.email ? currentUser.email.split('@')[0].split(/[\._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ') : '');
        return {
          ...m,
          user_name: m.user_name || name,
          user_email: m.user_email || currentUser.email
        };
      }
      return m;
    });
  }

  async addProjectMember(
    projectId: string,
    userId: string,
    role: ProjectRole = 'member',
    userName?: string,
    userEmail?: string
  ): Promise<boolean> {
    if (!this.syncService.isOnline()) return false;
    try {
      let finalEmail = userEmail;
      let finalName = userName;

      const currentUser = this.authService.user();
      if (currentUser && (userId === currentUser.id || userId === currentUser.email)) {
        finalEmail = finalEmail || currentUser.email || undefined;
        const meta = currentUser.user_metadata;
        finalName = finalName || meta?.['display_name'] || meta?.['full_name'] || meta?.['name'] || undefined;
      }

      if (!finalEmail && userId.includes('@')) {
        finalEmail = userId;
      }
      if (!finalName && finalEmail) {
        const parts = finalEmail.split('@')[0];
        finalName = parts.split(/[\._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
      } else if (!finalName && !userId.includes('-')) {
        const clean = userId.replace(/^usr_/, '').replace(/^user_/, '');
        finalName = clean.split(/[\._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
      }

      // Check if user is already a member of this project to prevent duplicate records
      const existingMembers = await this.getProjectMembers(projectId);
      const existing = existingMembers.find(
        m => m.user_id === userId || (m.user_email && finalEmail && m.user_email.toLowerCase() === finalEmail.toLowerCase())
      );

      if (existing) {
        // User is already a member. If role is elevated, update existing record instead of creating duplicate row
        if (existing.role !== role && existing.role !== 'owner') {
          await this.updateMemberRole(projectId, existing.id, role);
        }
        return true;
      }

      const payload: any = {
        project_id: projectId,
        user_id: userId,
        role
      };
      if (finalEmail) payload.user_email = finalEmail;
      if (finalName) payload.user_name = finalName;

      const { error } = await this.supabaseService.supabase
        .from('project_members')
        .upsert([payload]);

      if (!error) {
        this.logActivity(projectId, 'Member Added', `${finalName || userId} added as ${role}`);
        return true;
      }
    } catch (e) {
      console.warn('Failed to add project member:', e);
    }
    return false;
  }

  async removeProjectMember(projectId: string, memberId: string): Promise<boolean> {
    if (!this.syncService.isOnline()) return false;
    try {
      const { error } = await this.supabaseService.supabase
        .from('project_members')
        .delete()
        .eq('id', memberId);

      if (!error) {
        this.logActivity(projectId, 'Member Removed', `Project member removed`);
        return true;
      }
    } catch (e) {
      console.warn('Failed to remove project member:', e);
    }
    return false;
  }

  async updateMemberRole(projectId: string, memberId: string, newRole: ProjectRole): Promise<boolean> {
    if (!this.syncService.isOnline()) return false;
    try {
      const { error } = await this.supabaseService.supabase
        .from('project_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (!error) {
        this.logActivity(projectId, 'Role Updated', `Member role updated to ${newRole}`);
        return true;
      }
    } catch (e) {
      console.warn('Failed to update member role:', e);
    }
    return false;
  }

  async transferOwnership(projectId: string, targetUserId: string): Promise<boolean> {
    if (!this.syncService.isOnline()) return false;
    try {
      const { error: projError } = await this.supabaseService.supabase
        .from('projects')
        .update({ user_id: targetUserId, updated_at: new Date().toISOString() })
        .eq('id', projectId);

      if (!projError) {
        await this.addProjectMember(projectId, targetUserId, 'owner');
        this.projects.update(list => list.map(p => p.id === projectId ? { ...p, user_id: targetUserId } : p));
        this.logActivity(projectId, 'Ownership Transferred', `Project ownership transferred to ${targetUserId}`);
        return true;
      }
    } catch (e) {
      console.warn('Failed to transfer ownership:', e);
    }
    return false;
  }

  // --- Invite Link & Workspace Joining ---

  async generateInviteLink(projectId: string, role: ProjectRole = 'member'): Promise<string> {
    const origin = typeof window !== 'undefined' ? (window.location.origin + window.location.pathname) : '';
    const token = await createSecureInviteToken(projectId, role);
    return `${origin}?token=${encodeURIComponent(token)}`;
  }

  async fetchProjectById(projectId: string): Promise<Project | null> {
    const existing = this.projects().find(p => p.id === projectId);
    if (existing) return existing;

    if (!this.syncService.isOnline()) return null;
    try {
      const { data, error } = await this.supabaseService.supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .maybeSingle();

      if (!error && data) {
        return data as Project;
      }
    } catch (e) {
      console.warn('Failed to fetch project by ID:', e);
    }
    return null;
  }

  async joinProjectViaInvite(projectId: string, role: ProjectRole = 'member'): Promise<Project | null> {
    const proj = await this.fetchProjectById(projectId);
    if (!proj) return null;

    const currentUser = this.authService.user();
    if (currentUser?.id) {
      const existingMembers = await this.getProjectMembers(projectId);
      const isAlreadyMember = existingMembers.some(
        m => m.user_id === currentUser.id || (m.user_email && currentUser.email && m.user_email.toLowerCase() === currentUser.email.toLowerCase())
      );

      if (!isAlreadyMember) {
        await this.addProjectMember(projectId, currentUser.id, role, undefined, currentUser.email || undefined);
      }
    }

    // Add project to local projects signal if not present
    if (!this.projects().some(p => p.id === proj.id)) {
      this.projects.update(list => [proj, ...list]);
    }

    this.activeProject.set(proj);
    this.saveToStorage();
    return proj;
  }

  async getWorkspaceMemberOptions(projectId?: string, currentAssignee?: string): Promise<{ value: string; label: string; icon?: string }[]> {
    try {
      const options: { value: string; label: string; icon?: string }[] = [
        { value: 'Unassigned', label: 'Unassigned', icon: 'fi fi-rr-user-slash' }
      ];

      const currentUser = this.authService.user();
      if (currentUser) {
        const meta = currentUser.user_metadata;
        const currentName = meta?.['display_name'] || meta?.['full_name'] || meta?.['name'] ||
          (currentUser.email ? currentUser.email.split('@')[0].split(/[\._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ') : 'User');

        if (currentName && currentName !== 'Self') {
          options.push({
            value: currentName,
            label: `${currentName} (You)`,
            icon: 'fi fi-rr-user-check text-emerald'
          });
        }
      }

      if (projectId && projectId !== 'all' && projectId !== 'ALL') {
        const members = await this.getProjectMembers(projectId);
        const existingValues = new Set(options.map(o => o.value.toLowerCase()));

        for (const m of members) {
          let displayName = m.user_name;
          if (!displayName && m.user_email) {
            const parts = m.user_email.split('@')[0];
            displayName = parts.split(/[\._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
          }
          if (!displayName && m.user_id) {
            if (m.user_id.includes('@')) {
              const parts = m.user_id.split('@')[0];
              displayName = parts.split(/[\._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
            } else if (!/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(m.user_id)) {
              const clean = m.user_id.replace(/^usr_/, '').replace(/^user_/, '');
              displayName = clean.split(/[\._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
            } else {
              displayName = `Member (${m.user_id.slice(0, 6)})`;
            }
          }

          if (displayName && displayName !== 'Self' && !existingValues.has(displayName.toLowerCase())) {
            existingValues.add(displayName.toLowerCase());
            if (m.user_id) existingValues.add(m.user_id.toLowerCase());

            options.push({
              value: displayName,
              label: `${displayName} (${m.role.toUpperCase()})`,
              icon: m.role === 'owner' ? 'fi fi-rr-crown text-purple' : 'fi fi-rr-user text-cyan'
            });
          }
        }
      }

      if (currentAssignee && currentAssignee.trim() && currentAssignee.trim() !== 'Self' && currentAssignee.trim() !== 'Unassigned' && !options.some(o => o.value.toLowerCase() === currentAssignee.trim().toLowerCase())) {
        options.push({
          value: currentAssignee.trim(),
          label: currentAssignee.trim(),
          icon: 'fi fi-rr-user'
        });
      }

      const filtered = options.filter(o => o.value !== 'Self');
      return filtered.length > 0 ? filtered : [{ value: 'Unassigned', label: 'Unassigned', icon: 'fi fi-rr-user-slash' }];
    } catch (e) {
      console.error('Failed to get workspace member options:', e);
      const fallbackOptions: { value: string; label: string; icon?: string }[] = [
        { value: 'Unassigned', label: 'Unassigned', icon: 'fi fi-rr-user-slash' }
      ];
      if (currentAssignee && currentAssignee !== 'Unassigned' && currentAssignee !== 'Self') {
        fallbackOptions.push({ value: currentAssignee, label: currentAssignee, icon: 'fi fi-rr-user' });
      }
      return fallbackOptions;
    }
  }
}

