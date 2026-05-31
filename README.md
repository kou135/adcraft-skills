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

> このクイックスタートは **Skill B（無料・MCP 不要）** の最短経路です。**Skill C / D（実写級・MCP 利用）** を使う場合は、
> 先に [MCP セットアップ](#mcp-セットアップskill-c--d-利用時) を済ませてください。とくに **Skill D（Runway）** は API 組織作成 +
> $10 チャージ + MCP の clone/build が必要で、別途 **15〜20 分** ほどかかります（詳細は [`docs/runway-skill-guide.md`](./docs/runway-skill-guide.md) の「事前準備」）。

### 1. クローン & 依存解決（2 分）

```bash
git clone https://github.com/kou135/adcraft-skills.git adcraft
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
claude -p "create-advertisement skill で examples/product-sample のリール動画を 1 本生成して。承認不要、最後まで自律実行して。" \
  --permission-mode bypassPermissions \
  --max-turns 200 \
  --output-format stream-json --verbose
```

**重要**：

- `--permission-mode bypassPermissions` を使う（`acceptEdits` だと Bash コマンドの権限プロンプトで止まる）
- プロンプトに「**承認不要、最後まで自律実行して**」等を含める（含めないと R12 のユーザー確認待ちで turn が終了する）
- `--output-format stream-json --verbose` を付けると進捗がリアルタイムで流れる（無音状態で何分も待たずに済む）
- 初回は Remotion が Chromium をダウンロードするため 5〜10 分かかる場合あり

成功すると `output/product-sample/YYYY-MM-DD/` に動画と `manifest.json` が出力されます。

---

## 提供される 4 つの Skill

### `extract-product-ui`（Skill A）

ユーザーの実プロダクト（Next.js / React / Vite 等）のソースコードから、動画用に使える純粋なプレゼンテーショナル UI コンポーネントを抽出する。

- **使用頻度**：低い（商品追加 / UI 大型更新時のみ）
- **再実行安全性**：既存の `core.md` と `config.yaml` は絶対に上書きしない
- **詳細**：[`skills/extract-product-ui/SKILL.md`](./skills/extract-product-ui/SKILL.md)

### `create-advertisement`（Skill B）

`products/<name>/` の設定とコンポーネントを使って、Remotion で広告動画を複数本生成 → 視覚検証 → 自己修正 → MP4 出力する。**Remotion 純粋実装。外部 AI サービス不要、無料で完結**。

- **使用頻度**：高い（手動 / cron）
- **コスト**：$0（ローカル Remotion レンダリングのみ）
- **得意分野**：イラスト系・タイポグラフィ重視・ブランド世界観構築
- **不変ルール**：[`rules/create-advertisement-rules.md`](./rules/create-advertisement-rules.md)（v1.0.0 / R1〜R13）
- **詳細**：[`skills/create-advertisement/SKILL.md`](./skills/create-advertisement/SKILL.md)

### `create-advertisement-with-higgsfield`（Skill C）

Skill B の上位互換。**Higgsfield MCP（GPT Image 2 + Seedance 2.0 等）と ElevenLabs MCP（TTS）** を統合し、実写級リファレンス画像 + 動画 + ナレーション付きの広告動画を生成する。

- **使用頻度**：中（実写級 / 音声付きが必要な時）
- **モード**：v1.2.0 から **lite モード（デフォルト、TTS/BGM オフ）** と **auto モード（`tts.enabled: true` / `bgm.required: true` で opt-in）** を切替可能。lite は無音 MP4 + ナレーション台本 `.md` を出力し、音声・BGM は手動付与する前提（プロダクション品質に到達しやすい）
- **コスト**：lite モード ~$0.36-3.20/リール（TTS 課金なし）／ auto モード ~$3-4（Higgsfield + ElevenLabs ~$0.025）
- **得意分野**：実写級ビジュアル・ナレーション付き世界観動画・ペルソナ pain 訴求モノローグ
- **必須前提**：
  - Higgsfield 有料プラン（Starter $15/月 以上）+ Higgsfield MCP 接続
  - ElevenLabs 有料プラン（auto モード時のみ。Starter $5/月 以上）+ ElevenLabs MCP 接続
  - `products/<name>/assets/voice-spec/{category}.md` + `assets/reference/index.md` の整備
  - `products/<name>/core.md` の `## コンテンツカテゴリ` セクション
- **不変ルール**：[`rules/create-advertisement-with-higgsfield-rules.md`](./rules/create-advertisement-with-higgsfield-rules.md)（v1.2.0 / R-H1〜R-H18）
- **詳細**：[`skills/create-advertisement-with-higgsfield/SKILL.md`](./skills/create-advertisement-with-higgsfield/SKILL.md)

### `create-advertisement-with-runway`（Skill D）

Skill C と同型のパイプラインで、生成バックエンドを **Runway MCP（`gpt_image_2` / `gen4_image` + `seedance2` / `gen4_turbo` 等）と ElevenLabs MCP（TTS）** に差し替えたもの。lite / auto モード・コンテンツカテゴリ・voice-spec・symlink-safe レンダリングを Skill C から継承する。

- **使用頻度**：中（Runway アカウント / Developer API で実写級を作る時）
- **接続**：**ローカル stdio MCP**（[`runwayml/runway-api-mcp-server`](https://github.com/runwayml/runway-api-mcp-server)、`RUNWAYML_API_SECRET`、headless/cron 対応）
- **課金**：Web サブスクではなく **Developer API のクレジット制**（$0.01/credit, 従量・プラン無関係）。balance tool が無いためコストは client 側で算出
- **コスト**：seedance2 + gpt_image_2 で ~$8/リール、gen4_turbo + gen4_image（native）なら ~$1.2/リール
- **得意分野**：Runway native モデルの品質、seedance2/gpt_image_2 を Runway 経由で利用（Higgsfield 版とモデルファミリーを揃えた比較。backend/価格/呼出経路は異なる）
- **必須前提**：
  - Runway Developer API キー（dev.runwayml.com、最低 $10 チャージ）+ Runway MCP（ローカル stdio）接続
  - ElevenLabs（auto モード時のみ）+ ElevenLabs MCP 接続
  - `products/<name>/assets/voice-spec/{category}.md` + `assets/reference/index.md` の整備
- **Runway 固有の注意**：ratio は pixel 文字列 `"720:1280"`、model ID literal（`gen4.5` / `gen4_image`）、生成物 URL は 24h 失効（即DL）
- **不変ルール**：[`rules/create-advertisement-with-runway-rules.md`](./rules/create-advertisement-with-runway-rules.md)（v1.0.0 / R-R1〜R-R19）
- **詳細**：[`skills/create-advertisement-with-runway/SKILL.md`](./skills/create-advertisement-with-runway/SKILL.md) / 運用ガイド [`docs/runway-skill-guide.md`](./docs/runway-skill-guide.md)

### どちらの skill を使う？

| やりたいこと | 推奨 |
|---|---|
| まず試してみたい / 無料でやりたい | Skill B（`create-advertisement`） |
| イラスト・タイポグラフィ系のリール | Skill B |
| 実写級の映像 + ナレーションが欲しい | Skill C（`create-advertisement-with-higgsfield`） |
| ペルソナの一人称モノローグ動画 | Skill C / Skill D |
| ブランド世界観をプロフェッショナルに表現 | Skill C / Skill D |
| 量産（月 10 本以上） | Skill B（コスト 0）|
| 試験運用 / 高品質少数本 | Skill C |
| Runway アカウント / Developer API で実写級を作る | Skill D（`create-advertisement-with-runway`） |
| Runway native（gen4_turbo / gen4_image）で安価に実写級 | Skill D |

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
│   ├── create-advertisement/SKILL.md
│   ├── create-advertisement-with-higgsfield/SKILL.md   # Skill C
│   └── create-advertisement-with-runway/SKILL.md       # Skill D
├── rules/
│   ├── create-advertisement-rules.md
│   ├── create-advertisement-with-higgsfield-rules.md   # R-H1〜R-H18
│   └── create-advertisement-with-runway-rules.md       # R-R1〜R-R19
├── lib/
│   ├── manifest.ts           # 出力メタデータの atomic write
│   ├── validators.ts         # 視覚検証チェックリスト
│   ├── remotion-helpers.ts   # フォーマットプリセット
│   ├── cost-tracker.ts       # コスト追跡（Skill C / D 共通）
│   ├── higgsfield-checklist.ts  # Skill C 画像チェック
│   ├── runway-cost.ts        # Skill D コスト計算（balance 非対応の代替）
│   └── runway-checklist.ts   # Skill D 画像チェック
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
  mkdir -p logs && \
  claude -p "create-advertisement skill で全商品の動画を生成して。承認不要、最後まで自律実行して。" \
    --permission-mode bypassPermissions \
    --max-turns 200 \
    --output-format stream-json --verbose \
    >> logs/$(date +%Y%m%d-%H%M%S).log 2>&1
```

注：`ANTHROPIC_API_KEY` がセットされていると Claude Code がそちらを優先します。サブスク利用時は明示的に `unset` してください。

---

## コンテンツカテゴリ・フレームワーク（Skill C 専用）

`create-advertisement-with-higgsfield` skill は、`core.md` の `## コンテンツカテゴリ` セクションで定義された **3 種類の容器** にコンテンツを振り分けて生成する。

### なぜカテゴリを分けるのか

同じプロダクトでも、**世界観訴求の動画と機能紹介の動画では、声色・構成・テンポ・ビジュアルすべてが異なる**。これを 1 つの設定で混ぜると、どちらも中途半端になる。カテゴリ別に独立した spec を持つことで、各容器に最適化された生成が可能になる。

### 推奨初期カテゴリ（マーケファネルの 3 段を網羅）

| category | 目的 | マーケファネル位置 |
|---|---|---|
| `worldview` | ブランドの世界観・到達したい状態を体感させる | 認知 |
| `feature` | プロダクトの主機能の "体感" を実演 | 検討 |
| `persona` | ペルソナのペインを直撃して「これ私だ」を引き出す | 共感深化 |

### ファイル構成

```
products/<name>/
├── core.md                            ← ## コンテンツカテゴリ セクションで 3 つを定義
└── assets/
    ├── voice-spec/                    ← 各カテゴリの "声色" 仕様
    │   ├── _index.md                  ← カテゴリ一覧 + 共通制約
    │   ├── worldview.md               ← 世界観訴求の voice persona / SSML / voice_id
    │   ├── feature.md                 ← 機能訴求の voice persona / SSML / voice_id
    │   └── persona.md                 ← ペルソナ pain 訴求の voice persona / SSML / voice_id
    ├── reference/                     ← 実プロダクト UI のスクショ
    │   ├── index.md                   ← 画面 → スクショ ファイルの対応表
    │   ├── home.png
    │   ├── feature-x.png
    │   └── ...
    └── bgm/                           ← 任意（BGM 使用時）
        └── *.mp3
```

### variation_note に `[category]` タグを付ける

各 variation の `variation_note` は先頭に `[category]` タグを必ず含める:

```
[worldview] Higgsfield 版 / 実写級リファレンス画像生成 / ...
[feature] アプリ操作実演 / "1 日 1 語 → 3 問 → 完了" の体感 / ...
[persona] 隙間時間の浪費家 視点 / 朝の通勤シーン / ...
```

タグ無しは `MISSING_CATEGORY_TAG` で fail-fast（R-H14）。

### voice-spec の作り方

`templates/assets/voice-spec/*.md.template` を雛形に、`products/<name>/assets/voice-spec/` 配下にコピー → 中身を本プロダクト用に書き直す。

各 spec は以下 6 セクションが必須:

- `Voice Persona`（年齢感 / 性別感 / 関係性 / 距離感）
- `Tone Keywords`（max 5、具体的・audio-quality に翻訳可能なもの）
- `Pace Target`（chars/min / talk-time ratio / pause budget）
- `Prosody Patterns`（SSML テンプレ）
- `Taboos`（避けるべき声色 / 表現）
- `Recommended ElevenLabs Voices`（優先順位リスト）

各 spec は **一度確定したら autonomous 実行中 read-only**（R-H17）。

---

## MCP セットアップ（Skill C / D 利用時）

Skill C は Higgsfield MCP + ElevenLabs MCP、Skill D は Runway MCP + ElevenLabs MCP に依存する。事前にセットアップが必要。

### Higgsfield MCP（Skill C）

```bash
claude mcp add higgsfield --type http --url https://mcp.higgsfield.ai/mcp
# OAuth 認証フローに従って Higgsfield アカウントと連携
```

**プラン要件**：
- **Starter $15/月**：image2 + Seedance 2.0 + kling 等すべて利用可、200 cred（kling 中心で月 ~5 リール）
- ⚠️ **Seedance 2.0 は地域により制限される可能性あり**。日本ブロックが報告されている。失敗時は R-H5 により静止画 + ZoomIn に自動 fallback されるので致命的ではない

### Runway MCP（Skill D）

ローカル stdio MCP（headless/cron 対応）を前提とする。詳細は [`docs/runway-skill-guide.md`](./docs/runway-skill-guide.md)。

```bash
# 1. dev.runwayml.com で組織作成 → API キー発行（最低 $10 チャージ要）
export RUNWAYML_API_SECRET="key_xxxxx"
# 2. 公式 MCP サーバを clone + build
git clone https://github.com/runwayml/runway-api-mcp-server
cd runway-api-mcp-server && npm install && npm run build
# 3. Claude Code に追加
claude mcp add runway -e RUNWAYML_API_SECRET=$RUNWAYML_API_SECRET -e MCP_TOOL_TIMEOUT=1000000 \
  -- node /abs/path/to/runway-api-mcp-server/build/index.js
```

**課金**：Web サブスクではなく **Developer API のクレジット制**（$0.01/credit, 従量・プラン無関係）。Web プランを買っても API クレジットは付かない。

### ElevenLabs MCP（Skill C / D 共通、auto モード時）

```bash
# 1. ElevenLabs ダッシュボードで API キーを発行 (https://elevenlabs.io)
# 2. API キーを環境変数に保存（platxt commit 防止のため env 経由推奨）
echo 'export ELEVENLABS_API_KEY="sk_xxxxx"' >> ~/.zshenv
source ~/.zshenv

# 3. MCP server を追加
claude mcp add elevenlabs --type stdio --command "uvx elevenlabs-mcp" --env ELEVENLABS_API_KEY=$ELEVENLABS_API_KEY
```

**プラン要件**：
- **Starter $5/月**：Voice Library アクセス + 商用 OK + 30k char/月（200+ リール分）
- **Creator $22/月**：Professional Voice Cloning + 121k char（fine-tuning 検討時）

### 接続確認

```bash
claude mcp list
# higgsfield: ... ✓ Connected   （Skill C）
# runway:     ... ✓ Connected   （Skill D）
# elevenlabs: ... ✓ Connected   （auto モード時）
```

利用する skill の MCP が `✓ Connected` になれば準備完了。Skill C は R-H1、Skill D は R-R1 で起動時に疎通確認する。

---

## セキュリティ注意事項

### API キーの取り扱い

- ❌ `~/.claude.json` に API キーを **平文で書き込まない**。Claude Code MCP 設定の `env` フィールドは `${env:VAR_NAME}` 形式で環境変数参照することを推奨
- ❌ プロジェクト内の `.env` `.envrc` `secrets.json` 等の機密ファイルを git commit しない（`.gitignore` で防御済み）
- ❌ Slack / GitHub Issue / Discord 等への貼り付け禁止
- ✅ ローテーション：万一漏洩が疑われたら **すぐに ElevenLabs / Higgsfield ダッシュボードで該当キーを Revoke + 新規発行**

### `.claude.json` の扱い

Claude Code は `~/.claude.json`（ホームディレクトリ）に MCP 設定を保管する。リポジトリには来ないが:

- このファイルは **絶対にコピーしてリポジトリに入れない**
- バックアップツール（iCloud / Dropbox / git-managed dotfiles）で同期する場合、その配信先のアクセス制御を確認
- 共有 PC で Claude Code を使う場合、別アカウント / 別ユーザーで分離

### git 履歴の監査

定期的に履歴を監査:

```bash
# キー流出の検出（過去全コミット）
git log --all --full-history -p -G "sk_[a-f0-9]{40,}" | head -30
git log --all --full-history -p -S "ELEVENLABS_API_KEY" | head -30
```

ヒットした場合は `git filter-repo` か BFG Repo-Cleaner で履歴クリーンアップ。

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
