import assert from 'node:assert/strict';
import test from 'node:test';
import { contentSecurityPolicy, pagesBasePath, siteBaseURL } from '../lib/site-config.ts';

test('Pages supports project and account root paths without accepting URL injection', () => {
  assert.equal(pagesBasePath('/pc-tool/'), '/pc-tool');
  assert.equal(pagesBasePath('/'), '');
  assert.equal(pagesBasePath(''), '');
  for (const path of ['https://example.com', '//example.com', '/../', '/a/b', '/x?y', '/x#y']) {
    assert.throws(() => pagesBasePath(path));
  }
});

test('share image URLs keep the repository path and reject credentials or non-web protocols', () => {
  assert.equal(`${siteBaseURL('https://example.github.io/pc-tool/')}/og.png`, 'https://example.github.io/pc-tool/og.png');
  for (const url of ['javascript:alert(1)', 'https://name:password@example.com', 'https://example.com?token=x']) {
    assert.throws(() => siteBaseURL(url));
  }
});

test('static CSP continues to block data transmission and allows only local media', () => {
  assert.ok(contentSecurityPolicy.includes("connect-src 'none'"));
  assert.ok(contentSecurityPolicy.includes("form-action 'none'"));
  assert.ok(contentSecurityPolicy.includes("img-src 'self' blob: data:"));
  assert.ok(!contentSecurityPolicy.includes('https:'));
});
