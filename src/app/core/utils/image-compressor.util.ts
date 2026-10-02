/**
 * Image compressor utility for Bilo task attachments.
 * Prevents localStorage QuotaExceededError crashes and main-thread UI freezing
 * by pre-validating file size limits and downscaling image attachments using
 * high-performance Blob URLs (URL.createObjectURL) & Canvas decoding.
 * Includes timeout safeguards to prevent infinite spinners on corrupt files.
 */

export const MAX_ATTACHMENT_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB per image file limit
export const MAX_ATTACHMENTS_PER_TASK = 10;
export const MAX_TOTAL_TASK_ATTACHMENT_BYTES = 20 * 1024 * 1024; // 20MB total task attachment limit
const DECODE_TIMEOUT_MS = 3000; // 3 seconds safety timeout for corrupt image decoders

/**
 * Validates file binary header magic bytes to prevent spoofed/renamed executable or script files.
 * Supported signatures: JPEG (FF D8 FF), PNG (89 50 4E 47), GIF (47 49 46), WebP (RIFF....WEBP), AVIF (ftyp)
 */
export async function verifyMagicBytes(file: File): Promise<boolean> {
  if (!file || file.size < 4) return false;

  try {
    const buffer = await file.slice(0, 12).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // JPEG: FF D8 FF
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
      return true;
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      return true;
    }

    // GIF: 47 49 46 ("GIF87a" or "GIF89a")
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
      return true;
    }

    // WebP: RIFF (bytes 0-3: 52 49 46 46) ... WEBP (bytes 8-11: 57 45 42 50)
    if (
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes.length >= 12 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    ) {
      return true;
    }

    // AVIF: ftyp (bytes 4-7: 66 74 79 70)
    if (
      bytes.length >= 8 &&
      bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export function calculateTotalAttachmentsSize(attachments: string[]): number {
  if (!attachments || !Array.isArray(attachments)) return 0;
  return attachments.reduce((sum, item) => sum + (item ? item.length : 0), 0);
}

export function canAddAttachment(currentAttachments: string[], newBase64: string): { allowed: boolean; currentBytes: number; newTotalBytes: number; reason?: string } {
  const currentBytes = calculateTotalAttachmentsSize(currentAttachments);
  const newItemBytes = newBase64 ? newBase64.length : 0;
  const newTotalBytes = currentBytes + newItemBytes;

  if (newTotalBytes > MAX_TOTAL_TASK_ATTACHMENT_BYTES) {
    const limitMb = (MAX_TOTAL_TASK_ATTACHMENT_BYTES / (1024 * 1024)).toFixed(1);
    const currentMb = (currentBytes / (1024 * 1024)).toFixed(2);
    const newMb = (newItemBytes / (1024 * 1024)).toFixed(2);
    return {
      allowed: false,
      currentBytes,
      newTotalBytes,
      reason: `Total task attachment payload limit (${limitMb}MB) exceeded. Current: ${currentMb}MB, New: ${newMb}MB. Please remove existing attachments.`
    };
  }

  return { allowed: true, currentBytes, newTotalBytes };
}

export async function isRealImageFile(file: File): Promise<boolean> {
  if (!file) return false;

  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
  const validExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];
  const lowerType = (file.type || '').toLowerCase();
  const fileName = (file.name || '').toLowerCase();

  const hasValidExt = validExts.some(ext => fileName.endsWith(ext));
  if (!hasValidExt || !allowedMimeTypes.includes(lowerType)) {
    return false;
  }

  // Magic bytes binary signature check
  const validMagic = await verifyMagicBytes(file);
  if (!validMagic) {
    return false;
  }

  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return true;
  }

  return new Promise((resolve) => {
    let objectUrl = '';
    try {
      objectUrl = URL.createObjectURL(file);
    } catch {
      resolve(false);
      return;
    }

    const img = new Image();
    let timer: any = setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      resolve(false);
    }, 2500);

    img.onload = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(objectUrl);
      resolve(img.width > 0 && img.height > 0);
    };

    img.onerror = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(objectUrl);
      resolve(false);
    };

    img.src = objectUrl;
  });
}

