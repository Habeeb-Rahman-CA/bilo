import { Injectable, signal, computed, Injector } from '@angular/core';
import { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { ProjectService } from './project.service';
import { TaskService } from './task.service';
import { WorkflowService } from './workflow.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  user = signal<User | null>(null);
  session = signal<Session | null>(null);
  authLoading = signal<boolean>(true);
  authModalOpen = signal<boolean>(false);
  
  readonly isAuthenticated = computed(() => !!this.user());
  readonly userEmail = computed(() => this.user()?.email || '');

  constructor(
    private supabaseService: SupabaseService,
    private injector: Injector
  ) {
    this.initAuth();
  }

  private async initAuth() {
    try {
      const { data } = await this.supabaseService.supabase.auth.getSession();
      const session = data?.session ?? null;
      this.session.set(session);
      this.user.set(session?.user ?? null);
      this.authLoading.set(false);

      if (session?.user) {
        await this.reloadServicesData();
      }

      this.supabaseService.supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
        const previousUser = this.user();
        const newUser = session?.user ?? null;

        this.session.set(session);
        this.user.set(newUser);
        this.authLoading.set(false);

        if (event === 'SIGNED_IN' || (newUser && previousUser?.id !== newUser?.id)) {
          if (previousUser && newUser && previousUser.id !== newUser.id) {
            this.resetServicesState();
          }
          await this.reloadServicesData();
        } else if (event === 'SIGNED_OUT' || !newUser) {
          this.resetServicesState();
        }
      });
    } catch (e) {
      console.warn('Auth initialization skipped in offline mode', e);
      this.authLoading.set(false);
    }
  }

  resetServicesState() {
    try {
      const projectService = this.injector.get(ProjectService);
      const taskService = this.injector.get(TaskService);
      projectService.resetState();
      taskService.resetState();
    } catch (e) {
      console.warn('[AuthService] Error resetting state:', e);
    }
  }

  async reloadServicesData() {
    try {
      const projectService = this.injector.get(ProjectService);
      const taskService = this.injector.get(TaskService);
      const workflowService = this.injector.get(WorkflowService);

      projectService.loadFromStorage();
      taskService.loadFromStorage();
      workflowService.loadFromStorage();

      await Promise.all([
        projectService.loadFromSupabase(),
        taskService.loadTasksFromSupabase(),
        workflowService.loadAllWorkflows()
      ]);
    } catch (e) {
      console.warn('[AuthService] Error reloading services data:', e);
    }
  }

  async signUpWithEmailPassword(email: string, password: string) {
    return await this.supabaseService.supabase.auth.signUp({
      email,
      password
    });
  }

  async signInWithEmailPassword(email: string, password: string) {
    return await this.supabaseService.supabase.auth.signInWithPassword({
      email,
      password
    });
  }

  async signInWithMagicLink(email: string) {
    return await this.supabaseService.supabase.auth.signInWithOtp({ email });
  }

  async signOut() {
    const res = await this.supabaseService.supabase.auth.signOut();
    this.user.set(null);
    this.session.set(null);
    
    // Clear browser memory signals and local storage cache for complete data isolation
    try {
      const projectService = this.injector.get(ProjectService);
      const taskService = this.injector.get(TaskService);
      projectService.resetState();
      taskService.resetState();
    } catch (e) {
      console.warn('[AuthService] Error resetting state on sign out:', e);
    }

    localStorage.removeItem('bilo_projects_data');
    localStorage.removeItem('bilo_tasks_data');
    localStorage.removeItem('bilo_sync_queue');
    return res;
  }

  async claimUnassignedData() {
    const currentUser = this.user();
    if (!currentUser) return;

    try {
      const { error } = await this.supabaseService.supabase.rpc('migrate_unassigned_data_to_user', {
        target_user_id: currentUser.id
      });
      if (error) {
        console.warn('[AuthService] RPC migrate_unassigned_data_to_user failed or function not present:', error.message);
      } else {
        console.log('[AuthService] Successfully claimed unassigned workspace data for user:', currentUser.email);
        try {
          const projectService = this.injector.get(ProjectService);
          const taskService = this.injector.get(TaskService);
          await projectService.loadFromSupabase();
          await taskService.loadTasksFromSupabase();
        } catch (reloadErr) {
          console.warn('[AuthService] Services reload error:', reloadErr);
        }
      }
    } catch (e) {
      console.warn('[AuthService] Exception claiming unassigned data:', e);
    }
  }

  openAuthModal() {
    this.authModalOpen.set(true);
  }

  closeAuthModal() {
    this.authModalOpen.set(false);
  }
}
