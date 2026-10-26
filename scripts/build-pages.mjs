import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const root = fileURLToPath(new URL('../', import.meta.url));
if (!process.env.NEXT_PUBLIC_SITE_URL) {
  throw new Error('NEXT_PUBLIC_SITE_URLに公開URLを指定してください。GitHub ActionsではPagesの設定から自動取得します。');
}
// Next and Vinext generate different route types under .next. Keep the Next
// build isolated when this development checkout also contains the Sites build.
let buildRoot = root;
if (existsSync(join(root, 'vite.config.ts'))) {
  buildRoot = mkdtempSync(join(tmpdir(), 'ouchistep-pages-build-'));
  for (const path of ['app', 'lib', 'public', '.gitignore', 'package.json', 'tsconfig.json', 'next.config.ts', 'postcss.config.mjs']) {
    cpSync(join(root, path), join(buildRoot, path), { recursive: true });
  }
  symlinkSync(join(root, 'node_modules'), join(buildRoot, 'node_modules'), 'dir');
}
const build = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'build', '--webpack'], {
  cwd: buildRoot,
  stdio: 'inherit',
  env: { ...process.env, GITHUB_PAGES: 'true', NEXT_TELEMETRY_DISABLED: '1' },
});
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);
if (buildRoot !== root) cpSync(join(buildRoot, 'out'), join(root, 'out'), { recursive: true });
mkdirSync(new URL('../out/', import.meta.url), { recursive: true });
writeFileSync(new URL('../out/.nojekyll', import.meta.url), '');
const check = spawnSync(process.execPath, ['scripts/check-pages.mjs'], { cwd: root, stdio: 'inherit', env: process.env });
if (check.error) throw check.error;
if (check.status !== 0) process.exit(check.status ?? 1);
