import { Component, EventEmitter, Input, Output, ViewChild, ElementRef, SecurityContext } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-rich-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="rich-editor-container paper-panel" [class.readonly-mode]="readonly">
      @if (!readonly) {
        <!-- Editor Header & Toolbar -->
        <div class="rich-toolbar">
          <div class="toolbar-left">
            <!-- Mode Tabs -->
            <div class="editor-tabs">
              <button
                type="button"
                class="tab-btn"
                [class.active]="activeTab === 'write'"
                (click)="activeTab = 'write'"
                title="Write Markdown Content"
              >
                <i class="fi fi-rr-edit font-icon"></i> Write
              </button>
              <button
                type="button"
                class="tab-btn"
                [class.active]="activeTab === 'preview'"
                (click)="activeTab = 'preview'"
                title="Preview Formatted Output"
              >
                <i class="fi fi-rr-eye font-icon"></i> Preview
              </button>
            </div>

            <div class="toolbar-divider"></div>

            @if (activeTab === 'write') {
              <!-- Formatting Action Buttons -->
              <div class="format-actions">
                <button type="button" class="tool-btn" (click)="applyFormat('h1')" title="Heading 1 (# Heading)">
                  <span class="text-fmt font-mono fw-bold">H1</span>
                </button>
                <button type="button" class="tool-btn" (click)="applyFormat('h2')" title="Heading 2 (## Heading)">
                  <span class="text-fmt font-mono fw-bold">H2</span>
                </button>
                <button type="button" class="tool-btn" (click)="applyFormat('h3')" title="Heading 3 (### Heading)">
                  <span class="text-fmt font-mono fw-bold">H3</span>
                </button>

                <div class="toolbar-divider"></div>

                <button type="button" class="tool-btn" (click)="applyFormat('bold')" title="Bold (**text**)">
                  <i class="fi fi-rr-bold"></i>
                </button>
                <button type="button" class="tool-btn" (click)="applyFormat('italic')" title="Italic (*text*)">
                  <i class="fi fi-rr-italic"></i>
                </button>
                <button type="button" class="tool-btn" (click)="applyFormat('strike')" title="Strikethrough (~~text~~)">
                  <i class="fi fi-rr-strikethrough"></i>
                </button>

                <div class="toolbar-divider"></div>

                <button type="button" class="tool-btn" (click)="applyFormat('bullet')" title="Bullet List (- item)">
                  <i class="fi fi-rr-list"></i>
                </button>
                <button type="button" class="tool-btn" (click)="applyFormat('number')" title="Numbered List (1. item)">
                  <i class="fi fi-rr-list-check"></i>
                </button>
                <button type="button" class="tool-btn" (click)="applyFormat('checklist')" title="Checklist (- [ ] task)">
                  <i class="fi fi-rr-checkbox"></i>
                </button>

                <div class="toolbar-divider"></div>

                <button type="button" class="tool-btn" (click)="applyFormat('quote')" title="Quote (&gt; quote)">
                  <i class="fi fi-rr-quote-right"></i>
                </button>
                <button type="button" class="tool-btn" (click)="applyFormat('code')" title="Inline Code">
                  <i class="fi fi-rr-brackets-curly"></i>
                </button>
                <button type="button" class="tool-btn" (click)="applyFormat('codeblock')" title="Code Block">
                  <i class="fi fi-rr-code-simple"></i>
                </button>
                <button type="button" class="tool-btn" (click)="applyFormat('hr')" title="Divider (---)">
                  <i class="fi fi-rr-minus"></i>
                </button>
              </div>
            }
          </div>

          <div class="toolbar-right">
            <span class="fmt-hint font-mono">Markdown Supported</span>
          </div>
        </div>
      }

      <!-- Editor Content Body -->
      <div class="editor-body">
        @if (!readonly && activeTab === 'write') {
          <textarea
            #textareaEl
            class="editor-textarea font-mono"
            [rows]="minRows"
            [placeholder]="placeholder"
            [ngModel]="value"
            (ngModelChange)="onTextChange($event)"
            (keydown)="handleKeydown($event)"
          ></textarea>
        } @else {
          <div class="markdown-preview-render" [innerHTML]="renderedContent"></div>
        }
      </div>
    </div>
  `,
  styles: [`
    .rich-editor-container {
      border: 1px solid var(--border-medium);
      border-radius: var(--radius-sm);
      background: var(--bg-surface);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: border-color 0.2s ease;
      max-width: 100%;
      min-width: 0;
      box-sizing: border-box;
    }
    .rich-editor-container:focus-within {
      border-color: var(--accent-cyan);
    }
    .readonly-mode {
      border: none;
      background: transparent;
      box-shadow: none;
    }

    .rich-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.35rem 0.5rem;
      background: var(--bg-canvas);
      border-bottom: 1px solid var(--border-medium);
      flex-wrap: wrap;
      gap: 0.5rem;
      max-width: 100%;
      box-sizing: border-box;
    }

    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      flex-wrap: wrap;
      min-width: 0;
    }

    .toolbar-right {
      display: flex;
      align-items: center;
    }

    .editor-tabs {
      display: flex;
      align-items: center;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      padding: 3px;
      gap: 3px;
    }

    .tab-btn {
      background: transparent;
      border: 1px solid transparent;
      color: var(--text-muted);
      font-family: inherit;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.25rem 0.65rem;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.35rem;
      transition: var(--transition-fast);
    }
    .tab-btn:hover {
      color: var(--text-main);
      background: var(--bg-surface-hover);
    }
    .tab-btn.active {
      background: var(--bg-surface);
      color: var(--accent-cyan);
      border-color: var(--border-medium);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
      font-weight: 700;
    }
    .tab-btn.active i {
      color: var(--accent-cyan);
    }

    .toolbar-divider {
      width: 1px;
      height: 16px;
      background: var(--border-medium);
      margin: 0 2px;
    }

    .format-actions {
      display: flex;
      align-items: center;
      gap: 2px;
      flex-wrap: wrap;
    }

    .tool-btn {
      background: transparent;
      border: 1px solid transparent;
      color: var(--text-muted);
      padding: 0.25rem 0.4rem;
      border-radius: 4px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.825rem;
      min-width: 26px;
      height: 26px;
      transition: all 0.15s ease;
    }
    .tool-btn:hover {
      background: var(--bg-surface-hover);
      color: var(--accent-cyan);
      border-color: var(--border-medium);
    }
    .text-fmt {
      font-size: 0.725rem;
      line-height: 1;
    }

    .fmt-hint {
      font-size: 0.65rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.7;
    }

    .editor-body {
      padding: 0.5rem;
      background: var(--bg-surface);
      min-height: 80px;
      max-width: 100%;
      min-width: 0;
      box-sizing: border-box;
      overflow-x: auto;
    }

    .editor-textarea {
      width: 100%;
      max-width: 100%;
      background: transparent;
      border: none;
      outline: none;
      color: var(--text-main);
      font-size: 0.875rem;
      line-height: 1.5;
      resize: vertical;
      min-height: 90px;
      box-sizing: border-box;
    }
    .editor-textarea::placeholder {
      color: var(--text-muted);
      opacity: 0.6;
    }

    /* Markdown Rendered Styling */
    .markdown-preview-render {
      color: var(--text-main);
      font-size: 0.875rem;
      line-height: 1.6;
      word-break: break-word;
      overflow-wrap: anywhere;
      max-width: 100%;
      min-width: 0;
    }

    :host ::ng-deep .markdown-preview-render h1 {
      font-size: 1.35rem;
      font-weight: 800;
      margin: 0.5rem 0 0.4rem 0;
      color: var(--accent-cyan);
      border-bottom: 1px solid var(--border-medium);
      padding-bottom: 0.25rem;
    }
    :host ::ng-deep .markdown-preview-render h2 {
      font-size: 1.15rem;
      font-weight: 700;
      margin: 0.4rem 0 0.3rem 0;
      color: var(--text-main);
    }
    :host ::ng-deep .markdown-preview-render h3 {
      font-size: 1rem;
      font-weight: 700;
      margin: 0.35rem 0 0.25rem 0;
      color: var(--text-main);
    }

    :host ::ng-deep .markdown-preview-render p {
      margin: 0 0 0.5rem 0;
    }
    :host ::ng-deep .markdown-preview-render p:last-child {
      margin-bottom: 0;
    }

    :host ::ng-deep .markdown-preview-render ul,
    :host ::ng-deep .markdown-preview-render ol {
      margin: 0.3rem 0 0.5rem 1.25rem;
      padding: 0;
    }

    :host ::ng-deep .markdown-preview-render li {
      margin-bottom: 0.2rem;
    }

    :host ::ng-deep .markdown-preview-render li.task-item {
      list-style: none;
      margin-left: -1rem;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    :host ::ng-deep .markdown-preview-render blockquote {
      margin: 0.4rem 0;
      padding: 0.4rem 0.8rem;
      border-left: 3px solid var(--accent-cyan);
      background: var(--bg-canvas);
      color: var(--text-muted);
      border-radius: 0 var(--radius-xs) var(--radius-xs) 0;
      font-style: italic;
    }

    :host ::ng-deep .markdown-preview-render code.inline-code {
      background: var(--bg-canvas);
      border: 1px solid var(--border-medium);
      color: #38bdf8;
      padding: 0.1rem 0.35rem;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.825rem;
    }

    :host ::ng-deep .markdown-preview-render pre {
      background: #0d1117;
      border: 1px solid var(--border-medium);
      border-radius: var(--radius-xs);
      padding: 0.6rem 0.8rem;
      overflow-x: auto;
      margin: 0.5rem 0;
    }
    :host ::ng-deep .markdown-preview-render pre code {
      font-family: monospace;
      font-size: 0.825rem;
      color: #e6edf3;
      background: transparent;
      padding: 0;
      border: none;
    }

    :host ::ng-deep .markdown-preview-render hr {
      border: none;
      border-top: 1px solid var(--border-medium);
      margin: 0.75rem 0;
    }

    :host ::ng-deep .markdown-preview-render del {
      text-decoration: line-through;
      opacity: 0.7;
    }

    :host ::ng-deep .markdown-preview-render a {
      color: var(--accent-cyan);
      text-decoration: underline;
    }

    .empty-placeholder {
      color: var(--text-muted);
      font-style: italic;
      opacity: 0.7;
    }
  `]
})
export class RichEditorComponent {
  @Input() value: string = '';
  @Output() valueChange = new EventEmitter<string>();
  @Input() placeholder: string = 'Add a detailed description... (supports Markdown)';
  @Input() readonly: boolean = false;
  @Input() minRows: number = 4;

  @ViewChild('textareaEl') textareaEl?: ElementRef<HTMLTextAreaElement>;

  activeTab: 'write' | 'preview' = 'write';

  constructor(private sanitizer: DomSanitizer) {}

  get renderedContent(): SafeHtml {
    if (!this.value || !this.value.trim()) {
      return this.sanitizer.bypassSecurityTrustHtml(
        '<span class="empty-placeholder">No description provided.</span>'
      );
    }
    const rawHtml = this.parseMarkdown(this.value);
    const sanitizedHtml = this.sanitizer.sanitize(SecurityContext.HTML, rawHtml) || '';
    return this.sanitizer.bypassSecurityTrustHtml(sanitizedHtml);
  }

  onTextChange(val: string) {
    this.value = val;
    this.valueChange.emit(val);
  }

  handleKeydown(event: KeyboardEvent) {
    // Shortcuts like Ctrl+B, Ctrl+I
    if (event.ctrlKey || event.metaKey) {
      if (event.key === 'b' || event.key === 'B') {
        event.preventDefault();
        this.applyFormat('bold');
      } else if (event.key === 'i' || event.key === 'I') {
        event.preventDefault();
        this.applyFormat('italic');
      }
    }
  }

  applyFormat(type: 'h1' | 'h2' | 'h3' | 'bold' | 'italic' | 'strike' | 'bullet' | 'number' | 'checklist' | 'quote' | 'code' | 'codeblock' | 'hr') {
    const el = this.textareaEl?.nativeElement;
    const currentVal = this.value || '';

    let start = 0;
    let end = 0;

    if (el) {
      start = el.selectionStart;
      end = el.selectionEnd;
    }

    const selectedText = currentVal.substring(start, end);
    let replacement = '';
    let cursorOffset = 0;

    switch (type) {
      case 'h1':
        replacement = selectedText ? `# ${selectedText}` : '# Heading 1';
        break;
      case 'h2':
        replacement = selectedText ? `## ${selectedText}` : '## Heading 2';
        break;
      case 'h3':
        replacement = selectedText ? `### ${selectedText}` : '### Heading 3';
        break;
      case 'bold':
        replacement = selectedText ? `**${selectedText}**` : '**bold text**';
        cursorOffset = selectedText ? 0 : 2;
        break;
      case 'italic':
        replacement = selectedText ? `*${selectedText}*` : '*italic text*';
        cursorOffset = selectedText ? 0 : 1;
        break;
      case 'strike':
        replacement = selectedText ? `~~${selectedText}~~` : '~~strikethrough~~';
        break;
      case 'bullet':
        if (selectedText.includes('\n')) {
          replacement = selectedText.split('\n').map(l => l.startsWith('- ') ? l : `- ${l}`).join('\n');
        } else {
          replacement = selectedText ? `- ${selectedText}` : '- List item';
        }
        break;
      case 'number':
        if (selectedText.includes('\n')) {
          replacement = selectedText.split('\n').map((l, i) => `${i + 1}. ${l}`).join('\n');
        } else {
          replacement = selectedText ? `1. ${selectedText}` : '1. List item';
        }
        break;
      case 'checklist':
        if (selectedText.includes('\n')) {
          replacement = selectedText.split('\n').map(l => `- [ ] ${l}`).join('\n');
        } else {
          replacement = selectedText ? `- [ ] ${selectedText}` : '- [ ] Task item';
        }
        break;
      case 'quote':
        replacement = selectedText ? `> ${selectedText}` : '> Blockquote';
        break;
      case 'code':
        replacement = selectedText ? `\`${selectedText}\`` : '`code`';
        break;
      case 'codeblock':
        replacement = selectedText ? `\`\`\`\n${selectedText}\n\`\`\`` : '```\ncode block\n```';
        break;
      case 'hr':
        replacement = '\n---\n';
        break;
    }

    const newVal = currentVal.substring(0, start) + replacement + currentVal.substring(end);
    this.onTextChange(newVal);

    setTimeout(() => {
      if (el) {
        el.focus();
        const newPos = start + replacement.length - cursorOffset;
        el.setSelectionRange(newPos, newPos);
      }
    }, 10);
  }

  private sanitizeUrl(url: string): string {
    if (!url) return '#';
    let current = url.trim();

    // Iteratively decode percent-encoding and HTML entities to reveal obfuscated schemes
    for (let i = 0; i < 5; i++) {
      const prev = current;
      try {
        current = decodeURIComponent(current);
      } catch {
        // Ignore URI malformed errors
      }
      current = current
        .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/&#([0-9]+);?/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
        .replace(/&colon;/gi, ':');
      if (current === prev) break;
    }

    // Strip invisible control characters & all whitespace to normalize protocol scheme check
    const normalized = current
      .replace(/[\u0000-\u001F\u007F-\u009F\s]/g, '')
      .toLowerCase();

    // Blacklist dangerous protocols
    if (
      normalized.startsWith('javascript:') ||
      normalized.startsWith('vbscript:') ||
      normalized.startsWith('data:') ||
      normalized.startsWith('blob:') ||
      normalized.startsWith('file:')
    ) {
      return '#';
    }

    // Enforce strict whitelist: allow http://, https://, mailto:, tel:, or relative paths starting with /, ./, ../, #
    const isAllowedScheme =
      normalized.startsWith('http://') ||
      normalized.startsWith('https://') ||
      normalized.startsWith('mailto:') ||
      normalized.startsWith('tel:') ||
      normalized.startsWith('/') ||
      normalized.startsWith('./') ||
      normalized.startsWith('../') ||
      normalized.startsWith('#');

    const hasUnknownScheme = /^[a-z0-9\+\.\-]+:/i.test(normalized) && !isAllowedScheme;

    if (!isAllowedScheme || hasUnknownScheme) {
      return '#';
    }

    // Escape quotes and angle brackets to prevent attribute breakout
    return url
      .trim()
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private parseMarkdown(md: string): string {
    if (!md) return '';

    // Sanitize HTML input characters first
    let html = md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Code blocks ```...```
    html = html.replace(/```([\s\S]*?)```/g, (_match, code) => {
      return `<pre><code>${code.trim()}</code></pre>`;
    });

    // Inline code `code`
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    // Headings
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Horizontal Rules
    html = html.replace(/^---$/gim, '<hr>');

    // Blockquotes
    html = html.replace(/^&gt; (.*$)/gim, '<blockquote>$1</blockquote>');

    // Checklists: - [ ] or - [x]
    html = html.replace(/^- \[ \] (.*$)/gim, '<li class="task-item"><i class="fi fi-rr-square text-muted"></i> $1</li>');
    html = html.replace(/^- \[x\] (.*$)/gim, '<li class="task-item"><i class="fi fi-rr-checkbox text-cyan"></i> <del>$1</del></li>');

    // Bullet Lists
    html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
    // Wrap adjacent <li> in <ul>
    html = html.replace(/(<li>[\s\S]*?<\/li>)/g, (match) => {
      if (!match.includes('class="task-item"')) {
        return `<ul>${match}</ul>`;
      }
      return match;
    });
    // Merge consecutive <ul> tags
    html = html.replace(/<\/ul>\s*<ul>/g, '');

    // Numbered Lists
    html = html.replace(/^\d+\. (.*$)/gim, '<li class="num-item">$1</li>');
    html = html.replace(/(<li class="num-item">[\s\S]*?<\/li>)/g, '<ol>$1</ol>');
    html = html.replace(/<\/ol>\s*<ol>/g, '');

    // Bold, Italic, Strikethrough
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Links [Text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text, url) => {
      const cleanUrl = this.sanitizeUrl(url);
      return `<a href="${cleanUrl}" target="_blank" rel="noopener">${text}</a>`;
    });

    // Line breaks to <br> if not inside pre/h1/h2/h3/blockquote/ul/ol
    const lines = html.split('\n');
    const processedLines = lines.map(line => {
      const trimmed = line.trim();
      if (
        trimmed.startsWith('<h') ||
        trimmed.startsWith('<pre') ||
        trimmed.startsWith('</pre>') ||
        trimmed.startsWith('<ul') ||
        trimmed.startsWith('<ol') ||
        trimmed.startsWith('<blockquote') ||
        trimmed.startsWith('<hr>') ||
        trimmed === ''
      ) {
        return line;
      }
      return line + '<br>';
    });

    return processedLines.join('\n');
  }
}

