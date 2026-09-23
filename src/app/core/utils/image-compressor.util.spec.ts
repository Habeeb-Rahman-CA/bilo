import { describe, it, expect } from 'vitest';
import { compressImageFile, MAX_ATTACHMENTS_PER_TASK, MAX_ATTACHMENT_FILE_SIZE_BYTES } from './image-compressor.util';

describe('ImageCompressorUtil', () => {
  it('should export attachment limits', () => {
    expect(MAX_ATTACHMENTS_PER_TASK).toBe(10);
    expect(MAX_ATTACHMENT_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024);
  });

  it('should reject non-image file types', async () => {
    const textFile = new File(['hello world'], 'test.txt', { type: 'text/plain' });
    await expect(compressImageFile(textFile)).rejects.toThrow('File is not an image');
  });
});
