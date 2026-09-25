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
    let label = raw.trim().toLowerCase();
    if (!label) continue;
    if (label.length > MAX_LABEL_LENGTH) {
      label = label.slice(0, MAX_LABEL_LENGTH);
    }
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
