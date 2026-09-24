import { describe, it, expect } from 'vitest';
import { compressImageFile, MAX_ATTACHMENTS_PER_TASK, MAX_ATTACHMENT_FILE_SIZE_BYTES } from './image-compressor.util';

describe('ImageCompressorUtil', () => {
  it('should export attachment limits', () => {
    expect(MAX_ATTACHMENTS_PER_TASK).toBe(10);
    expect(MAX_ATTACHMENT_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024);
  });

  it('should reject non-image file types and SVG files for security', async () => {
    const textFile = new File(['hello world'], 'test.txt', { type: 'text/plain' });
    await expect(compressImageFile(textFile)).rejects.toThrow('Invalid or untrusted image file type');

    const svgFile = new File(['<svg onload="alert(1)"></svg>'], 'xss.svg', { type: 'image/svg+xml' });
    await expect(compressImageFile(svgFile)).rejects.toThrow('Vector images (SVG) are rejected for security');
  });
});
