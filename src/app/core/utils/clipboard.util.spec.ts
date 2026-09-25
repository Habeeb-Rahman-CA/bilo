import { describe, it, expect, vi, beforeEach } from 'vitest';
import { copyToClipboard } from './clipboard.util';

describe('copyToClipboard Utility', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should use navigator.clipboard.writeText when available and successful', async () => {
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextSpy },
      configurable: true,
      writable: true
    });

    const success = await copyToClipboard('https://bilo.app?task=bilo-101');
    expect(success).toBe(true);
    expect(writeTextSpy).toHaveBeenCalledWith('https://bilo.app?task=bilo-101');
  });

  it('should fall back to document.execCommand when navigator.clipboard.writeText throws a SecurityError/NotAllowedError', async () => {
    const writeTextSpy = vi.fn().mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextSpy },
      configurable: true,
      writable: true
    });

    const execCommandSpy = vi.fn().mockReturnValue(true);
    (document as any).execCommand = execCommandSpy;

    const success = await copyToClipboard('https://bilo.app?task=bilo-102');
    expect(success).toBe(true);
    expect(writeTextSpy).toHaveBeenCalledWith('https://bilo.app?task=bilo-102');
    expect(execCommandSpy).toHaveBeenCalledWith('copy');
  });

  it('should fall back to document.execCommand when navigator.clipboard is undefined (e.g. HTTP context)', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
      writable: true
    });

    const execCommandSpy = vi.fn().mockReturnValue(true);
    (document as any).execCommand = execCommandSpy;

    const success = await copyToClipboard('https://bilo.app?task=bilo-103');
    expect(success).toBe(true);
    expect(execCommandSpy).toHaveBeenCalledWith('copy');
  });
});
