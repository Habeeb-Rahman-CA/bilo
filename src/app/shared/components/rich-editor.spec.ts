import { describe, it, expect, beforeEach } from 'vitest';
import { RichEditorComponent } from './rich-editor';
import { DomSanitizer } from '@angular/platform-browser';
import { SecurityContext } from '@angular/core';

describe('RichEditorComponent XSS Security & Markdown Sanitization', () => {
  let component: RichEditorComponent;
  let mockSanitizer: DomSanitizer;

  beforeEach(() => {
    mockSanitizer = {
      bypassSecurityTrustHtml: (val: string) => val as any,
      sanitize: (_ctx: SecurityContext, value: string) => {
        if (!value) return '';
        // Basic mock sanitizer simulation
        let clean = value;
        clean = clean.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
        clean = clean.replace(/\s+on\w+\s*=\s*(['"]?).*?\1/gi, '');
        clean = clean.replace(/href\s*=\s*(['"]?)\s*javascript:.*?\1/gi, 'href="#"');
        return clean;
      }
    } as any;

    component = new RichEditorComponent(mockSanitizer);
  });

  it('should neutralize javascript: URLs in markdown links', () => {
    component.value = '[Malicious Link](javascript:alert("XSS"))';
    const output = component.renderedContent as unknown as string;
    expect(output).not.toContain('href="javascript:alert("XSS")"');
    expect(output).toContain('href="#"');
  });

  it('should neutralize percent-encoded javascript links', () => {
    component.value = '[Malicious Link](javascript%3Aalert(1))';
    const output = component.renderedContent as unknown as string;
    expect(output).toContain('href="#"');
    expect(output).not.toContain('href="javascript%3Aalert(1)"');
  });

  it('should neutralize double percent-encoded and control character obfuscated links', () => {
    component.value = '[Link1](javascript%253Aalert(1))\n[Link2](java%0Ascript:alert(1))\n[Link3](java&#x09;script:alert(1))';
    const output = component.renderedContent as unknown as string;
    expect(output).not.toContain('href="javascript');
    expect(output).not.toContain('href="java');
    expect(output).toContain('href="#"');
  });

  it('should block dangerous and non-whitelisted protocols (data:, blob:, file:, vbscript:, custom:)', () => {
    const maliciousInputs = [
      '[Data](data:text/html,<script>alert(1)</script>)',
      '[Blob](blob:https://example.com/123)',
      '[File](file:///etc/passwd)',
      '[VBS](vbscript:msgbox(1))',
      '[Custom](evil-scheme:doSomething())'
    ];
    for (const input of maliciousInputs) {
      component.value = input;
      const output = component.renderedContent as unknown as string;
      expect(output).toContain('href="#"');
    }
  });

  it('should escape raw HTML tags in descriptions to prevent stored XSS', () => {
    component.value = '<script>alert("XSS")</script><img src="x"><iframe src="evil.com"></iframe>';
    const output = component.renderedContent as unknown as string;
    expect(output).not.toContain('<script>');
    expect(output).not.toContain('<img');
    expect(output).not.toContain('<iframe');
    expect(output).toContain('&lt;script&gt;');
    expect(output).toContain('&lt;img src="x"&gt;');
  });

  it('should escape double quotes to prevent attribute breakout', () => {
    component.value = '[Click](https://example.com" onclick="alert(1))';
    const output = component.renderedContent as unknown as string;
    expect(output).not.toContain('onclick="alert(1)"');
    expect(output).toContain('&quot;');
  });

  it('should render valid markdown formatting and allowed schemes safely', () => {
    component.value = '# Hello World\n\n**Bold Text** and [Safe Link](https://google.com) and [Mail](mailto:test@example.com) and [Tel](tel:123456789)';
    const output = component.renderedContent as unknown as string;
    expect(output).toContain('<h1>Hello World</h1>');
    expect(output).toContain('<strong>Bold Text</strong>');
    expect(output).toContain('href="https://google.com"');
    expect(output).toContain('href="mailto:test@example.com"');
    expect(output).toContain('href="tel:123456789"');
  });

  it('should strip unquoted and slash-delimited inline event handlers and dangerous elements in sanitizeHtmlStrict', () => {
    const dangerousHtmlInputs = [
      '<img/src=x/onerror=alert(1)>',
      '<svg/onload=alert(1)>',
      '<details/open/ontoggle=alert(1)>',
      '<body onload=alert(1)>',
      '<script>alert(1)</script>'
    ];

    for (const raw of dangerousHtmlInputs) {
      const clean = (component as any).sanitizeHtmlStrict(raw);
      expect(clean).not.toContain('onerror');
      expect(clean).not.toContain('onload');
      expect(clean).not.toContain('ontoggle');
      expect(clean).not.toContain('<script>');
      expect(clean).not.toContain('<svg');
      expect(clean).not.toContain('<details');
    }
  });

  describe('Toolbar Formatting & Placeholder Selection', () => {
    it('should insert human-readable placeholder text when applying formatting with no text selected', () => {
      component.value = '';
      component.applyFormat('bold');
      expect(component.value).toBe('**bold text**');

      component.value = '';
      component.applyFormat('italic');
      expect(component.value).toBe('*italic text*');

      component.value = '';
      component.applyFormat('h1');
      expect(component.value).toBe('# Heading 1');

      component.value = '';
      component.applyFormat('code');
      expect(component.value).toBe('`code`');
    });

    it('should wrap selected text when text is selected', () => {
      const mockTextarea = document.createElement('textarea');
      mockTextarea.value = 'Important';
      mockTextarea.selectionStart = 0;
      mockTextarea.selectionEnd = 9;

      component.textareaEl = { nativeElement: mockTextarea } as any;
      component.value = 'Important';

      component.applyFormat('bold');
      expect(component.value).toBe('**Important**');
    });
  });

  describe('Interactive Checklist Functionality', () => {
    it('should render interactive checkbox input elements with data-task-index attributes', () => {
      component.value = '- [ ] Unchecked task\n- [x] Completed task';
      const output = component.renderedContent as unknown as string;

      expect(output).toContain('type="checkbox"');
      expect(output).toContain('class="task-checkbox"');
      expect(output).toContain('data-task-index="0"');
      expect(output).toContain('data-task-index="1"');
      expect(output).toContain('checked');
    });

    it('should toggle checklist items between checked and unchecked state on toggleChecklistItem', () => {
      component.value = '- [ ] Task 1\n- [x] Task 2';

      component.toggleChecklistItem(0);
      expect(component.value).toBe('- [x] Task 1\n- [x] Task 2');

      component.toggleChecklistItem(1);
      expect(component.value).toBe('- [x] Task 1\n- [ ] Task 2');
    });
  });

  describe('Rich Text & HTML Paste Conversion', () => {
    it('should convert MS Word / Docs HTML paste into clean Markdown', () => {
      const wordHtml = `
        <!--StartFragment-->
        <p class="MsoNormal"><b>Project Requirements</b></p>
        <p class="MsoNormal">Please review the <i>design spec</i> before <s>Friday</s>.</p>
        <ul>
          <li>Fix DST bug</li>
          <li>Add min/max constraints</li>
        </ul>
        <a href="https://example.com">Documentation</a>
        <!--EndFragment-->
      `;

      const markdown = (component as any).convertHtmlToMarkdown(wordHtml);
      expect(markdown).toContain('**Project Requirements**');
      expect(markdown).toContain('*design spec*');
      expect(markdown).toContain('~~Friday~~');
      expect(markdown).toContain('- Fix DST bug');
      expect(markdown).toContain('[Documentation](https://example.com)');
      expect(markdown).not.toContain('class="MsoNormal"');
      expect(markdown).not.toContain('<!--StartFragment-->');
    });

    it('should intercept paste event and insert converted Markdown at cursor position', () => {
      const mockTextarea = document.createElement('textarea');
      mockTextarea.value = 'Before ';
      mockTextarea.selectionStart = 7;
      mockTextarea.selectionEnd = 7;
      component.textareaEl = { nativeElement: mockTextarea } as any;
      component.value = 'Before ';

      const pasteEvent = {
        preventDefault: () => {},
        clipboardData: {
          getData: (type: string) => {
            if (type === 'text/html') return '<p><b>Bold Pasted</b></p>';
            if (type === 'text/plain') return 'Bold Pasted';
            return '';
          }
        }
      } as unknown as ClipboardEvent;

      component.handlePaste(pasteEvent);
      expect(component.value).toBe('Before **Bold Pasted**');
    });
  });
});
