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

  it('should return empty array for empty or null inputs', () => {
    expect(sanitizeLabels(null)).toEqual([]);
    expect(sanitizeLabels(undefined)).toEqual([]);
    expect(sanitizeLabels(['', '   '])).toEqual([]);
  });
});
