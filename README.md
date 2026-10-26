# おうちステップ PC絵カード作成ツール

写真と音声から、おうちステップで読み込める絵カードZIPを作成するツールです。
写真・音声・入力内容はブラウザ内だけで処理し、サーバーへ送信しません。
ログイン・利用状況解析・永続保存は行いません。元のPC上のファイルも変更しません。

## 機能

- メイン写真・追加写真、任意音声、絵カード名、カテゴリー、利用する練習の設定
- 正方形トリミング、位置と拡大率の調整、キャンセルと元写真からの再編集
- アプリと同じ7列CSVを含むZIPの作成。アプリへの読み込みは製品版の機能です

## 開発

Node.js 24とpnpm 11を使用します。

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm test
```

## GitHub Pages

Settings → Pages → SourceでGitHub Actionsを選びます。
mainへのpushでテスト・静的ビルド・公開が実行されます。
GitHub Pagesの公開URLとbase pathはActionsから自動取得します。

ローカルで公開用ビルドを作る例:

```sh
NEXT_PUBLIC_BASE_PATH=/ouchistep-material-zip \
NEXT_PUBLIC_SITE_URL=https://nikime-dev.github.io/ouchistep-material-zip \
pnpm build
```

成果物はout/です。外部通信を禁止するCSPをHTMLのmetaへ設定します。
ブラウザで開けない画像形式はトリミングできません。JPEG・PNGを利用してください。
画面を閉じると入力は失われます。作成ZIPは暗号化されません。
