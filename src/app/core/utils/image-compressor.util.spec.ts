import { describe, it, expect } from 'vitest';
import { compressImageFile, calculateTotalAttachmentsSize, canAddAttachment, MAX_ATTACHMENTS_PER_TASK, MAX_ATTACHMENT_FILE_SIZE_BYTES } from './image-compressor.util';

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

  it('should reject files exceeding the 10MB size limit early without reading', async () => {
    const oversizedFile = new File([''], 'huge.jpg', { type: 'image/jpeg' });
    Object.defineProperty(oversizedFile, 'size', { value: 11 * 1024 * 1024 });

    await expect(compressImageFile(oversizedFile)).rejects.toThrow('exceeds maximum size limit of 10MB');
  });

  it('should reject corrupt image files with descriptive error message', async () => {
    const corruptFile = new File(['NOT_AN_IMAGE_CONTENT'], 'corrupt.jpg', { type: 'image/jpeg' });
    await expect(compressImageFile(corruptFile)).rejects.toThrow(/Failed to decode image|Image decoding timed out/);
  });

  it('should calculate total base64 attachments payload size correctly', () => {
    const attachments = ['data:image/jpeg;base64,12345', 'data:image/jpeg;base64,67890'];
    expect(calculateTotalAttachmentsSize(attachments)).toBe(56);
  });

  it('should reject adding attachments when total cumulative payload exceeds 1.5MB', () => {
    const current = ['A'.repeat(1 * 1024 * 1024)]; // 1MB
    const newImage = 'B'.repeat(600 * 1024); // 600KB -> total 1.6MB > 1.5MB

    const check = canAddAttachment(current, newImage);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('exceeded');
  });
});
