/**
 * Image compressor utility for Bilo task attachments.
 * Prevents localStorage QuotaExceededError crashes and main-thread UI freezing
 * by pre-validating file size limits and downscaling image attachments using
 * high-performance Blob URLs (URL.createObjectURL) & Canvas decoding.
 * Includes timeout safeguards to prevent infinite spinners on corrupt files.
 */

export const MAX_ATTACHMENT_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_ATTACHMENTS_PER_TASK = 10;
export const MAX_TOTAL_TASK_ATTACHMENT_BYTES = 1.5 * 1024 * 1024; // 1.5MB total base64 payload per task
const DECODE_TIMEOUT_MS = 3000; // 3 seconds safety timeout for corrupt image decoders

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

export async function compressImageFile(
  file: File,
  maxWidth: number = 1200,
  maxHeight: number = 1200,
  quality: number = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
    if (!file || !allowedMimeTypes.includes(file.type.toLowerCase())) {
      reject(new Error('Invalid or untrusted image file type. Vector images (SVG) are rejected for security.'));
      return;
    }

    if (file.size > MAX_ATTACHMENT_FILE_SIZE_BYTES) {
      reject(new Error(`File "${file.name || 'image'}" exceeds maximum size limit of 10MB.`));
      return;
    }

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
