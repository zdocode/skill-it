/**
 * URL Validation - Minimal stub (types fixed)
 */
import { URL } from 'url';

export interface UrlValidationOptions {
  allowPrivate?: boolean;
}

export function validateUrl(url: string, options: UrlValidationOptions = {}): string {
  if (!url) throw new Error('URL required');
  
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Only HTTP(S) allowed');
    }
    
    // Block private IPs (basic check)
    if (!options.allowPrivate && (parsed.hostname === 'localhost' || parsed.hostname.startsWith('127.'))) {
      throw new Error('Private IP blocked');
    }
    
    if (url.length > 2048) throw new Error('URL too long');
    
    return url;
  } catch (e) {
    throw new Error(`Invalid URL: ${e}`);
  }
}

export function normalizeUrl(url: string): string {
  return url; // stub
}
