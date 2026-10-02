import { describe, it, expect, beforeEach } from 'vitest';
import { ProgressService } from './progress.service';

describe('ProgressService', () => {
  let service: ProgressService;

  beforeEach(() => {
    service = new ProgressService();
  });

  it('should initialize with null active progress', () => {
    expect(service.activeProgress()).toBeNull();
  });

  it('should start progress tracking for batch operations', () => {
    const id = service.start('batch-1', 'batch', 'Batch Update Tasks', { totalSteps: 10 });
    expect(id).toBe('batch-1');
    const state = service.activeProgress();
    expect(state).not.toBeNull();
    expect(state?.type).toBe('batch');
    expect(state?.title).toBe('Batch Update Tasks');
    expect(state?.totalSteps).toBe(10);
    expect(state?.percentage).toBe(0);
  });

  it('should update progress percentage and message', () => {
    service.start('export-1', 'export', 'Excel Export Generation');
    service.update('export-1', 45, { message: 'Formatting worksheet...' });

    const state = service.activeProgress();
    expect(state?.percentage).toBe(45);
    expect(state?.message).toBe('Formatting worksheet...');
  });

  it('should format bytes cleanly', () => {
    expect(service.formatBytes(0)).toBe('0 B');
    expect(service.formatBytes(1024)).toBe('1 KB');
    expect(service.formatBytes(1572864)).toBe('1.5 MB');
  });

  it('should handle operation completion', () => {
    service.start('upload-1', 'upload', 'Large File Upload', { totalBytes: 5000000 });
    service.complete('upload-1', 'Upload complete!');

    const state = service.activeProgress();
    expect(state?.status).toBe('completed');
    expect(state?.percentage).toBe(100);
    expect(state?.message).toBe('Upload complete!');
  });
});
