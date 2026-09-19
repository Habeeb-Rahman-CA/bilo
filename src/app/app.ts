import { Component, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkspaceService, WorkspaceSection } from './core/services/workspace.service';
import { SyncService } from './core/services/sync.service';
import { UpdateService } from './core/services/update.service';
import { TodayComponent } from './features/today/today';
import { ProjectsComponent } from './features/projects/projects';
import { TasksComponent } from './features/tasks/tasks';
import { BacklogComponent } from './features/backlog/backlog';
import { CalendarComponent } from './features/calendar/calendar';
import { ArchiveComponent } from './features/archive/archive';
import { CommandPaletteComponent } from './shared/components/command-palette';
import { ShortcutsModalComponent } from './shared/components/shortcuts-modal';
import { TaskModalComponent } from './shared/components/task-modal';

import { TaskShareService } from './core/services/task-share.service';
import { PushNotificationService } from './core/services/push-notification.service';
import { TaskDetailModalComponent } from './shared/components/task-detail-modal';
import { PushNotificationModalComponent } from './shared/components/push-notification-modal';
import { BiloLogoComponent } from './shared/components/bilo-logo';
import { Task } from './core/models/project.model';

import { MaintenanceComponent } from './features/maintenance/maintenance';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    BiloLogoComponent,
    MaintenanceComponent,
    TodayComponent,
    ProjectsComponent,
    TasksComponent,
    BacklogComponent,
    CalendarComponent,
    ArchiveComponent,
    CommandPaletteComponent,
    ShortcutsModalComponent,
    TaskModalComponent,
    TaskDetailModalComponent,
    PushNotificationModalComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  readonly appVersion = 'v1.1.1';
  sidebarCollapsed = signal<boolean>(false);
  mobileMenuOpen = signal<boolean>(false);
  editingSharedTask = signal<Task | null>(null);
  pushNotificationModalOpen = signal<boolean>(false);

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

  constructor(
    public workspaceService: WorkspaceService,
    public syncService: SyncService,
    public updateService: UpdateService,
    public taskShareService: TaskShareService,
    public pushService: PushNotificationService
  ) {}

  togglePushNotificationModal() {
    this.pushNotificationModalOpen.update(v => !v);
  }

  toggleSidebar() {
    this.sidebarCollapsed.update(v => !v);
  }

  selectWorkspace(wsId: WorkspaceSection) {
    this.workspaceService.setWorkspace(wsId);
    this.mobileMenuOpen.set(false);
  }

  onEditSharedTask(task: Task) {
    this.editingSharedTask.set(task);
    this.taskShareService.closeSharedTaskModal();
  }

  closeEditSharedModal() {
    this.editingSharedTask.set(null);
  }
}
