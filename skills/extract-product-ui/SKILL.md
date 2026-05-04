---
name: extract-product-ui
description: ユーザーの実プロダクト（Next.js / React / Vite 等）のソースコードから、広告動画用に使えるプレゼンテーショナル UI コンポーネントを抽出して `products/<name>/` に配置する。商品の新規追加時、または実プロダクトの UI 大型更新時に使用。トリガー例：「○○ の UI を抽出」「△△ プロダクトを adcraft に追加」「product-ui を extract」。
---

# extract-product-ui

ユーザーの実プロダクトのソースコードから、広告動画用に使える「純粋なプレゼンテーショナル UI コンポーネント」を抽出する Skill。

## 役割

- 実プロダクト（多くは Next.js / React / Vite ベース）の主要画面コンポーネントを特定
- API 呼び出し・認証ガード・グローバルステート依存・サーバーサイド専用ロジックを除去/置換
- props でダミーデータを受け取る純粋コンポーネントに変換
- Tailwind 設定や globals.css を共有領域にコピー
- `products/<product-name>/` を作成し、Skill B が読める形に整える

## 実行頻度

- **頻度は低い**（商品追加時 / UI 大型更新時のみ）
- 一度抽出したら Skill B（`create-advertisement`）を何度も呼び出して動画を生成する

## 入力

ユーザーが指定する：

1. **対象リポジトリのパス**（絶対パス推奨）
2. **商品名**（kebab-case 推奨。例: `taskflow`, `mynote`）

入力が不足していればユーザーに必ず質問してください（自動推論で勝手に進めない）。

## 処理フロー

### Step 1. 対象リポジトリの構造を解析

`pages/`, `app/`, `src/`, `components/` 配下を `find` / `glob` で走査して主要画面コンポーネントの候補をリストアップする。

候補の判断基準：
- ページコンポーネント（`page.tsx`, `index.tsx`, `route` 系）
- 大きめの画面コンポーネント（行数 50 以上 + JSX 中心）
- 名前から推測できるダッシュボード・リスト・詳細・フォーム系

### Step 2. ユーザーに動画化対象の画面を確認

**自動で進めず、必ずユーザーに確認する。** 候補リストを提示し、動画に使いたい画面を選んでもらう。複数選択可。

例：
```
以下の候補が見つかりました。動画素材として使いたい画面を選んでください（複数可）：
1. app/dashboard/page.tsx (Dashboard)
2. app/tasks/page.tsx (TaskList)
3. app/tasks/[id]/page.tsx (TaskDetail)
4. app/settings/page.tsx (Settings)
```

### Step 3. 各コンポーネントを純粋プレゼンテーショナル化

選ばれた各画面に対して以下の変換を行う：

| 検出パターン | 変換ルール |
|---|---|
| `fetch(...)`, axios, API client 呼び出し | `// TODO: replaced with mock data` コメント + ハードコードされたダミーデータに置換 |
| `useSession()`, `useAuth()` 等の認証フック | 削除し、ログイン済み前提のダミー user を props に追加 |
| `useStore()`, Redux selector 等のグローバルステート | props に置換し、デフォルト値を渡す |
| `'use server'` / `getServerSideProps` 系 | 削除。データは props で受け取る |
| 環境変数参照（`process.env.*`） | ダミー文字列にハードコード（広告動画なので機密情報も入れない） |
| 画像 URL（外部 CDN） | `/assets/*` 相対パスに置換、または画像ファイルを `assets/` にコピー |

すべての置換箇所に `// TODO: replaced with mock data`（または該当コメント）を残すこと。Skill B が後でダミーデータを書き換えやすくする。

### Step 4. 共通設定をコピー

- `tailwind.config.{ts,js}` が存在すれば `products/<name>/components/_shared/tailwind.config.js` にコピー
- `globals.css` / `index.css` 等の root スタイルがあれば `_shared/globals.css` にコピー
- 不在の場合は `templates/components/_shared/` のデフォルトをコピー

### Step 5. ファイルを配置

最終構造：
```
products/<product-name>/
├── components/
│   ├── <Screen1>.tsx
│   ├── <Screen2>.tsx
│   └── _shared/
│       ├── tailwind.config.js
│       └── globals.css
├── core.md           # ひな形（templates/core.md.template から、{{PRODUCT_NAME}} を置換）
├── config.yaml       # ひな形（templates/config.yaml.template から、{{PRODUCT_NAME}} を置換）
└── assets/           # 空ディレクトリ（ユーザーが後でスクショ等を入れる）
```

### Step 6. ユーザーへの最終案内

抽出が完了したら、ユーザーに以下を案内する：

1. `products/<name>/core.md` を編集してマーケ方針を記入する
2. `products/<name>/config.yaml` の `formats` 設定を確認する
3. 必要に応じて `products/<name>/assets/` に実画面スクショを追加する
4. `pnpm exec claude -p "create-advertisement skill で <name> の動画を生成して"` で Skill B を呼び出す

## 不変ルール（厳守）

1. **ユーザーに対象画面の選択を必ず確認**：自動推論で勝手に進めない。
2. **既存の `core.md` と `config.yaml` は絶対に上書きしない**：再実行時は内容を保護し、`components/` のみ差分更新する。
3. **`components/` の既存ファイルがある場合**：差分を提示してからユーザーに上書き確認する（`A` を新規追加、`M` を変更とラベリング）。
4. **API 呼び出しは置換**：`// TODO: replaced with mock data` コメントを必ず残す。コメントなしの置換禁止（後で追跡できなくなるため）。
5. **共通設定が不在ならテンプレからコピー**：`templates/components/_shared/` をフォールバックとして使う。
6. **抽出失敗時の挙動**：部分的なファイルを残さず、エラーをユーザーに通知して停止する（atomic）。

## アンチパターン（やらないこと）

- 動画用に「綺麗に書き換える」リファクタはしない。あくまで実プロダクトの見た目を維持。
- バックエンドコード（API ハンドラ、DB アクセス）は触らない。Skill A の責務は UI 層のみ。
- `core.md` を AI 推論で勝手に埋めない。これは人間が書く欄。ひな形のプレースホルダのまま提示する。
- `config.yaml` の `formats.*.enabled` を勝手に true にしない。デフォルトは `reel: true` のみ。それ以上はユーザー選択。

## エラーハンドリング

| 状況 | 対応 |
|---|---|
| 対象リポジトリパスが存在しない | 即停止、ユーザーに通知 |
| Tailwind/globals が一切見つからない | テンプレからコピーする旨を通知し、続行 |
| 画面選択でユーザーが何も選ばなかった | 中断、対象を選び直すよう案内 |
| 既存 `products/<name>/` がある | `core.md`/`config.yaml` を保護した上で `components/` の差分を提示 |
