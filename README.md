<img src="assets/icon.svg" width="56" height="56" alt="AI Model Release Radar">

# AI Model Release Radar

著名なAIモデルのリリース情報だけを1ページで俯瞰できる静的Webサイト＆デイリー自動更新システムです。
横軸に主要AI企業・研究機関、縦軸に月単位で過去にさかのぼる時系列マトリクスを採用しています。

> **English Summary:** A single-page chronological release matrix of landmark AI models (Labs across × Months descending into the past), featuring JA/ZH/EN localization, a zero-dependency daily crawler, and GitHub Pages deployment.

---

## 主な特徴 (Features)

- **企業 × 月別マトリクス表示**: 横軸に 8 つの主要機関（OpenAI / Anthropic / Google DeepMind / Meta / DeepSeek / xAI / Mistral AI / Alibaba Qwen）、縦軸に最新月から過去へ遡る月次タイムラインを配置。ヘッダーと月列を固定し、スクロールしても見失いません。
- **日中英（日本語 / 中文 / English）ワンクリック切替**: UI 文言・日付フォーマット・各モデルの概要/ハイライトをすべて 3 言語で表示。URL クエリ `?lang=ja|zh|en` やブラウザ設定にも対応。
- **検索・カテゴリ・年ジャンプ・詳細ドロワー**: モデル名検索（`/` キー）、`Flagship` / `Reasoning` / `Open Weights` / `Multimodal` / `Compact` フィルタ、年ジャンプボタン、空白月圧縮、マトリクス／タイムライン表示切替、各社ラインカラーによる列識別、右側スライドオーバー仕様書ドロワー（`←`/`→` 送り）に対応。
- **自作ゼロ依存デイリークローラー**: 外部 npm パッケージを使わず Node.js 20+ 標準機能のみで OpenRouter API・公式/ミラー RSS・Hugging Face Hub API・GitHub Releases を巡回。量子化派生やノイズを除外し、著名モデルの新規リリースのみを自動追記します。
- **GitHub Pages 完全対応**: ビルド成果物 `dist/` は相対パスで構成されており、リポジトリサブパス上でもそのまま動作します。

---

## コマンド一覧 (Local Commands)

外部パッケージのインストール（`npm install`）は不要です。Node.js 20 以上で動作します。

```bash
# 全自動テストを実行（外部通信なし・モック検証）
npm test

# キュレーション＋クロール済みデータのオフライン結合・検証
npm run crawl:offline

# 静的サイトを dist/ へビルド
npm run build

# ローカルサーバー (http://127.0.0.1:4173/) で dist/ をプレビュー
npm run dev

# ライブクローラーのドライラン（ファイル書き込みなし）
npm run crawl:dry

# ライブクローラーを実行して data/ を更新
npm run crawl
```

---

## データ更新と GitHub Pages 公開手順

### 1. GitHub Pages を有効化する
1. GitHub リポジトリの **Settings → Pages** を開きます。
2. **Build and deployment → Source** で **GitHub Actions** を選択します。
3. `main` ブランチへのプッシュ時に [deploy-pages.yml](.github/workflows/deploy-pages.yml) が自動実行され、`dist/` が公開されます。

### 2. デイリー自動更新（毎日 02:00 UTC）
- [daily-update.yml](.github/workflows/daily-update.yml) が毎日自動実行され、新規の著名モデルを検出すると `data/` を自動コミットしたうえで GitHub Pages を再ビルド・デプロイします。
- リポジトリの **Settings → Actions → General → Workflow permissions** で **Read and write permissions** が有効になっていることを確認してください。
- （任意）Repository Secrets に `GEMINI_API_KEY` を設定すると、自動検出された新モデルの概要文をより自然な日中英解説に自動整形できます（未設定時は組み込みの多言語テンプレートに自動フォールバックします）。

### 3. 手動でモデルを追加・修正する場合
- [data/curated-models.json](data/curated-models.json) を編集して `npm test && npm run build` を実行すると検証と反映が行われます。キュレーションデータはクローラーによって上書きされません。
