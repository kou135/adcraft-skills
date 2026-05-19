# Getting Started

このガイドは初回セットアップから 1 本目の動画を出力するまでをステップバイステップで解説します。

## 前提

- Node.js 20.x 以上
- pnpm 9.x（`corepack enable && corepack prepare pnpm@latest --activate`）
- ffmpeg
- Claude Code（Pro/Max サブスクまたは API キー）
- macOS / Linux

## 1. クローン & 依存解決

```bash
git clone <this-repo> adcraft
cd adcraft
pnpm install
```

`pnpm install` で Remotion と関連パッケージが `node_modules/` に取得されます。**Remotion 本体のソースはこのリポジトリには含まれていません**（Remotion ライセンス上の再配布禁止に抵触するため）。

## 2. Remotion 公式 Skill のインストール

```bash
npx skills add remotion-dev/skills
```

Claude Code の Skill 領域（`~/.claude/skills/` 配下）にインストールされます。本 Skill が Remotion `.tsx` を生成するときに自動的に参照されます。

確認：

```bash
ls ~/.claude/skills/ | grep remotion
```

## 3. サンプル動画の生成（TaskFlow）

`examples/product-sample/` には TaskFlow というサンプル商品が準備済みです。

### 対話モード（推奨）

Claude Code を起動して：

```
create-advertisement skill で examples/product-sample のリール動画を 1 本だけ生成して
```

Claude が以下のフローを実行します：

1. `rules/create-advertisement-rules.md` を読む
2. `examples/product-sample/core.md` と `config.yaml` を読む
3. WebSearch でショート動画のコツを軽くリサーチ
4. 生成計画を立て、ユーザーに確認
5. Remotion `.tsx` を生成 → still で PNG → 視覚検証 → 修正 → MP4 レンダリング
6. `output/product-sample/YYYY-MM-DD/` に成果物配置

### headless モード

```bash
unset ANTHROPIC_API_KEY  # サブスク利用時に必要
claude -p "create-advertisement skill で examples/product-sample のリール動画を 1 本生成して。承認不要、最後まで自律実行して。" \
  --permission-mode bypassPermissions \
  --max-turns 200 \
  --output-format stream-json --verbose
```

**重要**：
- `bypassPermissions` を使うこと（`acceptEdits` だと Bash 権限で止まる）
- 「承認不要、最後まで自律実行して」をプロンプトに含めること（含めないと計画提示で turn 終了）
- `stream-json --verbose` で進捗を可視化（初回は Chromium DL で 5〜10 分かかる）

## 4. 出力の確認

```
output/product-sample/2026-05-04/
├── manifest.json
├── product-sample-reel-1.tsx
├── product-sample-reel-1.mp4
├── product-sample-reel-1.preview.png
├── product-sample-reel-1.validation.json
└── .frames/
    ├── product-sample-reel-1-f0.png
    ├── product-sample-reel-1-f375.png
    └── product-sample-reel-1-f749.png
```

`manifest.json` には生成された動画のメタデータが構造化保存されています。

## 5. 自分のプロダクトに進む

サンプルが動いたら、自分のプロダクトを取り込みます。

```
extract-product-ui skill で /path/to/my-nextjs-project を mynote という名前で抽出して
```

抽出後、`products/mynote/core.md` を編集してマーケ方針を記入し、再度 `create-advertisement` を呼び出します。

## 6. 上位 Skill C（実写級 + ナレーション）に進む（任意）

Skill B でイラスト系広告が回るようになったら、Skill C で実写級 + ナレーション付きの動画にステップアップできます。

**前提**:
- Higgsfield 課金（Starter $15/月〜）+ ElevenLabs 課金（Starter $5/月〜）
- `products/<name>/` の中身に `assets/voice-spec/` と `assets/reference/index.md` を整備

詳細は [`higgsfield-skill-guide.md`](./higgsfield-skill-guide.md)、執筆指針は [`voice-spec-design.md`](./voice-spec-design.md)、カテゴリ設計の哲学は [`content-category-framework.md`](./content-category-framework.md) を参照。

---

## トラブルシューティング

### `remotion-best-practices` Skill がない

```bash
npx skills add remotion-dev/skills
```

### `ANTHROPIC_API_KEY` がセットされていてサブスクが使われない

```bash
unset ANTHROPIC_API_KEY
```

### Remotion レンダリングが遅い / 失敗する

- メモリ 4GB 以上推奨
- ffmpeg が PATH に通っているか確認
- `pnpm exec remotion render` を直接実行してエラーメッセージを確認

### 視覚検証ループが収束しない

- `config.yaml.validation.max_iteration` を増やす（デフォルト 3）
- それでも解消しない場合は `output/<product>/<date>/issues.json` を確認

### `claude -p` で計画提示の段階で終了してしまう

R12 のユーザー確認待ちで turn が終了している。プロンプトに「承認不要、最後まで自律実行して」を必ず含める。または対話モード（Claude Code UI から直接呼び出し）で実行する。

### `claude -p --permission-mode acceptEdits` で途中停止する

`acceptEdits` は Edit/Write のみ自動承認で、Bash コマンド（`pnpm exec remotion still` 等）は権限プロンプト待ちになる。`--permission-mode bypassPermissions` を使う。
