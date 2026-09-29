import { describe, it, expect } from 'vitest';
import { compressImageFile, calculateTotalAttachmentsSize, canAddAttachment, isRealImageFile, verifyMagicBytes, MAX_ATTACHMENTS_PER_TASK, MAX_ATTACHMENT_FILE_SIZE_BYTES, MAX_TOTAL_TASK_ATTACHMENT_BYTES } from './image-compressor.util';

describe('ImageCompressorUtil', () => {
  it('should export attachment limits', () => {
    expect(MAX_ATTACHMENTS_PER_TASK).toBe(10);
    expect(MAX_ATTACHMENT_FILE_SIZE_BYTES).toBe(5 * 1024 * 1024);
    expect(MAX_TOTAL_TASK_ATTACHMENT_BYTES).toBe(20 * 1024 * 1024);
  });

  it('should verify binary magic bytes for valid images and reject fake executables/text files', async () => {
    // Valid PNG magic bytes header: 89 50 4E 47
    const pngHeader = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0]);
    const validPngFile = new File([pngHeader], 'real.png', { type: 'image/png' });
    expect(await verifyMagicBytes(validPngFile)).toBe(true);

    // Valid JPEG magic bytes header: FF D8 FF
    const jpegHeader = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
    const validJpegFile = new File([jpegHeader], 'photo.jpg', { type: 'image/jpeg' });
    expect(await verifyMagicBytes(validJpegFile)).toBe(true);

    // Fake PNG file (renamed text file containing ASCII characters)
    const fakePngFile = new File(['plain text content'], 'fake.png', { type: 'image/png' });
    expect(await verifyMagicBytes(fakePngFile)).toBe(false);
  });

  it('should validate real image files and reject non-images or renamed text files', async () => {
    const textFile = new File(['hello world'], 'doc.txt', { type: 'text/plain' });
    expect(await isRealImageFile(textFile)).toBe(false);

    const renamedTextFile = new File(['just plain text'], 'fake.png', { type: 'image/png' });
    expect(await isRealImageFile(renamedTextFile)).toBe(false);
  });

  it('should reject non-image file types and SVG files for security', async () => {
    const textFile = new File(['hello world'], 'test.txt', { type: 'text/plain' });
    await expect(compressImageFile(textFile)).rejects.toThrow('Invalid or untrusted image file type');

    const svgFile = new File(['<svg onload="alert(1)"></svg>'], 'xss.svg', { type: 'image/svg+xml' });
    await expect(compressImageFile(svgFile)).rejects.toThrow('Vector images (SVG) are rejected for security');
  });

  it('should reject files exceeding the 5MB size limit early without reading', async () => {
    const oversizedFile = new File([''], 'huge.jpg', { type: 'image/jpeg' });
    Object.defineProperty(oversizedFile, 'size', { value: 6 * 1024 * 1024 });

    await expect(compressImageFile(oversizedFile)).rejects.toThrow('exceeds maximum size limit of 5MB');
  });

  it('should calculate total base64 attachments payload size correctly', () => {
    const attachments = ['data:image/jpeg;base64,12345', 'data:image/jpeg;base64,67890'];
    expect(calculateTotalAttachmentsSize(attachments)).toBe(56);
  });

  it('should enforce total cumulative task attachment payload limit of 20MB', () => {
    const current = ['A'.repeat(15 * 1024 * 1024)]; // 15MB
    const newImage = 'B'.repeat(6 * 1024 * 1024); // 6MB -> total 21MB > 20MB

    const check = canAddAttachment(current, newImage);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('exceeded');
  });
});
