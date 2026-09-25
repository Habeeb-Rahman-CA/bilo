import { describe, it, expect, vi } from 'vitest';
import { isBase64DataUri, isRemoteUrl, parseAttachment, fetchAttachmentAsBlob } from './attachment.util';

describe('Attachment Utils', () => {
  const sampleBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const sampleUrl = 'https://example.com/image.png';

  it('should correctly discriminate base64 data URIs vs remote URLs', () => {
    expect(isBase64DataUri(sampleBase64)).toBe(true);
    expect(isBase64DataUri(sampleUrl)).toBe(false);

    expect(isRemoteUrl(sampleUrl)).toBe(true);
    expect(isRemoteUrl(sampleBase64)).toBe(false);
  });

  it('should parse attachments into discriminated objects', () => {
    const parsedBase64 = parseAttachment(sampleBase64);
    expect(parsedBase64.type).toBe('base64');
    expect(parsedBase64.mimeType).toBe('image/png');

    const parsedUrl = parseAttachment(sampleUrl);
    expect(parsedUrl.type).toBe('url');
    expect(parsedUrl.value).toBe(sampleUrl);
  });

  it('should convert base64 data URI to Blob directly without invoking fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const blob = await fetchAttachmentAsBlob(sampleBase64);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('should use fetch for remote URLs when converting to Blob', async () => {
    const mockBlob = new Blob(['test content'], { type: 'image/png' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob)
    } as any);

    const blob = await fetchAttachmentAsBlob(sampleUrl);

    expect(fetchSpy).toHaveBeenCalledWith(sampleUrl);
    expect(blob).toBe(mockBlob);
  });
});
