import { describe, it, expect } from 'vitest';
import { sanitizeLabels, MAX_LABELS_PER_TASK, MAX_LABEL_LENGTH } from './label.util';

describe('Label Utility', () => {
  it('should trim, lowercase, and deduplicate labels', () => {
    const raw = ['  Frontend ', 'FRONTEND', 'Backend', ' UI/UX '];
    const cleaned = sanitizeLabels(raw);

    expect(cleaned).toEqual(['frontend', 'backend', 'ui/ux']);
  });

  it('should truncate individual labels exceeding MAX_LABEL_LENGTH (30 chars)', () => {
    const longLabel = 'a'.repeat(50);
    const cleaned = sanitizeLabels([longLabel]);

    expect(cleaned.length).toBe(1);
    expect(cleaned[0].length).toBe(MAX_LABEL_LENGTH);
    expect(cleaned[0]).toBe('a'.repeat(30));
  });

  it('should limit total labels per task to MAX_LABELS_PER_TASK (15)', () => {
    const manyLabels = Array.from({ length: 100 }, (_, i) => `label-${i}`);
    const cleaned = sanitizeLabels(manyLabels);

    expect(cleaned.length).toBe(MAX_LABELS_PER_TASK);
    expect(cleaned.length).toBe(15);
  });

  it('should strip HTML tags, script elements, and dangerous syntax from labels', () => {
    const malicious = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert(1)>',
      '"><svg onload=alert(1)>',
      'label <b>bold</b>',
      'hello & "world"'
    ];
    const cleaned = sanitizeLabels(malicious);

    expect(cleaned).not.toContain('<script>');
    expect(cleaned).not.toContain('<img');
    expect(cleaned).not.toContain('onerror');
    expect(cleaned).not.toContain('onload');
    expect(cleaned).toEqual(['alert(xss)', 'label bold', 'hello  world']);
  });

  it('should strip control characters and discard empty sanitized labels', () => {
    const controlChars = ['\u0000\u0001\u001F', '   <style></style>   ', '  \t\n  '];
    const cleaned = sanitizeLabels(controlChars);

    expect(cleaned).toEqual([]);
  });

  it('should return empty array for empty or null inputs', () => {
    expect(sanitizeLabels(null)).toEqual([]);
    expect(sanitizeLabels(undefined)).toEqual([]);
    expect(sanitizeLabels(['', '   '])).toEqual([]);
  });
});
