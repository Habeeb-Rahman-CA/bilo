/**
 * Robust cross-browser clipboard utility with fallback support for HTTP / insecure contexts
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // Attempt 1: Modern navigator.clipboard API (works in Secure Contexts / HTTPS)
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('[Clipboard] Modern writeText failed, attempting execCommand fallback:', err);
    }
  }

  // Attempt 2: Fallback using hidden textarea & document.execCommand('copy') (works in HTTP / older browsers / mobile webviews)
  try {
    if (typeof document === 'undefined' || !document.body) return false;

    const textarea = document.createElement('textarea');
    textarea.value = text;

    // Prevent scrolling or visual flicker
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.width = '2em';
    textarea.style.height = '2em';
    textarea.style.padding = '0';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.background = 'transparent';
    textarea.style.opacity = '0';
    textarea.setAttribute('readonly', '');

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    // Support iOS / WebKit selection
    if (navigator.userAgent.match(/ipad|iphone/i)) {
      const range = document.createRange();
      range.selectNodeContents(textarea);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      textarea.setSelectionRange(0, 999999);
    }

    let successful = false;
    if (typeof document.execCommand === 'function') {
      successful = document.execCommand('copy');
    }
    document.body.removeChild(textarea);
    if (successful) {
      return true;
    }
  } catch (err) {
    console.error('[Clipboard] Fallback execCommand failed:', err);
  }

  return false;
}
