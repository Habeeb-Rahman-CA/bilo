import { Injectable, signal, computed, Injector } from '@angular/core';
import { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { ProjectService } from './project.service';
import { TaskService } from './task.service';
import { WorkflowService } from './workflow.service';
import { UserProfile } from '../models/user-profile.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  user = signal<User | null>(null);
  session = signal<Session | null>(null);
  userProfile = signal<UserProfile | null>(null);
  authLoading = signal<boolean>(true);
  authModalOpen = signal<boolean>(false);
  
  readonly isAuthenticated = computed(() => !!this.user());
  readonly userEmail = computed(() => this.user()?.email || '');
  readonly userName = computed(() => {
    const profile = this.userProfile();
    if (profile?.display_name) return profile.display_name;
    const u = this.user();
    if (!u) return 'User';
    return u.user_metadata?.['display_name'] ||
      u.user_metadata?.['full_name'] ||
      (u.email ? u.email.split('@')[0] : 'User');
  });
  readonly userAvatar = computed(() => {
    const profile = this.userProfile();
    return profile?.avatar_url || null;
  });
  // Guard flags to prevent re-entrant cascading loops
  private _bootstrapping = false;
  private _sanitized = false;

  constructor(
    private supabaseService: SupabaseService,
    private injector: Injector
  ) {
    this.initAuth();
  }

  private async initAuth() {
    try {
      const { data } = await this.supabaseService.supabase.auth.getSession();
      let session = data?.session ?? null;

      // CRITICAL: If the access token is bloated (>4KB = has embedded avatar/picture),
      // it causes ERR_CONNECTION_RESET because Cloudflare/Kong rejects oversized headers.
      // We MUST clean it BEFORE any data API calls go out.
      if (session?.access_token && session.access_token.length > 4096) {
        console.warn(`[AuthService] Bloated JWT detected (${(session.access_token.length / 1024).toFixed(1)}KB). Sanitizing before data load...`);
        session = await this.sanitizeAndRefreshJwtToken(session);
      }

      this.session.set(session);
      this.user.set(session?.user ?? null);

      if (session?.user) {
        await this.loadUserProfileBootstrap(session.user);
        await this.reloadServicesData();
      }
      this.authLoading.set(false);

      this.supabaseService.supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
        const previousUser = this.user();
        const newUser = session?.user ?? null;

        this.session.set(session);
        this.user.set(newUser);

        // Only bootstrap on actual sign-in or user switch, NOT on TOKEN_REFRESHED or other events
        if (event === 'SIGNED_IN' && newUser) {
          if (previousUser && newUser && previousUser.id !== newUser.id) {
            this.resetServicesState();
          }
          await this.loadUserProfileBootstrap(newUser);
          await this.reloadServicesData();
        } else if (event === 'SIGNED_OUT' || !newUser) {
          this.resetServicesState();
        }
        // TOKEN_REFRESHED, USER_UPDATED etc. just update signals above without re-triggering bootstrap
        this.authLoading.set(false);
      });
    } catch (e) {
      console.warn('Auth initialization skipped in offline mode', e);
      this.authLoading.set(false);
    }
  }

  /**
   * Post-login Bootstrap API loader:
   * Loads user profile data (display name, avatar URL) from dedicated user_profiles table
   * instead of loading or storing avatar_url inside the JWT Auth access token payload.
   */
  async loadUserProfileBootstrap(user: User): Promise<UserProfile> {
    // Guard against re-entrant calls
    if (this._bootstrapping) {
      const cached = this.userProfile();
      if (cached) return cached;
      return { id: user.id, email: user.email || '', display_name: user.email?.split('@')[0] || 'User', avatar_url: null };
    }
    this._bootstrapping = true;

    try {
      // 1. Try instant loading from localStorage cache
      try {
        const cachedStr = localStorage.getItem(`bilo_user_profile_${user.id}`);
        if (cachedStr) {
          const cachedProfile = JSON.parse(cachedStr) as UserProfile;
          this.userProfile.set(cachedProfile);
        }
      } catch (e) {
        console.warn('[AuthService] Cache read profile notice:', e);
      }

      // 2. Fetch fresh profile from Supabase user_profiles bootstrap table
      try {
        const { data, error } = await this.supabaseService.supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (data && !error) {
          const freshProfile: UserProfile = {
            id: data.id,
            email: data.email || user.email || '',
            display_name: data.display_name || user.user_metadata?.['display_name'] || user.email?.split('@')[0] || 'User',
            avatar_url: data.avatar_url || null,
            updated_at: data.updated_at
          };
          this.userProfile.set(freshProfile);
          localStorage.setItem(`bilo_user_profile_${user.id}`, JSON.stringify(freshProfile));
          return freshProfile;
        }
      } catch (e) {
        console.warn('[AuthService] Supabase user_profiles table bootstrap fetch:', e);
      }

      // 3. Fallback: Build initial profile without embedding avatar_url into JWT bearer token
      const fallbackProfile: UserProfile = {
        id: user.id,
        email: user.email || '',
        display_name: user.user_metadata?.['display_name'] || user.email?.split('@')[0] || 'User',
        avatar_url: null
      };

      if (!this.userProfile()) {
        this.userProfile.set(fallbackProfile);
      }
      return fallbackProfile;
    } finally {
      this._bootstrapping = false;
    }
  }

  /**
   * Gets a clean, small JWT token by refreshing the session first.
   *
   * The catch-22: updateUser() sends the bloated access_token as the Authorization header,
   * which itself causes ERR_CONNECTION_RESET (Cloudflare rejects oversized headers).
   *
   * Solution: Call refreshSession() FIRST — it sends the refresh_token in the request BODY
   * (not the access_token header), so it bypasses the header size limit. Once we have a
   * clean token, THEN strip the metadata from user_metadata using the clean token.
   */
  async sanitizeAndRefreshJwtToken(currentSession?: Session | null): Promise<Session | null> {
    if (this._sanitized) return currentSession ?? this.session();
    this._sanitized = true;

    try {
      const session = currentSession ?? this.session();
      if (!session?.refresh_token) return session ?? null;

      // Step 1: Refresh session using refresh_token (sent in body, NOT as header)
      // This gives us a NEW clean access_token even if the old one is bloated
      const { data: refreshed, error: refreshError } = await this.supabaseService.supabase.auth.refreshSession({
        refresh_token: session.refresh_token
      });

      if (refreshError || !refreshed?.session) {
        console.warn('[AuthService] refreshSession failed:', refreshError?.message);
        return currentSession ?? null;
      }

      const newSession = refreshed.session;
      this.session.set(newSession);
      this.user.set(newSession.user);
      console.log(`[AuthService] Token refreshed: ${(newSession.access_token.length / 1024).toFixed(1)}KB`);

      // Step 2: Now strip heavy metadata using the CLEAN token (if still present)
      const meta = newSession.user.user_metadata || {};
      if (meta['avatar_url'] || meta['avatar'] || meta['picture']) {
        try {
          await this.supabaseService.supabase.auth.updateUser({
            data: {
              display_name: meta['display_name'] || newSession.user.email?.split('@')[0] || 'User',
              avatar_url: null,
              avatar: null,
              picture: null
            }
          });
          // Refresh again to get the final clean token without metadata
          const { data: final } = await this.supabaseService.supabase.auth.refreshSession();
          if (final?.session) {
            this.session.set(final.session);
            this.user.set(final.session.user);
            console.log(`[AuthService] Metadata stripped. Final token: ${(final.session.access_token.length / 1024).toFixed(1)}KB`);
            return final.session;
          }
        } catch (e) {
          console.warn('[AuthService] Metadata strip failed (non-critical):', e);
        }
      }

      return newSession;
    } catch (e) {
      console.warn('[AuthService] Token sanitization failed, continuing with existing session:', e);
    }

    return currentSession ?? this.session();
  }

  resetServicesState() {
    this.userProfile.set(null);
    this._sanitized = false;
    try {
      const projectService = this.injector.get(ProjectService);
      const taskService = this.injector.get(TaskService);
      projectService.resetState();
      taskService.resetState();
    } catch (e) {
      console.warn('[AuthService] Error resetting state:', e);
    }
    localStorage.removeItem('bilo_backlog_filters');
    localStorage.removeItem('bilo_board_filters');
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
    const activeUserId = this.user()?.id;
    const res = await this.supabaseService.supabase.auth.signOut();
    this.user.set(null);
    this.session.set(null);
    this.userProfile.set(null);
    
    // Clear browser memory signals and local storage cache for complete data isolation
    try {
      const projectService = this.injector.get(ProjectService);
      const taskService = this.injector.get(TaskService);
      projectService.resetState();
      taskService.resetState();
    } catch (e) {
      console.warn('[AuthService] Error resetting state on sign out:', e);
    }

    if (activeUserId) {
      localStorage.removeItem(`bilo_user_profile_${activeUserId}`);
    }
    localStorage.removeItem('bilo_projects_data');
    localStorage.removeItem('bilo_tasks_data');
    localStorage.removeItem('bilo_sync_queue');
    localStorage.removeItem('bilo_backlog_filters');
    localStorage.removeItem('bilo_board_filters');
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

  async updateProfile(updates: { display_name?: string; avatar_url?: string | null }) {
    const currentUser = this.user();
    if (!currentUser) return;

    const currentProfile = this.userProfile() || {
      id: currentUser.id,
      email: currentUser.email || '',
      display_name: this.userName(),
      avatar_url: this.userAvatar()
    };

    const updatedProfile: UserProfile = {
      ...currentProfile,
      ...updates,
      updated_at: new Date().toISOString()
    };

    // 1. Update application state signal & local cache immediately
    this.userProfile.set(updatedProfile);
    localStorage.setItem(`bilo_user_profile_${currentUser.id}`, JSON.stringify(updatedProfile));

    // 2. Persist to user_profiles table in Supabase
    try {
      const { error } = await this.supabaseService.supabase
        .from('user_profiles')
        .upsert({
          id: currentUser.id,
          email: currentUser.email,
          display_name: updatedProfile.display_name,
          avatar_url: updatedProfile.avatar_url,
          updated_at: updatedProfile.updated_at
        });

      if (error) {
        console.warn('[AuthService] Supabase user_profiles upsert notice:', error.message);
      }
    } catch (e) {
      console.warn('[AuthService] Exception updating user_profiles table:', e);
    }

    // 3. Keep JWT Auth Token lightweight: Only pass essential minimal data in auth.updateUser
    try {
      await this.supabaseService.supabase.auth.updateUser({
        data: {
          display_name: updatedProfile.display_name
          // Notice: avatar_url is omitted from Auth JWT user_metadata to keep Bearer token small!
        }
      });
    } catch (e) {
      console.warn('[AuthService] Auth updateUser metadata sync skipped:', e);
    }
  }

  async uploadAvatarFile(file: File): Promise<string | null> {
    const currentUser = this.user();
    if (!currentUser) return null;

    try {
      const fileExt = file.name.split('.').pop() || 'png';
      const fileName = `avatar-${Date.now()}.${fileExt}`;
      const filePath = `${currentUser.id}/${fileName}`;

      // 1. Upload to Supabase Storage 'avatars' bucket
      const { error: uploadError } = await this.supabaseService.supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (!uploadError) {
        const { data } = this.supabaseService.supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        if (data?.publicUrl) {
          return data.publicUrl;
        }
      } else {
        console.warn('[AuthService] Supabase storage upload notice:', uploadError.message);
      }
    } catch (e) {
      console.warn('[AuthService] Supabase storage upload exception:', e);
    }

    // 2. Fallback if storage bucket is missing or offline: compress to a tiny 80x80 thumbnail (~2KB max)
    return await this.compressImageToTinyThumbnail(file);
  }

  private compressImageToTinyThumbnail(file: File): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        const size = 80;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, size, size);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        } else {
          resolve('');
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve('');
      };
      img.src = url;
    });
  }
}
