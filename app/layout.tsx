import type { Metadata } from 'next';
import './globals.css';
import { contentSecurityPolicy, siteBaseURL } from '../lib/site-config';

const siteURL = siteBaseURL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://nikime-dev.github.io/ouchistep-material-zip');
const imageURL = `${siteURL}/og.png`;

export const metadata: Metadata = {
  metadataBase: new URL(`${siteURL}/`),
  title: 'PC絵カード作成ツール | おうちステップ',
  description: '写真と音声を外部送信せず、端末内だけで家庭教材ZIPを作成します。',
  openGraph: {
    title: 'おうちステップ PC絵カード作成ツール',
    description: '写真・音声は端末内だけで処理。外部へ送信しません。',
    images: [{ url: imageURL, width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'おうちステップ PC絵カード作成ツール',
    description: '写真・音声は端末内だけで処理。外部へ送信しません。',
    images: [imageURL],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      {process.env.GITHUB_PAGES === 'true' && <head>
        <meta httpEquiv="Content-Security-Policy" content={contentSecurityPolicy} />
        <meta name="referrer" content="no-referrer" />
      </head>}
      <body>{children}</body>
    </html>
  );
}
