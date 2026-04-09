/**
 * HTML Sanitization - Minimal stub (no heavy deps)
 * In full version, would use sanitize-html with proper config
 */
export function sanitizeHtml(html: string): string {
  // Very basic sanitization for stub
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
}

export function sanitizeText(text: string): string {
  return text.replace(/[<>]/g, c => c === '<' ? '&lt;' : '&gt;');
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

export function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol) ? url : null;
  } catch {
    return null;
  }
}
