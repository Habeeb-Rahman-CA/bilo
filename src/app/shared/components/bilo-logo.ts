import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-bilo-logo',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bilo-logo-wrapper" [ngClass]="['size-' + size, classNames]" [class.compact]="compact">
      <div class="bilo-logo-mark" title="bilo Developer Project Manager">
        <img [src]="themeService.isDarkMode() ? 'bilo-icon-dark.png' : 'bilo-icon-light.png'" class="bilo-logo-img" alt="bilo Logo" />
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      vertical-align: middle;
    }

    .bilo-logo-wrapper {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      user-select: none;
      transition: transform 0.2s ease;
    }

    .bilo-logo-wrapper:hover .bilo-logo-mark {
      transform: scale(1.08);
    }

    .bilo-logo-mark {
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      flex-shrink: 0;
    }

    .bilo-logo-img {
      display: block;
      object-fit: contain;
      transition: var(--transition-fast, all 0.2s ease);
    }

    /* Size variants */
    .size-xs .bilo-logo-img { width: 34px; height: 34px; }
    .size-sm .bilo-logo-img { width: 40px; height: 40px; }
    .size-md .bilo-logo-img { width: 44px; height: 44px; }
    .size-lg .bilo-logo-img { width: 52px; height: 52px; }
    .size-xl .bilo-logo-img { width: 64px; height: 64px; }

    .bilo-logo-brand {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      line-height: 1;
    }

    .brand-title {
      font-weight: 800;
      letter-spacing: -0.03em;
      color: var(--text-main, #f3f4f6);
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
    }

    .size-xs .brand-title { font-size: 0.8rem; }
    .size-sm .brand-title { font-size: 0.95rem; }
    .size-md .brand-title { font-size: 1.1rem; }
    .size-lg .brand-title { font-size: 1.4rem; }
    .size-xl .brand-title { font-size: 1.8rem; }

    .brand-badge {
      font-size: 0.6rem;
      font-weight: 700;
      padding: 0.15rem 0.35rem;
      background: var(--bg-surface-subtle, rgba(255, 255, 255, 0.08));
      border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.12));
      border-radius: var(--radius-xs, 3px);
      color: var(--accent-cyan, #06b6d4);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
  `]
})
export class BiloLogoComponent {
  @Input() size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'sm';
  @Input() showText = true;
  @Input() compact = false;
  @Input() badge?: string;
  @Input() classNames = '';

  constructor(public themeService: ThemeService) {}
}

