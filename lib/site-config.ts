export const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'none'",
  "connect-src 'none'",
  "font-src 'self'",
  "form-action 'none'",
  "img-src 'self' blob: data:",
  "media-src 'self' blob:",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "worker-src 'none'",
].join('; ');

export function pagesBasePath(value: string): string {
  if (!value || value === '/') return '';
  if (!/^\/[A-Za-z0-9._-]+\/?$/u.test(value) || /\/(?:\.|\.\.)\/?$/u.test(value)) {
    throw new Error('GitHub Pagesのbase pathを確認してください。例: /ouchistep-material-zip');
  }
  return value.replace(/\/$/u, '');
}

export function siteBaseURL(value: string): string {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('公開URLを確認してください。');
  }
  return url.href.replace(/\/$/u, '');
}
