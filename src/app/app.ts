import { Component, signal, computed, ElementRef, ViewChild, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkspaceService, WorkspaceSection } from './core/services/workspace.service';
import { SyncService } from './core/services/sync.service';
import { UpdateService } from './core/services/update.service';
import { TodayComponent } from './features/today/today';
import { TasksComponent } from './features/tasks/tasks';
import { BacklogComponent } from './features/backlog/backlog';
import { CalendarComponent } from './features/calendar/calendar';
import { ArchiveComponent } from './features/archive/archive';
import { SettingsComponent } from './features/settings/settings';
import { CommandPaletteComponent } from './shared/components/command-palette';
import { ShortcutsModalComponent } from './shared/components/shortcuts-modal';
import { TaskModalComponent } from './shared/components/task-modal';

import { TaskShareService } from './core/services/task-share.service';
import { PushNotificationService } from './core/services/push-notification.service';
import { ToastService } from './core/services/toast.service';
import { ThemeService } from './core/services/theme.service';
import { AuthService } from './core/services/auth.service';
import { SupabaseService } from './core/services/supabase.service';
import { ProjectService } from './core/services/project.service';
import { TaskDetailModalComponent } from './shared/components/task-detail-modal';
import { PushNotificationModalComponent } from './shared/components/push-notification-modal';
import { BiloLogoComponent } from './shared/components/bilo-logo';
import { AuthModalComponent } from './shared/components/auth-modal';
import { ProjectAccessModalComponent } from './shared/components/project-access-modal';
import { WorkspaceSwitcherComponent } from './shared/components/workspace-switcher';
import { ProjectModalComponent } from './shared/components/project-modal';
import { JoinWorkspaceModalComponent } from './shared/components/join-workspace-modal';
import { ReportIssueModalComponent } from './shared/components/report-issue-modal';
import { EditProfileModalComponent } from './shared/components/edit-profile-modal';
import { AuthPageComponent } from './features/auth/auth-page';
import { LandingPageComponent } from './features/landing/landing-page';
import { TaskService } from './core/services/task.service';
import { Task, ProjectRole, Project } from './core/models/project.model';
import { verifySecureInviteToken, VerifiedInvitePayload } from './core/utils/invite-token.util';
import { registerOpenPopover, unregisterOpenPopover, ClosablePopover } from './shared/components/select';

import { MaintenanceComponent } from './features/maintenance/maintenance';