export async function compressImageFile(
  file: File,
  maxWidth: number = 800,
  maxHeight: number = 800,
  quality: number = 0.75
): Promise<string> {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
  if (!file || !allowedMimeTypes.includes(file.type.toLowerCase())) {
    throw new Error('Invalid or untrusted image file type. Vector images (SVG) are rejected for security.');
  }

  if (file.size > MAX_ATTACHMENT_FILE_SIZE_BYTES) {
    const limitMb = Math.round(MAX_ATTACHMENT_FILE_SIZE_BYTES / (1024 * 1024));
    throw new Error(`File "${file.name || 'image'}" exceeds maximum size limit of ${limitMb}MB.`);
  }

  const validMagic = await verifyMagicBytes(file);
  if (!validMagic) {
    throw new Error(`File "${file.name || 'image'}" binary header signature (magic bytes) does not match valid image formats. Unrecognized or executable binary content rejected.`);
  }

  return new Promise((resolve, reject) => {

    let timeoutTimer: any = null;
    const cleanupTimeout = () => {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }
    };

    const useObjectURL = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';

    if (useObjectURL) {
      let objectUrl: string = '';
      try {
        objectUrl = URL.createObjectURL(file);
      } catch (e) {
        // Fallback to FileReader if createObjectURL fails in headless env
      }

      if (objectUrl) {
        timeoutTimer = setTimeout(() => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error(`Image decoding timed out for "${file.name || 'image'}". File may be corrupt.`));
        }, DECODE_TIMEOUT_MS);

        const img = new Image();
        img.onerror = () => {
          cleanupTimeout();
          URL.revokeObjectURL(objectUrl);
          reject(new Error(`Failed to decode image "${file.name || 'image'}". File may be corrupt or invalid.`));
        };

        img.onload = () => {
          cleanupTimeout();
          try {
            let width = img.width;
            let height = img.height;

            if (width > maxWidth || height > maxHeight) {
              if (width / height > maxWidth / maxHeight) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
              } else {
                width = Math.round((width * maxHeight) / height);
                height = maxHeight;
              }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
              URL.revokeObjectURL(objectUrl);
              resolve('');
              return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            const outputType = (file.type === 'image/png' || file.type === 'image/webp') ? 'image/webp' : 'image/jpeg';
            const compressedDataUrl = canvas.toDataURL(outputType, quality);
            URL.revokeObjectURL(objectUrl);
            resolve(compressedDataUrl);
          } catch (err) {
            URL.revokeObjectURL(objectUrl);
            reject(err);
          }
        };

        img.src = objectUrl;
        return;
      }
    }

    // Fallback path: FileReader (when URL.createObjectURL is unavailable)
    timeoutTimer = setTimeout(() => {
      reject(new Error(`FileReader processing timed out for "${file.name || 'image'}". File may be corrupt.`));
    }, DECODE_TIMEOUT_MS);

    const reader = new FileReader();
    reader.onerror = () => {
      cleanupTimeout();
      reject(new Error(`Failed to read file "${file.name || 'image'}". File may be unreadable or corrupt.`));
    };

    reader.onload = (e) => {
      const srcData = (e.target?.result as string) || '';
      if (!srcData) {
        cleanupTimeout();
        resolve('');
        return;
      }

      const img = new Image();
      img.onerror = () => {
        cleanupTimeout();
        reject(new Error(`Failed to decode image "${file.name || 'image'}". File may be corrupt or invalid.`));
      };

      img.onload = () => {
        cleanupTimeout();
        let width = img.width;
        let height = img.height;

        if (width <= maxWidth && height <= maxHeight && file.size < 200 * 1024) {
          resolve(srcData);
          return;
        }

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(srcData);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const outputType = (file.type === 'image/png' || file.type === 'image/webp') ? 'image/webp' : 'image/jpeg';
        const compressedDataUrl = canvas.toDataURL(outputType, quality);
        resolve(compressedDataUrl);
      };

      img.src = srcData;
    };

    reader.readAsDataURL(file);
  });
}
