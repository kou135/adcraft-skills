# adcraft

> Claude Code 向けの「広告動画 自動生成 Skill」OSS。
> Remotion をベースに、ユーザーの実プロダクト UI を組み込んだ短尺広告動画（X / Instagram リール想定）を自律ループで生成します。

```
core.md (人が書く方針) + config.yaml (機械設定) + components/ (実 UI)
                          ↓ Claude Code が自律ループ
                  生成 → remotion still で PNG → Claude が画像として読み判定 → 修正 → MP4
                          ↓
                          output/<product>/<YYYY-MM-DD>/
```

---

## 前提条件

- **macOS / Linux**（Windows 未検証）
- **Node.js 20.x 以上**
- **ffmpeg**（Remotion 要件）
- **Claude Code**（Pro / Max サブスク または `CLAUDE_CODE_OAUTH_TOKEN`）
- **pnpm 9.x**（`corepack enable && corepack prepare pnpm@latest --activate` で有効化可能）

### Remotion 公式 Skill の事前インストール（必須）

このプロジェクトは **Remotion 公式 Agent Skill `remotion-dev/skills`** に依存します。Remotion 固有の実装方法（`useCurrentFrame`、`Composition`、`Sequence` 等）は公式 Skill の知識に従います。

```bash
npx skills add remotion-dev/skills
```

未インストール状態で `create-advertisement` Skill を呼び出すと、停止してインストール手順が案内されます。

---

## クイックスタート（30 分）

### 1. クローン & 依存解決（2 分）

```bash
git clone <this-repo> adcraft
cd adcraft
pnpm install
```

### 2. 公式 Skill インストール（1 分）

```bash
npx skills add remotion-dev/skills
```

### 3. サンプル動画を生成（5〜25 分）

Claude Code を起動し、対話モードで：

```
create-advertisement skill で examples/product-sample のリール動画を生成して
```

または headless モード：

```bash
unset ANTHROPIC_API_KEY
claude -p "create-advertisement skill で examples/product-sample のリール動画を 1 本生成して" \
  --permission-mode acceptEdits \
  --max-turns 200
```

成功すると `output/product-sample/YYYY-MM-DD/` に動画と `manifest.json` が出力されます。

---

## 提供される 2 つの Skill

### `extract-product-ui`（Skill A）

ユーザーの実プロダクト（Next.js / React / Vite 等）のソースコードから、動画用に使える純粋なプレゼンテーショナル UI コンポーネントを抽出する。

- **使用頻度**：低い（商品追加 / UI 大型更新時のみ）
- **再実行安全性**：既存の `core.md` と `config.yaml` は絶対に上書きしない
- **詳細**：[`skills/extract-product-ui/SKILL.md`](./skills/extract-product-ui/SKILL.md)

### `create-advertisement`（Skill B）

`products/<name>/` の設定とコンポーネントを使って、Remotion で広告動画を複数本生成 → 視覚検証 → 自己修正 → MP4 出力する。

- **使用頻度**：高い（手動 / cron）
- **不変ルール**：[`rules/create-advertisement-rules.md`](./rules/create-advertisement-rules.md)（v1.0.0 / 12 ルール）
- **詳細**：[`skills/create-advertisement/SKILL.md`](./skills/create-advertisement/SKILL.md)

---

## 自分のプロダクトで使う

### Step 1. UI を抽出

```
extract-product-ui skill で /path/to/my-product を myproduct という名前で adcraft に追加して
```

`products/myproduct/` が生成されます。

### Step 2. マーケ方針を記入

`products/myproduct/core.md` を開いて、ターゲット層・訴求軸・ブランドトーンを記入。
`products/myproduct/config.yaml` でフォーマットや本数を調整。

### Step 3. 動画を生成

```
create-advertisement skill で myproduct の動画を生成して
```

---

## ディレクトリ構成

```
adcraft/
├── skills/
│   ├── extract-product-ui/SKILL.md
│   └── create-advertisement/SKILL.md
├── rules/create-advertisement-rules.md
├── lib/
│   ├── manifest.ts           # 出力メタデータの atomic write
│   ├── validators.ts         # 視覚検証チェックリスト
│   └── remotion-helpers.ts   # フォーマットプリセット
├── templates/
│   ├── core.md.template
│   ├── config.yaml.template
│   └── components/_shared/   # Tailwind フォールバック
├── remotion/
│   ├── remotion.config.ts
│   └── src/
│       ├── Root.tsx
│       ├── compositions/     # 動的生成領域（gitignore）
│       └── shared/
│           ├── IPhoneFrame.tsx
│           ├── TextOverlay.tsx
│           └── transitions.tsx (ZoomIn / Fade / ClickRipple / ScrollSim)
├── products/<name>/          # ユーザー編集領域
├── output/<product>/<date>/  # 生成物（gitignore）
├── examples/product-sample/  # クイックスタート用サンプル（TaskFlow）
└── docs/                     # 追加ドキュメント
```

---

## ヘッドレス実行（cron 用）

```bash
cd /path/to/adcraft && \
  unset ANTHROPIC_API_KEY && \
  claude -p "create-advertisement skill で全商品の動画を生成して" \
    --permission-mode acceptEdits \
    --max-turns 200 \
    --output-format stream-json \
    >> logs/$(date +%Y%m%d-%H%M%S).log 2>&1
```

注：`ANTHROPIC_API_KEY` がセットされていると Claude Code がそちらを優先します。サブスク利用時は明示的に `unset` してください。

---

## 設計思想：3 層の責務分離

```
┌─────────────────────────────────────────┐
│ 配信レイヤー（本 Skill の責務外）           │
│ Git push / SNS API / 管理画面 / DB        │
│ → ユーザー側で別途実装                     │
└─────────────────────────────────────────┘
              ↑ output/ を入力に
┌─────────────────────────────────────────┐
│ 広告動画ワークフロー（本 Skill の責務）      │
│ extract-product-ui + create-advertisement │
└─────────────────────────────────────────┘
              ↑ Remotion API を使用
┌─────────────────────────────────────────┐
│ Remotion 実装知識（remotion-dev/skills）  │
│ npx skills add remotion-dev/skills       │
└─────────────────────────────────────────┘
```

本プロジェクトは中段のみを担当します。Git push、SNS 投稿、DB 連携などは実装しません。配信が必要な場合は `output/` ディレクトリと `manifest.json` を入力にしたスクリプトを別途用意してください。

---

## License & Compliance

This project (`adcraft`) is licensed under MIT. See [LICENSE](./LICENSE).

### ⚠️ Important: Remotion License Notice

This project depends on [Remotion](https://www.remotion.dev), which uses
its own dual-license model (Free / Company), separate from this project's
MIT license.

- ✅ **Free for**: individuals, organizations with ≤3 employees,
  non-profits, evaluators
- 💰 **Company License required for**: for-profit organizations with
  4+ employees

**You are responsible for ensuring your organization complies with
Remotion's license terms.** Read the [Remotion License](https://www.remotion.dev/docs/license)
before using this project commercially.

This project does **not** redistribute Remotion. It declares Remotion as
an npm dependency. See [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md)
for full details.

---

## ドキュメント

- [`docs/getting-started.md`](./docs/getting-started.md) — 詳細なはじめかた
- [`docs/core-md-guide.md`](./docs/core-md-guide.md) — 良い `core.md` の書き方
- [`docs/config-yaml-schema.md`](./docs/config-yaml-schema.md) — `config.yaml` の全フィールド
- [`docs/customizing-rules.md`](./docs/customizing-rules.md) — 不変ルールのカスタマイズ
