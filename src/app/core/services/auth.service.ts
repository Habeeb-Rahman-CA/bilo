import { Injectable, signal, computed, Injector, OnDestroy } from '@angular/core';
import { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { ProjectService } from './project.service';
import { TaskService } from './task.service';
import { WorkflowService } from './workflow.service';
import { SyncService } from './sync.service';
import { PushNotificationService } from './push-notification.service';
import { UserProfile } from '../models/user-profile.model';
import { globalAuthRateLimiter } from '../utils/rate-limiter.util';

@Injectable({
  providedIn: 'root'
})
export class AuthService implements OnDestroy {
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

  get isSupabaseConfigured(): boolean {
    return this.supabaseService ? this.supabaseService.isConfigured : false;
  }
  // Guard flags to prevent re-entrant cascading loops
  private _bootstrapping = false;
  private _sanitized = false;
  private authSubscription: { unsubscribe: () => void } | null = null;
  private authChannel: BroadcastChannel | null = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('bilo_auth_channel') : null;
  private storageEventListener: ((e: StorageEvent) => void) | null = null;

  constructor(
    private supabaseService: SupabaseService,
    private injector: Injector
  ) {
    this.initAuth();
    this.setupCrossTabSync();
  }

  private async initAuth() {
    try {
      if (!this.supabaseService.isConfigured) {
        console.warn('[AuthService] Supabase not configured in environment. Running in local workspace mode.');
        this.authLoading.set(false);
        return;
      }

      let session: Session | null = null;
      try {
        const { data, error } = await this.supabaseService.supabase.auth.getSession();
        if (error) {
          console.warn('[AuthService] getSession returned error notice:', error.message);
        }
        session = data?.session ?? null;
      } catch (sessionErr) {
        console.warn('[AuthService] getSession exception caught:', sessionErr);
      }

      // CRITICAL: If the access token is bloated (>4KB = has embedded avatar/picture),
      // it causes ERR_CONNECTION_RESET because Cloudflare/Kong rejects oversized headers.
      // We MUST clean it BEFORE any data API calls go out.
      if (session?.access_token && session.access_token.length > 4096) {
        console.warn(`[AuthService] Bloated JWT detected (${(session.access_token.length / 1024).toFixed(1)}KB). Sanitizing before data load...`);
        try {
          session = await this.sanitizeAndRefreshJwtToken(session);
        } catch (sErr) {
          console.warn('[AuthService] Token sanitization notice:', sErr);
        }
      }

      this.session.set(session);
      this.user.set(session?.user ?? null);

      if (session?.user) {
        try {
          await this.loadUserProfileBootstrap(session.user);
          await this.reloadServicesData();
        } catch (bErr) {
          console.warn('[AuthService] Bootstrap data load notice:', bErr);
        }
      }
    } catch (e) {
      console.warn('Auth initialization skipped in offline mode', e);
    } finally {
      this.authLoading.set(false);
    }

    try {
      if (this.supabaseService.isConfigured) {
        if (this.authSubscription) {
          try {
            this.authSubscription.unsubscribe();
          } catch (e) {}
          this.authSubscription = null;
        }

        const { data } = this.supabaseService.supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
          try {
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
          } catch (listenerErr) {
            console.warn('[AuthService] onAuthStateChange listener notice:', listenerErr);
          } finally {
            this.authLoading.set(false);
          }
        });

        this.authSubscription = data?.subscription ?? null;
      }
    } catch (subErr) {
      console.warn('[AuthService] onAuthStateChange subscription notice:', subErr);
      this.authLoading.set(false);
    }
  }

  private setupCrossTabSync() {
    if (this.authChannel) {
      try {
        this.authChannel.onmessage = (event) => {
          if (event.data?.type === 'SIGN_OUT') {
            console.log('[AuthService] Cross-tab SIGN_OUT received via BroadcastChannel.');
            this.handleCrossTabSignOut();
          }
        };
      } catch (e) {}
    }

    if (typeof window !== 'undefined') {
      this.storageEventListener = (event: StorageEvent) => {
        if (event.key === null || (event.key && (event.key.includes('sb-') || event.key.includes('bilo_')) && event.newValue === null)) {
          console.log('[AuthService] Cross-tab storage clear detected.');
          this.handleCrossTabSignOut();
        }
      };
      window.addEventListener('storage', this.storageEventListener);
    }
  }

  handleCrossTabSignOut() {
    this.user.set(null);
    this.session.set(null);
    this.userProfile.set(null);
    this._sanitized = false;
    this.resetServicesState();
  }

  ngOnDestroy() {
    if (this.authSubscription) {
      try {
        this.authSubscription.unsubscribe();
      } catch (e) {}
      this.authSubscription = null;
    }
    if (this.storageEventListener && typeof window !== 'undefined') {
      window.removeEventListener('storage', this.storageEventListener);
      this.storageEventListener = null;
    }
    if (this.authChannel) {
      try {
        this.authChannel.close();
      } catch (e) {}
      this.authChannel = null;
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
    this.user.set(null);
    this.session.set(null);
    this.userProfile.set(null);
    this._sanitized = false;
    try {
      const projectService = this.injector.get(ProjectService);
      const taskService = this.injector.get(TaskService);
      const workflowService = this.injector.get(WorkflowService);
      const syncService = this.injector.get(SyncService);
      const pushNotificationService = this.injector.get(PushNotificationService);
      projectService.resetState();
      taskService.resetState();
      workflowService.resetState();
      syncService.resetState();
      pushNotificationService.resetState();
    } catch (e) {
      console.warn('[AuthService] Error resetting state:', e);
    }
    localStorage.removeItem('bilo_projects_data');
    localStorage.removeItem('bilo_tasks_data');
    localStorage.removeItem('bilo_sync_queue');
    localStorage.removeItem('bilo_notification_history');
    localStorage.removeItem('bilo_backlog_filters');
    localStorage.removeItem('bilo_board_filters');
    localStorage.removeItem('bilo_workflows_by_project');
    localStorage.removeItem('bilo_active_project_id');
  }

  async purgeAllUserDataFromRemoteAndLocal(): Promise<void> {
    const currentUser = this.user();
    if (!currentUser?.id) {
      this.resetServicesState();
      return;
    }

    const uid = currentUser.id;
    if (this.supabaseService.isConfigured && this.supabaseService.supabase) {
      const sb = this.supabaseService.supabase;
      try {
        await Promise.allSettled([
          sb.from('tasks').delete().eq('user_id', uid),
          sb.from('task_comments').delete().eq('user_id', uid),
          sb.from('task_status_history').delete().eq('user_id', uid),
          sb.from('project_activities').delete().eq('user_id', uid),
          sb.from('workflows').delete().eq('user_id', uid),
          sb.from('projects').delete().eq('user_id', uid)
        ]);
      } catch (e) {
        console.warn('[AuthService] Supabase user data purge warning:', e);
      }
    }

    localStorage.removeItem(`bilo_projects_data_${uid}`);
    localStorage.removeItem(`bilo_tasks_data_${uid}`);
    localStorage.removeItem(`bilo_workflows_by_project_${uid}`);
    localStorage.removeItem(`bilo_sync_queue_${uid}`);
    localStorage.removeItem(`bilo_dlq_${uid}`);
    localStorage.removeItem(`bilo_user_profile_${uid}`);
    localStorage.removeItem(`bilo_notification_history_${uid}`);

    this.resetServicesState();
  }

  async reloadServicesData() {
    try {
      const projectService = this.injector.get(ProjectService);
      const taskService = this.injector.get(TaskService);
      const workflowService = this.injector.get(WorkflowService);
      const syncService = this.injector.get(SyncService);
      const pushNotificationService = this.injector.get(PushNotificationService);

      await Promise.all([
        syncService.loadQueueFromStorage(this.user()?.id),
        syncService.loadDlqFromStorage(this.user()?.id)
      ]);
      pushNotificationService.loadHistoryFromStorage(this.user()?.id);
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
    const trimmedEmail = email ? email.trim() : '';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      return {
        data: { user: null, session: null },
        error: { message: 'Invalid email address format' } as any
      };
    }

    if (!password || password.length < 6) {
      return {
        data: { user: null, session: null },
        error: { message: 'Password must be at least 6 characters long' } as any
      };
    }

    return await this.supabaseService.supabase.auth.signUp({
      email: trimmedEmail,
      password
    });
  }

  async signInWithEmailPassword(email: string, password: string) {
    const rateLimit = globalAuthRateLimiter.checkLoginRateLimit(email);
    if (!rateLimit.allowed) {
      return {
        data: { user: null, session: null },
        error: { message: rateLimit.message || 'Too many failed login attempts. Please wait before trying again.' } as any
      };
    }

    const res = await this.supabaseService.supabase.auth.signInWithPassword({
      email,
      password
    });

    if (res?.error) {
      globalAuthRateLimiter.recordFailedLogin(email);
    } else {
      globalAuthRateLimiter.recordSuccessfulLogin(email);
    }

    return res;
  }

  async signInWithMagicLink(email: string) {
    const trimmedEmail = email ? email.trim() : '';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      return {
        data: { user: null, session: null },
        error: { message: 'Invalid email address format' } as any
      };
    }

    const rateLimit = globalAuthRateLimiter.checkMagicLinkRateLimit(trimmedEmail);
    if (!rateLimit.allowed) {
      return {
        data: { user: null, session: null },
        error: { message: rateLimit.message || 'Magic link request rate limited. Please wait before requesting another email.' } as any
      };
    }

    try {
      const res = await this.supabaseService.supabase.auth.signInWithOtp({ email: trimmedEmail });
      if (res?.error) {
        return {
          data: { user: null, session: null },
          error: res.error
        };
      }
      globalAuthRateLimiter.recordMagicLinkSent(trimmedEmail);
      return res;
    } catch (e: any) {
      return {
        data: { user: null, session: null },
        error: { message: e?.message || 'Failed to send magic link. Please check network connection.' } as any
      };
    }
  }

  async signOut() {
    const activeUserId = this.user()?.id;
    if (this.authChannel) {
      try {
        this.authChannel.postMessage({ type: 'SIGN_OUT' });
      } catch (e) {}
    }

    const res = await this.supabaseService.supabase.auth.signOut();
    this.handleCrossTabSignOut();

    if (activeUserId) {
      localStorage.removeItem(`bilo_user_profile_${activeUserId}`);
      localStorage.removeItem(`bilo_sync_queue_${activeUserId}`);
      localStorage.removeItem(`bilo_notification_history_${activeUserId}`);
    }
    localStorage.removeItem('bilo_notification_history');
    return res;
  }

  async claimUnassignedData(): Promise<{ success: boolean; method: 'rpc' | 'fallback'; error?: string }> {
    const currentUser = this.user();
    if (!currentUser) {
      return { success: false, method: 'fallback', error: 'No active authenticated user session.' };
    }

    let rpcSuccess = false;
    let rpcErrorMessage = '';

    try {
      const { error } = await this.supabaseService.supabase.rpc('migrate_unassigned_data_to_user', {
        target_user_id: currentUser.id
      });
      if (!error) {
        rpcSuccess = true;
        console.log('[AuthService] Successfully claimed unassigned workspace data via RPC for user:', currentUser.email);
      } else {
        rpcErrorMessage = error.message;
        console.warn('[AuthService] RPC migrate_unassigned_data_to_user failed or function not present:', error.message);
      }
    } catch (e: any) {
      rpcErrorMessage = e?.message || 'RPC call exception';
      console.warn('[AuthService] Exception claiming unassigned data via RPC:', e);
    }

    let fallbackSuccess = false;
    let fallbackErrorMessage = '';

    if (!rpcSuccess) {
      try {
        // Fallback Step 1: Claim unassigned projects (user_id IS NULL)
        const { error: projErr } = await this.supabaseService.supabase
          .from('projects')
          .update({ user_id: currentUser.id })
          .is('user_id', null);

        if (projErr) {
          console.warn('[AuthService] Fallback project claim notice:', projErr.message);
        }

        // Fallback Step 2: Claim unassigned tasks (user_id IS NULL)
        const { error: taskErr } = await this.supabaseService.supabase
          .from('tasks')
          .update({ user_id: currentUser.id })
          .is('user_id', null);

        if (taskErr) {
          console.warn('[AuthService] Fallback task claim notice:', taskErr.message);
        }

        fallbackSuccess = !projErr && !taskErr;
        if (projErr || taskErr) {
          fallbackErrorMessage = projErr?.message || taskErr?.message || 'Partial fallback update error';
        }
        console.log('[AuthService] Completed client-side fallback data migration for user:', currentUser.email);
      } catch (fallbackErr: any) {
        fallbackErrorMessage = fallbackErr?.message || 'Fallback exception';
        console.error('[AuthService] Exception during fallback data migration:', fallbackErr);
      }
    }

    // Reload services data to ensure UI signals contain claimed data
    try {
      const projectService = this.injector.get(ProjectService);
      const taskService = this.injector.get(TaskService);
      const workflowService = this.injector.get(WorkflowService);
      await Promise.all([
        projectService.loadFromSupabase(),
        taskService.loadTasksFromSupabase(),
        workflowService.loadAllWorkflows()
      ]);
    } catch (reloadErr) {
      console.warn('[AuthService] Services reload error after claiming unassigned data:', reloadErr);
    }

    if (rpcSuccess) {
      return { success: true, method: 'rpc' };
    }
    return {
      success: fallbackSuccess,
      method: 'fallback',
      error: fallbackErrorMessage || rpcErrorMessage
    };
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

    if (updates.display_name !== undefined) {
      const trimmedName = updates.display_name ? updates.display_name.trim() : '';
      if (!trimmedName) {
        throw new Error('Display name cannot be empty');
      }
      if (trimmedName.length > 20) {
        throw new Error('Display name must not exceed 20 characters');
      }
      updates = { ...updates, display_name: trimmedName };
    }

    if (updates.avatar_url !== undefined && updates.avatar_url !== null) {
      const trimmedAvatar = updates.avatar_url.trim();
      if (!trimmedAvatar) {
        updates = { ...updates, avatar_url: null };
      } else {
        const isDataImage = /^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,/i.test(trimmedAvatar);
        const isBlobUrl = /^blob:https?:\/\//i.test(trimmedAvatar);
        let isValidHttpUrl = false;
        try {
          const parsed = new URL(trimmedAvatar);
          isValidHttpUrl = parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
          isValidHttpUrl = false;
        }

        if (!isDataImage && !isBlobUrl && !isValidHttpUrl) {
          throw new Error('Invalid avatar URL. Must be a valid http/https URL or image data URI');
        }
        updates = { ...updates, avatar_url: trimmedAvatar };
      }
    }

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
