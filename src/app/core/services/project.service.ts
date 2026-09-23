import { Injectable, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { SyncService } from './sync.service';
import { AuthService } from './auth.service';
import { Project, ProjectActivity, Task, ProjectMember, ProjectRole } from '../models/project.model';

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
    private authService: AuthService
  ) {
    this.loadFromStorage();
    this.loadFromSupabase();
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
    const defaultProjName = this.getDefaultWorkspaceName();

    if (cached) {
      try {
        const data = JSON.parse(cached);
        if (data.projects && Array.isArray(data.projects) && data.projects.length > 0) {
          const cleanProjects = data.projects.filter((p: Project) => p.id !== 'proj-default-1');
          cleanProjects.forEach((p: Project) => {
            if (p.name === 'bilo' || (p.id === 'proj-bilo-main' && p.name === 'bilo')) {
              p.name = defaultProjName;
              p.slug = this.generateSlug(defaultProjName);
            }
          });
          this.projects.set(cleanProjects);
          const found = savedActiveId ? cleanProjects.find((p: Project) => p.id === savedActiveId) : null;
          this.activeProject.set(found || cleanProjects[0] || null);
          if (data.activities && Array.isArray(data.activities)) {
            this.activities.set(data.activities);
          }
          return;
        }
      } catch (e) {
        console.error('Failed to load local cache', e);
      }
    }

    // Auto-initialize a default workspace for the user if none exists
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
    if (!this.syncService.isOnline()) return;

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
        const defaultProjName = this.getDefaultWorkspaceName();
        projects.forEach((p: Project) => {
          if (p.name === 'bilo' || (p.id === 'proj-bilo-main' && p.name === 'bilo')) {
            p.name = defaultProjName;
            p.slug = this.generateSlug(defaultProjName);
          }
        });
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
        this.activities.set(actData as ProjectActivity[]);
      } else {
        this.activities.set([]);
      }

      this.saveToStorage();
    } catch (e) {
      console.warn('Could not load data from Supabase', e);
    } finally {
      this.loading.set(false);
    }
  }

  // --- CRUD Operations ---

  async createProject(projectData: Partial<Project>): Promise<Project> {
    const currentUser = this.authService.user();
    const generatedId = crypto.randomUUID();
    const newProj: Project = {
      id: generatedId,
      user_id: currentUser?.id,
      name: projectData.name || 'Untitled Project',
      slug: (projectData.name || 'untitled').toLowerCase().replace(/\s+/g, '-'),
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
    const fileToDataUrl = (): Promise<string> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string) || '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });
    };

    if (this.syncService.isOnline()) {
      try {
        const fileExt = file.name.split('.').pop() || 'png';
        const fileName = `project-${crypto.randomUUID()}.${fileExt}`;

        // Timeout promise after 4 seconds to prevent UI hanging
        const timeoutPromise = new Promise<{ data: null; error: any }>((resolve) => {
          setTimeout(() => resolve({ data: null, error: new Error('Upload request timed out after 4s') }), 4000);
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

    // Fallback: Read file as Data URL (base64) so it works offline or before bucket exists
    return await fileToDataUrl();
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
    const updatedFields = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    let updatedProj: Project | null = null;
    this.projects.update(list => list.map(p => {
      if (p.id === id) {
        updatedProj = { ...p, ...updatedFields };
        return updatedProj;
      }
      return p;
    }));

    if (updatedProj) {
      if (this.activeProject()?.id === id) this.activeProject.set(updatedProj);
      this.logActivity(id, 'Updated', `Project metadata updated`);
      this.saveToStorage();

      this.syncService.enqueue('UPDATE_PROJECT', {
        id,
        name: updates.name,
        slug: updates.name ? updates.name.toLowerCase().replace(/\s+/g, '-') : undefined,
        description: updates.description,
        repository_url: updates.repository_url,
        status: updates.status,
        labels: updates.labels,
        color: updates.color,
        image_url: updates.image_url,
        icon: updates.icon,
        updated_at: new Date().toISOString()
      });
    }

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

  logActivity(projectId: string, action: string, description: string) {
    const currentUser = this.authService.user();
    const newAct: ProjectActivity = {
      id: crypto.randomUUID(),
      project_id: projectId || 'global',
      user_id: currentUser?.id,
      action,
      description,
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
    const projTasks = this.tasks().filter(t => t.project_id === projectId);
    if (projTasks.length === 0) return { completed: 0, total: 0, percent: 0 };
    const completed = projTasks.filter(t => t.completed).length;
    const percent = Math.round((completed / projTasks.length) * 100);
    return { completed, total: projTasks.length, percent };
  }

  getProjectRecentActivity(projectId: string): ProjectActivity[] {
    return this.activities()
      .filter(a => a.project_id === projectId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);
  }

  // --- Project Members & Ownership ---

  async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    if (!this.syncService.isOnline()) return [];
    try {
      const { data, error } = await this.supabaseService.supabase
        .from('project_members')
        .select('*')
        .eq('project_id', projectId);

      if (!error && data) {
        const currentUser = this.authService.user();
        const members = data as ProjectMember[];
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
    } catch (e) {
      console.warn('Failed to fetch project members:', e);
    }
    return [];
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

  generateInviteLink(projectId: string, role: ProjectRole = 'member'): string {
    const origin = window.location.origin + window.location.pathname;
    return `${origin}?invite=${encodeURIComponent(projectId)}&role=${encodeURIComponent(role)}`;
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
      await this.addProjectMember(projectId, currentUser.id, role);
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

    return options.filter(o => o.value !== 'Self');
  }
}

