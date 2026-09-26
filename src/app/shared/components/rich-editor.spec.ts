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
});