import { ProgressOverlayComponent } from './shared/components/progress-overlay';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    BiloLogoComponent,
    ProgressOverlayComponent,
    WorkspaceSwitcherComponent,
    ProjectModalComponent,
    JoinWorkspaceModalComponent,
    ReportIssueModalComponent,
    TodayComponent,
    TasksComponent,
    BacklogComponent,
    CalendarComponent,
    ArchiveComponent,
    SettingsComponent,
    CommandPaletteComponent,
    ShortcutsModalComponent,
    TaskModalComponent,
    TaskDetailModalComponent,
    AuthModalComponent,
    ProjectAccessModalComponent,
    EditProfileModalComponent,
    AuthPageComponent,
    LandingPageComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  readonly appVersion = 'v1.2.0';
  sidebarCollapsed = signal<boolean>(false);
  mobileMenuOpen = signal<boolean>(false);
  editingSharedTask = signal<Task | null>(null);
  pushNotificationModalOpen = signal<boolean>(false);
  projectAccessModalOpen = signal<boolean>(false);
  createProjectModalOpen = signal<boolean>(false);
  editProfileModalOpen = signal<boolean>(false);
  userMenuOpen = signal<boolean>(false);
  notificationMenuOpen = signal<boolean>(false);
  notificationsExpanded = signal<boolean>(false);
  mobileMoreMenuOpen = signal<boolean>(false);
  retryingConnection = signal<boolean>(false);
  showAuthPage = signal<boolean>(false);

  // PWA Pull to Refresh State & Signals
  pullDistance = signal<number>(0);
  isPullThresholdReached = signal<boolean>(false);
  isRefreshingData = signal<boolean>(false);

  private touchStartY = 0;
  private touchStartX = 0;
  private isPulling = false;

  private userMenuPopoverInstance: ClosablePopover = {
    closePopover: () => this.closeUserMenu()
  };

  private notificationMenuPopoverInstance: ClosablePopover = {
    closePopover: () => this.closeNotificationMenu()
  };

  private mobileMoreMenuPopoverInstance: ClosablePopover = {
    closePopover: () => this.closeMobileMoreMenu()
  };

  isMoreWorkspaceActive = computed(() => {
    const ws = this.workspaceService.activeWorkspace();
    return ws === '04 CALENDAR' || ws === '05 ARCHIVE' || ws === '06 SETTINGS';
  });

  // Incoming Invite Link State
  incomingInviteProjectId = signal<string | null>(null);
  incomingInviteRole = signal<ProjectRole>('member');
  incomingInviteProject = signal<Project | null>(null);
  incomingInviteIssuedAt = signal<number | undefined>(undefined);
  incomingInviteToken = signal<string | null>(null);

  userName = computed(() => {
    const u = this.authService.user();
    if (!u) return 'Guest User';
    const meta = u.user_metadata;
    if (meta && meta['display_name']) return meta['display_name'];
    if (meta && meta['full_name']) return meta['full_name'];
    if (u.email) {
      const parts = u.email.split('@')[0];
      return parts.charAt(0).toUpperCase() + parts.slice(1);
    }
    return 'User';
  });

  constructor(
    public workspaceService: WorkspaceService,
    public syncService: SyncService,
    public updateService: UpdateService,
    public taskShareService: TaskShareService,
    public pushService: PushNotificationService,
    public toastService: ToastService,
    public themeService: ThemeService,
    public authService: AuthService,
    public projectService: ProjectService,
    public taskService: TaskService,
    public supabaseService: SupabaseService
  ) {}

  @HostListener('window:touchstart', ['$event'])
  onAppTouchStart(e: TouchEvent) {
    if (!e.touches || e.touches.length === 0 || this.isRefreshingData()) return;
    const touch = e.touches[0];
    const scrollContainer = this.findScrollableContainer(e.target as HTMLElement);
    const scrollTop = scrollContainer ? scrollContainer.scrollTop : (window.scrollY || document.documentElement.scrollTop || 0);

    if (scrollTop <= 2) {
      this.touchStartY = touch.clientY;
      this.touchStartX = touch.clientX;
      this.isPulling = true;
    } else {
      this.isPulling = false;
    }
  }

  @HostListener('window:touchmove', ['$event'])
  onAppTouchMove(e: TouchEvent) {
    if (!this.isPulling || !e.touches || e.touches.length === 0 || this.isRefreshingData()) return;
    const touch = e.touches[0];
    const deltaY = touch.clientY - this.touchStartY;
    const deltaX = Math.abs(touch.clientX - this.touchStartX);

    if (deltaX > Math.abs(deltaY) && deltaY < 30) {
      this.isPulling = false;
      this.pullDistance.set(0);
      this.isPullThresholdReached.set(false);
      return;
    }

    if (deltaY > 0) {
      const distance = Math.min(85, Math.pow(deltaY, 0.82) * 1.6);
      this.pullDistance.set(distance);
      const thresholdMet = distance >= 65;
      if (thresholdMet && !this.isPullThresholdReached()) {
        this.isPullThresholdReached.set(true);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate(25); } catch (_) {}
        }
      } else if (!thresholdMet && this.isPullThresholdReached()) {
        this.isPullThresholdReached.set(false);
      }
    }
  }

  @HostListener('window:touchend')
  @HostListener('window:touchcancel')
  async onAppTouchEnd() {
    if (!this.isPulling && this.pullDistance() === 0) return;
    this.isPulling = false;

    if (this.isPullThresholdReached() && !this.isRefreshingData()) {
      await this.triggerPullToRefresh();
    } else {
      this.pullDistance.set(0);
      this.isPullThresholdReached.set(false);
    }
  }

  async triggerPullToRefresh() {
    this.isRefreshingData.set(true);
    this.pullDistance.set(65);

    const minDelay = new Promise(resolve => setTimeout(resolve, 600));

    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(35); } catch (_) {}
      }

      await Promise.all([
        this.projectService?.loadFromSupabase?.(),
        this.taskService?.loadTasksFromSupabase?.(),
        this.syncService?.retryConnection?.(),
        minDelay
      ]);
    } catch (err) {
      console.error('[PullToRefresh] Refresh failed:', err);
      this.toastService?.error?.('Refresh failed. Check network connection.');
    } finally {
      setTimeout(() => {
        this.isRefreshingData.set(false);
        this.pullDistance.set(0);
        this.isPullThresholdReached.set(false);
      }, 300);
    }
  }

  private findScrollableContainer(target: HTMLElement | null): HTMLElement | null {
    let curr = target;
    while (curr && curr !== document.body) {
      const overflowY = window.getComputedStyle(curr).overflowY;
      if ((overflowY === 'auto' || overflowY === 'scroll') && curr.scrollHeight > curr.clientHeight) {
        return curr;
      }
      curr = curr.parentElement;
    }
    return null;
  }

  async retryConnection() {
    if (this.retryingConnection()) return;
    this.retryingConnection.set(true);
    this.isRefreshingData.set(true);
    try {
      const restored = await this.syncService.retryConnection();
      if (restored) {
        await this.taskService.loadTasksFromSupabase();
        await this.projectService.loadFromSupabase();
      }
    } finally {
      this.retryingConnection.set(false);
      setTimeout(() => this.isRefreshingData.set(false), 300);
    }
  }

  async ngOnInit() {
    this.checkIncomingInviteLink();
  }

  async checkIncomingInviteLink() {
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      const rawInvite = params.get('invite');
      const rawRole = (params.get('role') || 'member') as ProjectRole;

      let verifiedPayload: VerifiedInvitePayload | null = null;

      if (token) {
        verifiedPayload = await verifySecureInviteToken(token);
        if (!verifiedPayload) {
          console.warn('[Auth/Invite] Invalid, tampered, or expired workspace invite token');
          this.taskShareService.showToast('Workspace invite link is invalid or expired.');
          return;
        }
        this.incomingInviteToken.set(token);
      } else if (rawInvite) {
        // Fallback for valid legacy UUID links
        if (this.syncService.isValidUuid(rawInvite)) {
          verifiedPayload = {
            projectId: rawInvite,
            role: rawRole,
            expiresAt: Date.now() + 86400000,
            nonce: 'legacy'
          };
        }
      }

      if (verifiedPayload) {
        this.incomingInviteProjectId.set(verifiedPayload.projectId);
        this.incomingInviteRole.set(verifiedPayload.role);
        this.incomingInviteIssuedAt.set(verifiedPayload.issuedAt);

        // Fetch workspace details for confirmation modal preview
        const proj = await this.projectService.fetchProjectById(verifiedPayload.projectId);
        this.incomingInviteProject.set(proj);
      }
    } catch (e) {
      console.warn('Failed to parse incoming invite parameters:', e);
    }
  }

  async acceptWorkspaceInvite() {
    const projId = this.incomingInviteProjectId();
    const role = this.incomingInviteRole();
    const iat = this.incomingInviteIssuedAt();
    const token = this.incomingInviteToken();

    if (projId) {
      const result = await this.projectService.joinProjectViaInvite(projId, role, iat, token || undefined);
      if (result.success && result.project) {
        this.taskShareService.showToast(`Joined workspace "${result.project.name}" successfully!`);
      } else if (result.error) {
        this.taskShareService.showToast(result.error);
      } else {
        this.taskShareService.showToast('Failed to join workspace.');
      }
    }

    this.clearInviteState();
  }

  clearInviteState() {
    this.incomingInviteProjectId.set(null);
    this.incomingInviteProject.set(null);
    this.incomingInviteIssuedAt.set(undefined);
    this.incomingInviteToken.set(null);

    // Clean up query param from URL without refreshing page
    if (window.history && window.history.replaceState) {
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (this.userMenuOpen() && !target.closest('.user-menu-container')) {
      this.closeUserMenu();
    }
    if (this.notificationMenuOpen() && !target.closest('.notification-menu-container')) {
      this.closeNotificationMenu();
    }
    if (this.mobileMoreMenuOpen() && !target.closest('.mobile-more-menu-container')) {
      this.closeMobileMoreMenu();
    }
  }

  openUserMenu() {
    registerOpenPopover(this.userMenuPopoverInstance);
    this.userMenuOpen.set(true);
  }

  closeUserMenu() {
    if (this.userMenuOpen()) {
      unregisterOpenPopover(this.userMenuPopoverInstance);
      this.userMenuOpen.set(false);
      this.notificationsExpanded.set(false);
    }
  }

  toggleNotificationsExpanded() {
    this.notificationsExpanded.update(v => !v);
  }

  toggleUserMenu(event: MouseEvent) {
    event.stopPropagation();
    if (this.userMenuOpen()) {
      this.closeUserMenu();
    } else {
      this.openUserMenu();
    }
  }

  openNotificationMenu() {
    registerOpenPopover(this.notificationMenuPopoverInstance);
    this.notificationMenuOpen.set(true);
  }

  closeNotificationMenu() {
    if (this.notificationMenuOpen()) {
      unregisterOpenPopover(this.notificationMenuPopoverInstance);
      this.notificationMenuOpen.set(false);
    }
  }

  toggleNotificationMenu(event: MouseEvent) {
    event.stopPropagation();
    if (this.notificationMenuOpen()) {
      this.closeNotificationMenu();
    } else {
      this.openNotificationMenu();
    }
  }

  openMobileMoreMenu() {
    registerOpenPopover(this.mobileMoreMenuPopoverInstance);
    this.mobileMoreMenuOpen.set(true);
  }

  closeMobileMoreMenu() {
    if (this.mobileMoreMenuOpen()) {
      unregisterOpenPopover(this.mobileMoreMenuPopoverInstance);
      this.mobileMoreMenuOpen.set(false);
    }
  }

  toggleMobileMoreMenu(event: MouseEvent) {
    event.stopPropagation();
    if (this.mobileMoreMenuOpen()) {
      this.closeMobileMoreMenu();
    } else {
      this.openMobileMoreMenu();
    }
  }

  openNotificationSettings() {
    this.closeNotificationMenu();
    this.selectWorkspace('06 SETTINGS');
  }

  signOutUser() {
    this.closeUserMenu();
    this.authService.signOut();
  }

  deferredPrompt: any = null;
  canInstallPwa = signal<boolean>(false);

  @HostListener('window:beforeinstallprompt', ['$event'])
  onBeforeInstallPrompt(e: Event) {
    e.preventDefault();
    this.deferredPrompt = e;
    this.canInstallPwa.set(true);
  }

  async installPwa() {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      const choiceResult = await this.deferredPrompt.userChoice;
      if (choiceResult && choiceResult.outcome === 'accepted') {
        this.canInstallPwa.set(false);
      }
      this.deferredPrompt = null;
    }
  }

  togglePushNotificationModal() {
    this.selectWorkspace('06 SETTINGS');
  }

  toggleSidebar() {
    this.sidebarCollapsed.update(v => !v);
  }

  selectWorkspace(wsId: WorkspaceSection) {
    this.workspaceService.setWorkspace(wsId);
    this.mobileMenuOpen.set(false);
    this.closeMobileMoreMenu();
  }

  onEditSharedTask(task: Task) {
    this.editingSharedTask.set(task);
    this.taskShareService.closeSharedTaskModal();
  }

  closeEditSharedModal() {
    this.editingSharedTask.set(null);
  }
}
