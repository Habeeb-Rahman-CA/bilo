import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BiloLogoComponent } from '../../shared/components/bilo-logo';

@Component({
  selector: 'app-maintenance',
  standalone: true,
  imports: [CommonModule, BiloLogoComponent],
  template: `
    <div class="maintenance-container font-mono">
      <!-- Background Ambient Grid Graphic -->
      <div class="maintenance-bg-grid"></div>

      <!-- Centered Maintenance Panel -->
      <div class="maintenance-card paper-panel">
        <div class="card-brand">
          <app-bilo-logo size="md" [showText]="true"></app-bilo-logo>
          <span class="badge-mono badge-amber">
            <span class="status-dot dot-amber pulse"></span> 503 MAINTENANCE MODE
          </span>
        </div>

        <div class="maintenance-icon-wrap">
          <i class="fi fi-rr-settings-sliders gear-icon"></i>
        </div>

        <h1 class="maintenance-title">System Under Maintenance</h1>
        
        <p class="maintenance-message">
          We are currently performing major system upgrades and infrastructure maintenance. 
          The site is temporarily unavailable while updates are deployed. Please check back later.
        </p>

        <div class="maintenance-footer-strip">
          <span class="status-dot dot-amber"></span>
          <span>Status: Major Updates In Progress</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 100vh;
      background-color: var(--bg-canvas);
      color: var(--text-main);
    }

    .maintenance-container {
      position: relative;
      width: 100%;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      box-sizing: border-box;
    }

    .maintenance-bg-grid {
      position: fixed;
      inset: 0;
      background-image: radial-gradient(var(--border-medium) 1px, transparent 1px);
      background-size: 24px 24px;
      opacity: 0.35;
      pointer-events: none;
      z-index: 0;
    }

    .maintenance-card {
      position: relative;
      z-index: 10;
      width: 100%;
      max-width: 540px;
      padding: 3rem 2.25rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 1.5rem;
      background: var(--bg-surface);
      border: 1px solid var(--border-medium);
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.05);
    }

    .card-brand {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
    }

    .maintenance-icon-wrap {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-medium);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0.5rem 0;
    }

    .gear-icon {
      font-size: 2.5rem;
      color: var(--accent-amber);
    }

    .maintenance-title {
      font-size: 2rem;
      font-weight: 800;
      margin: 0;
      color: var(--text-main);
      letter-spacing: -0.02em;
      line-height: 1.2;
    }

    .maintenance-message {
      font-size: 0.95rem;
      color: var(--text-muted);
      margin: 0;
      line-height: 1.65;
      max-width: 440px;
    }

    .maintenance-footer-strip {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-subtle);
      background: var(--bg-surface-subtle);
      padding: 0.4rem 0.85rem;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      margin-top: 0.5rem;
    }

    .pulse {
      animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
  `]
})
export class MaintenanceComponent {}
