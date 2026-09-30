import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProgressService } from '../../core/services/progress.service';

@Component({
  selector: 'app-progress-overlay',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (progressService.activeProgress(); as progress) {
      <div class="progress-toast-overlay font-mono" [class]="'progress-type-' + progress.type" role="status" aria-live="polite">
        <div class="progress-toast-card paper-panel">
          <div class="progress-toast-header">
            <div class="progress-title-group">
              <div class="progress-icon-box" [class]="progress.type">
                @switch (progress.type) {
                  @case ('batch') { <i class="fi fi-rr-boxes text-cyan"></i> }
                  @case ('export') { <i class="fi fi-rr-file-excel text-emerald"></i> }
                  @case ('upload') { <i class="fi fi-rr-cloud-upload text-sky"></i> }
                  @case ('sync') { <i class="fi fi-rr-refresh spin text-amber"></i> }
                  @default { <i class="fi fi-rr-spinner spin text-cyan"></i> }
                }
              </div>
              <div class="progress-text-box">
                <span class="progress-toast-title">{{ progress.title }}</span>
                <span class="progress-toast-msg">{{ progress.message }}</span>
              </div>
            </div>
            <div class="progress-pct-badge font-mono">
              {{ progress.percentage }}%
            </div>
          </div>

          <!-- Progress Meter Track -->
          <div class="progress-meter-container">
            <div class="progress-meter-track">
              <div
                class="progress-meter-fill"
                [class]="progress.type"
                [style.width.%]="progress.percentage"
              ></div>
            </div>
            <div class="progress-meta-row font-mono">
              @if (progress.loadedBytes && progress.totalBytes) {
                <span>{{ progressService.formatBytes(progress.loadedBytes) }} / {{ progressService.formatBytes(progress.totalBytes) }}</span>
              } @else if (progress.currentStep !== undefined && progress.totalSteps) {
                <span>Step {{ progress.currentStep }} of {{ progress.totalSteps }}</span>
              } @else {
                <span>Processing...</span>
              }
              <span>{{ progress.status === 'completed' ? 'Done' : (progress.status === 'failed' ? 'Failed' : 'In Progress') }}</span>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .progress-toast-overlay {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      z-index: 9999;
      max-width: 420px;
      width: calc(100vw - 4rem);
      animation: slideInUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes slideInUp {
      from {
        transform: translateY(20px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
    .progress-toast-card {
      padding: 1rem 1.25rem;
      background: var(--bg-surface-elevated, #18181b);
      border: 1px solid var(--border-medium, rgba(255, 255, 255, 0.12));
      border-radius: var(--radius-sm, 6px);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .progress-toast-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    .progress-title-group {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .progress-icon-box {
      width: 36px;
      height: 36px;
      border-radius: var(--radius-xs, 4px);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.15rem;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      flex-shrink: 0;
    }
    .progress-text-box {
      display: flex;
      flex-direction: column;
    }
    .progress-toast-title {
      font-weight: 700;
      font-size: 0.88rem;
      color: var(--text-primary, #f4f4f5);
      letter-spacing: -0.01em;
    }
    .progress-toast-msg {
      font-size: 0.75rem;
      color: var(--text-muted, #a1a1aa);
      margin-top: 2px;
    }
    .progress-pct-badge {
      font-size: 0.9rem;
      font-weight: 700;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.08);
      color: var(--accent-cyan, #06b6d4);
      border: 1px solid rgba(6, 182, 212, 0.2);
    }
    .progress-meter-container {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .progress-meter-track {
      width: 100%;
      height: 6px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 3px;
      overflow: hidden;
    }
    .progress-meter-fill {
      height: 100%;
      background: var(--accent-cyan, #06b6d4);
      transition: width 0.25s ease-out;
      border-radius: 3px;
    }
    .progress-meter-fill.export {
      background: var(--accent-emerald, #10b981);
    }
    .progress-meter-fill.upload {
      background: var(--accent-sky, #0284c7);
    }
    .progress-meter-fill.sync {
      background: var(--accent-amber, #f59e0b);
    }
    .progress-meta-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.72rem;
      color: var(--text-subtle, #71717a);
    }
  `]
})
export class ProgressOverlayComponent {
  constructor(public progressService: ProgressService) {}
}
