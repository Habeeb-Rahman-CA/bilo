/**
 * Attachment discrimination and safe conversion utility for Bilo tasks.
 * Differentiates between remote HTTP/HTTPS URLs and base64 Data URIs,
 * preventing failed fetch() calls on base64 data URIs.
 */

export type TaskAttachmentType = 'url' | 'base64' | 'unknown';

export interface ParsedTaskAttachment {
  type: TaskAttachmentType;
  value: string;
  mimeType?: string;
}

export function isBase64DataUri(source: string): boolean {
  return typeof source === 'string' && /^data:image\/[a-zA-Z0-9\+\-\.]+;base64,/i.test(source.trim());
}

export function isRemoteUrl(source: string): boolean {
  if (typeof source !== 'string') return false;
  const s = source.trim();
  return s.startsWith('http://') || s.startsWith('https://') || s.startsWith('blob:');
}

export function parseAttachment(source: string): ParsedTaskAttachment {
  if (!source || typeof source !== 'string') {
    return { type: 'unknown', value: '' };
  }
  const s = source.trim();
  if (isBase64DataUri(s)) {
    const mimeMatch = s.match(/^data:(image\/[a-zA-Z0-9\+\-\.]+);base64,/i);
    return {
      type: 'base64',
      value: s,
      mimeType: mimeMatch ? mimeMatch[1] : 'image/png'
    };
  }
  if (isRemoteUrl(s)) {
    return {
      type: 'url',
      value: s
    };
  }
  return { type: 'unknown', value: s };
}

export async function fetchAttachmentAsBlob(attachment: string): Promise<Blob> {
  const parsed = parseAttachment(attachment);

  if (parsed.type === 'base64') {
    const parts = parsed.value.split(',');
    const mime = parsed.mimeType || 'image/png';
    const b64Data = parts[1] || '';
    const byteCharacters = atob(b64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mime });
  }

  if (parsed.type === 'url') {
    const res = await fetch(parsed.value);
    if (!res.ok) {
      throw new Error(`Failed to fetch attachment URL. Status: ${res.status}`);
    }
    return await res.blob();
  }

  throw new Error('Unsupported or malformed attachment type.');
}
