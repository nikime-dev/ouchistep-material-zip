import type { NextConfig } from 'next';
import { contentSecurityPolicy, pagesBasePath } from './lib/site-config.ts';

const isPages = process.env.GITHUB_PAGES === 'true';

const nextConfig: NextConfig = isPages ? {
  output: 'export',
  distDir: 'out',
  basePath: pagesBasePath(process.env.NEXT_PUBLIC_BASE_PATH ?? ''),
  trailingSlash: true,
  images: { unoptimized: true },
} : {
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: `${contentSecurityPolicy}; frame-ancestors 'none'` },
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
      ],
    }];
  },
};

export default nextConfig;
