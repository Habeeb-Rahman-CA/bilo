/**
 * Utility for sanitizing and validating task labels.
 * Enforces maximum count (15) and maximum character length per label (30),
 * preventing UI overflow and memory issues.
 */

export const MAX_LABELS_PER_TASK = 15;
export const MAX_LABEL_LENGTH = 30;

export function sanitizeLabels(labels?: string[] | null): string[] {
  if (!labels || !Array.isArray(labels)) return [];

  const cleaned: string[] = [];
  const seen = new Set<string>();

  for (const raw of labels) {
    if (typeof raw !== 'string') continue;

    // 1. Remove control characters
    let label = raw.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');

    // 2. Strip HTML tags (e.g. <script>alert(1)</script>, <img ...>)
    label = label.replace(/<[^>]*>?/g, '');

    // 3. Strip dangerous HTML special characters to prevent injection/breakout
    label = label.replace(/[<>"'&`\\;]/g, '');

    // 4. Trim whitespace and convert to lowercase
    label = label.trim().toLowerCase();

    if (!label) continue;

    // 5. Truncate to MAX_LABEL_LENGTH
    if (label.length > MAX_LABEL_LENGTH) {
      label = label.slice(0, MAX_LABEL_LENGTH).trim();
    }

    if (!label) continue;

    // 6. Deduplicate & cap to MAX_LABELS_PER_TASK
    if (!seen.has(label)) {
      seen.add(label);
      cleaned.push(label);
      if (cleaned.length >= MAX_LABELS_PER_TASK) {
        break;
      }
    }
  }

  return cleaned;
}
