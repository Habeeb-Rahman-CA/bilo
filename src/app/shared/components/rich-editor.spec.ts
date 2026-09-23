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

  it('should escape double quotes to prevent attribute breakout', () => {
    component.value = '[Click](https://example.com" onclick="alert(1))';
    const output = component.renderedContent as unknown as string;
    expect(output).not.toContain('onclick="alert(1)"');
  });

  it('should render valid markdown formatting safely', () => {
    component.value = '# Hello World\n\n**Bold Text** and [Safe Link](https://google.com)';
    const output = component.renderedContent as unknown as string;
    expect(output).toContain('<h1>Hello World</h1>');
    expect(output).toContain('<strong>Bold Text</strong>');
    expect(output).toContain('href="https://google.com"');
  });
});
