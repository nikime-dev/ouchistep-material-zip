import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('../out/', import.meta.url));
const html = readFileSync(resolve(output, 'index.html'), 'utf8');
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/$/u, '');
const siteURL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://nikime-dev.github.io/ouchistep-material-zip').replace(/\/$/u, '');
assert.ok(html.includes('http-equiv="Content-Security-Policy"'));
assert.ok(html.includes("connect-src &#x27;none&#x27;") || html.includes("connect-src 'none'"));
assert.ok(html.includes('name="referrer" content="no-referrer"'));
assert.ok(html.includes(`content="${siteURL}/og.png"`));
assert.ok(html.includes('写真を選んで、絵カードZIPを作りましょう'));
assert.ok(existsSync(resolve(output, '.nojekyll')));
assert.ok(!existsSync(resolve(output, '.openai')));
let assetCount = 0;
for (const match of html.matchAll(/(?:src|href)="([^"?#]+)(?:\?[^"#]*)?"/gu)) {
  const url = match[1];
  if (!url.startsWith('/')) continue;
  assert.ok(url.startsWith(`${basePath}/`), `Wrong base path: ${url}`);
  const asset = decodeURIComponent(url.slice(basePath.length + 1));
  assert.ok(existsSync(resolve(output, asset)), `Missing asset: ${asset}`);
  assetCount += 1;
}
assert.ok(assetCount > 0);
console.log(`Static Pages output verified: ${assetCount} local assets, CSP and share image URL.`);
