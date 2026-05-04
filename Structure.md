# 広告動画自動生成 Skill — ディレクトリ構成 & システム条件

## ディレクトリ構成

### リポジトリ全体構造

```
adcraft/
├── README.md                              # OSS利用者向けドキュメント（ライセンスセクションを含む）
├── LICENSE                                # MIT License（本プロジェクト本体）
├── THIRD_PARTY_LICENSES.md                # 依存ライブラリのライセンス情報・Remotion注意喚起
├── package.json                           # 依存定義（Remotionはここでnpm依存として宣言）
├── tsconfig.json
├── .gitignore                             # output/, node_modules/, *.log 等
│
├── skills/
│   ├── extract-product-ui/
│   │   ├── SKILL.md                       # frontmatter付きSkillエントリ
│   │   └── scripts/                       # 補助スクリプト（必要に応じて）
│   │
│   └── create-advertisement/
│       ├── SKILL.md                       # frontmatter付きSkillエントリ
│       └── scripts/
│
├── rules/
│   └── create-advertisement-rules.md      # ゴール・制約・受入基準（OSSコア）
│
├── lib/                                   # 共通ユーティリティ
│   ├── remotion-helpers.ts                # Remotion共通コンポーネント
│   ├── validators.ts                      # 視覚検証ヘルパー
│   └── manifest.ts                        # manifest.json生成
│
├── templates/                             # ひな形テンプレート
│   ├── core.md.template
│   ├── config.yaml.template
│   └── components/
│       └── _shared/
│           ├── tailwind.config.js
│           └── globals.css
│
├── products/                              # ユーザー編集領域
│   └── .gitkeep
│
├── output/                                # 生成物（.gitignore対象）
│   └── .gitkeep
│
├── examples/
│   └── product-sample/                    # サンプル商品（コピペで動く）
│       ├── core.md
│       ├── config.yaml
│       ├── components/
│       │   ├── SampleDashboard.tsx
│       │   └── _shared/
│       │       ├── tailwind.config.js
│       │       └── globals.css
│       └── assets/
│           └── screenshot-sample.png
│
├── remotion/                              # Remotion設定と共通パーツ（Remotion本体ソースは含まない）
│   ├── remotion.config.ts                 # 自前の設定ファイル
│   ├── src/
│   │   ├── Root.tsx                       # 自前のcompositions root
│   │   ├── compositions/                  # 動的に生成される動画コンポジション（gitignore）
│   │   │   └── .gitkeep
│   │   └── shared/                        # 共通の動画用パーツ（自前実装）
│   │       ├── IPhoneFrame.tsx
│   │       ├── TextOverlay.tsx
│   │       └── transitions.tsx
│   └── public/                            # 静的アセット
│
└── docs/
    ├── getting-started.md
    ├── core-md-guide.md
    ├── config-yaml-schema.md
    └── customizing-rules.md
```

**重要：Remotion本体のソースコードはリポジトリに含めない。** `package.json` で npm 依存として宣言し、利用者が `npm install` で取得する。`remotion/` 配下に置くのは自前で書いた設定ファイルと共通動画パーツのみ。

### `products/<product-name>/` の構造（ユーザー編集領域）

```
products/<product-name>/
├── core.md                                # マーケ方針（散文）
├── config.yaml                            # 機械設定（構造化）
├── components/                            # Skill A が生成
│   ├── <Screen>.tsx
│   └── _shared/
│       ├── tailwind.config.js
│       └── globals.css
└── assets/                                # 実画面スクショ・素材
    └── *.png
```

### `output/<product-name>/<YYYY-MM-DD>/` の構造（生成物）

```
output/<product-name>/<YYYY-MM-DD>/
├── manifest.json                          # 生成メタデータ
├── reel-1.tsx                             # Remotionソース
├── reel-1.mp4                             # 出力動画
├── reel-1.preview.png                     # サムネイル
├── reel-1.validation.json                 # 検証ログ
├── reel-2.tsx
├── ...
├── slide-1.tsx
├── slide-1.png
├── ...
└── issues.json                            # 修正ループで解消できなかった問題
```

---

## ライセンスファイル

### `LICENSE`（必須）

本プロジェクト本体のライセンス。MIT を採用する。

```
MIT License

Copyright (c) 2026 <your name>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### `THIRD_PARTY_LICENSES.md`（必須）

依存ライブラリのライセンス情報を記載。特に Remotion の独自ライセンスについては明確に注意喚起する。

```markdown
# Third-Party Licenses

This project (`adcraft`) is licensed under MIT (see LICENSE file).

It depends on third-party packages, each governed by their own licenses.
Below are the notable ones:

---

## Remotion (https://www.remotion.dev)

License: Custom dual-license (Free / Company)

Remotion uses a custom license model that is NOT a standard OSI-approved license:

- **Free License**: available for individuals, for-profit organizations 
  with up to 3 employees, non-profits, and evaluators
- **Company License**: required for for-profit organizations not eligible 
  for the Free License (typically 4+ employees)

⚠️ **Important**: Users of this project must independently verify their 
compliance with Remotion's license terms based on their organization size. 
See https://www.remotion.dev/docs/license for the official terms.

This project does NOT redistribute Remotion source code. Remotion is 
declared as an npm dependency in `package.json` and installed by users 
during `npm install`. The `remotion/` directory in this repository contains 
only configuration files and custom video components written for this project.

---

## React (https://react.dev)

License: MIT  
Copyright (c) Meta Platforms, Inc. and affiliates.

---

## TypeScript (https://www.typescriptlang.org)

License: Apache-2.0  
Copyright (c) Microsoft Corporation.

---

## Other dependencies

For a complete list of dependencies and their licenses, run:

\`\`\`bash
npx license-checker --summary
\`\`\`

Most dependencies use MIT or Apache-2.0 licenses, which require only that 
copyright notices be preserved. The notable exception is Remotion (see above).
```

### `README.md` のライセンスセクション

リポジトリのトップ READMEには以下のセクションを必ず含める：

```markdown
## License & Compliance

This project (`adcraft`) is licensed under MIT. See [LICENSE](./LICENSE).

### Important: Remotion License Notice

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

This project does not redistribute Remotion. It declares Remotion as an 
npm dependency. See [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md) 
for full details.
```

---

## 依存Skill（外部）

本リポジトリには Remotion実装知識を含めない。利用者は別途以下をインストールする：

```bash
npx skills add remotion-dev/skills
```

このSkillは Claude Code の Skill 領域（通常 `~/.claude/skills/` 配下）にインストールされ、Remotion関連のコード生成時に自動的に参照される。

本リポジトリの2つのSkillは、Remotion固有の実装方法を再定義せず、`remotion-best-practices` Skill の知識に従って `.tsx` を生成する前提で動作する。

---

## ファイル仕様

### `SKILL.md`（各Skill共通フォーマット）

```markdown
---
name: extract-product-ui
description: ユーザーの実プロダクトのソースコードから動画用UI層を抽出する。Next.js/React/Vue対応。商品の新規追加時やUI大型更新時に使用。
---

# extract-product-ui

（Skillの動作説明、引数仕様、参照ファイル等）
```

`description` は Claude Code が Skill を起動判定するために使うので、トリガーワードを明確に含める。

### `core.md` の構造（テンプレート）

```markdown
# <商品名> マーケティング方針

## プロダクト概要
（1〜2段落で何を解決するか）

## ターゲット層
- （箇条書きで具体的に）

## 訴求の軸
- （優先順位の高い訴求ポイント）

## ブランドトーン
- （言葉遣い、トーンの方針）

## 避けたい表現
- （NGワード、避けたい言い回し）

## 参考にしたい広告のテイスト（任意）
- （参考リンクや形容詞）
```

### `config.yaml` のスキーマ

```yaml
product_name: string                       # 必須
description: string                        # 任意

formats:
  reel:
    enabled: boolean                       # デフォルト false
    count: integer                         # 1本あたりの生成本数
    duration: integer                      # 秒
    aspect: string                         # 例: "9:16"
    fps: integer                           # デフォルト 30
  slide_image:
    enabled: boolean
    count: integer
    aspect: string                         # 例: "1:1" or "4:5"
    slides_per_set: integer                # 1セット内の枚数
  horizontal:
    enabled: boolean
    count: integer
    duration: integer
    aspect: string                         # 例: "16:9"
    fps: integer
  blog:
    enabled: boolean
    count: integer
    target_word_count: integer

output:
  base_dir: string                         # デフォルト "./output"。生成物の置き場のみ指定

validation:
  max_iteration: integer                   # デフォルト 3
  check_frames: array                      # 例: [0, "mid", "end"]
  strict_mode: boolean                     # デフォルト false

variation:
  strategy: string                         # "auto" | "manual"
  manual_directions: array                 # strategy="manual"時のみ
    # - "機能訴求"
    # - "問題解決"
    # - "Before/After"
```

**Note**：配信関連の設定（`github_branch`、`preview_base_url` 等）は本Skillの責務外のため `config.yaml` に含めない。配信が必要な場合はユーザー側で別途スクリプトを用意し、`output/` を読み取って処理する。

将来的に配信レイヤーが拡張される場合、optional な `publish:` セクションを後方互換で追加可能（詳細は仕様書「将来の拡張案」を参照）。

### `manifest.json` のスキーマ

```json
{
  "product": "string",
  "generated_at": "ISO8601 string",
  "rules_version": "string",
  "items": [
    {
      "type": "reel | slide | horizontal | blog",
      "id": "string",
      "file": "relative path",
      "preview": "relative path",
      "duration_sec": "number (動画のみ)",
      "validation": {
        "passed": "boolean",
        "iterations": "integer",
        "issues": "array of issue objects"
      },
      "variation_note": "string"
    }
  ]
}
```

**Note**：Git/配信関連のメタデータは含めない。配信レイヤーで必要であれば、配信スクリプトが `manifest.json` を読み取った後に独自にメタデータを追加する設計。

---

## システム条件

### 動作環境

| 項目 | 要件 |
|------|------|
| OS | macOS / Linux（Windows未検証） |
| Node.js | 20.x 以上 |
| ffmpeg | Remotion要件に準拠 |
| Claude Code | 最新版、Pro/Maxサブスクまたは`CLAUDE_CODE_OAUTH_TOKEN`設定済み |
| `remotion-dev/skills` | **事前インストール必須**（`npx skills add remotion-dev/skills`） |
| メモリ | Remotionレンダリング時 4GB 以上推奨 |
| ストレージ | `output/` 用に商品あたり最低500MB目安 |

### 依存パッケージ（package.json）

```json
{
  "dependencies": {
    "remotion": "^4.x",
    "@remotion/cli": "^4.x",
    "@remotion/google-fonts": "^4.x",
    "@remotion/transitions": "^4.x",
    "@remotion/player": "^4.x",
    "react": "^18.x",
    "react-dom": "^18.x",
    "yaml": "^2.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "@types/react": "^18.x",
    "@types/node": "^20.x"
  }
}
```

### 環境変数

| 変数名 | 用途 | 必須 |
|--------|------|------|
| `CLAUDE_CODE_OAUTH_TOKEN` | headless実行時の認証 | cron実行時のみ |
| `ADVERTISEMENT_OUTPUT_DIR` | `output/` のパス上書き | 任意 |

`ANTHROPIC_API_KEY` がセットされていると Claude Code がそちらを優先するので、サブスク利用時は **明示的に unset** すること。

### 自律ループ実行コマンド（cron用）

```bash
cd /path/to/adcraft && \
  unset ANTHROPIC_API_KEY && \
  claude -p "create-advertisement skillで全商品の動画を生成して" \
    --permission-mode acceptEdits \
    --max-turns 200 \
    --output-format stream-json \
    >> logs/$(date +%Y%m%d-%H%M%S).log 2>&1
```

### `.gitignore`

```
node_modules/
output/
logs/
*.log
.DS_Store
products/*/components/_shared/.cache
remotion/src/compositions/*
!remotion/src/compositions/.gitkeep
.env
.env.local
```

---

## Skill実装上のルール

### Skill A: `extract-product-ui` の実装ルール

1. ユーザーに対象画面の選択を必ず確認（自動推論で勝手に進めない）
2. 既存の `core.md` `config.yaml` は **絶対に上書きしない**（再実行安全性）
3. `components/` 配下に既存ファイルがある場合は差分提示してから上書き確認
4. 抽出時、API呼び出しは `// TODO: replaced with mock data` コメントを残してダミーデータに置換
5. Tailwindなど共通設定が見つからない場合はデフォルトテンプレート（`templates/components/_shared/`）をコピー

### Skill B: `create-advertisement` の実装ルール

1. 必ず `rules/create-advertisement-rules.md` を最初に読み込む
2. 対象商品の `core.md` `config.yaml` を読み込み、内容に矛盾があれば実行前に指摘
3. 生成計画を立てたら、**実行前にユーザー確認を求める**（手動実行時のみ。`claude -p` のheadless時は自動承認）
4. 各動画の生成は独立したループで完結（1本失敗しても他に影響を出さない）
5. Remotion固有の実装は `remotion-best-practices` Skill の知識に委譲する。本Skill内でRemotion APIの使い方を再定義しない
6. 視覚検証は構造化されたJSONで結果を返す。必ず `<output>/<id>.validation.json` に保存
7. 修正ループ上限を超えたら `issues.json` に記録してスキップ、次の動画へ進む
8. `manifest.json` 生成は最後の処理。中断されたら部分的な状態を残さない（atomic write）
9. **配信処理は実装しない**：Git push、API投稿、外部システム連携は責務外。生成物を `output/` に配置して終了する

### Remotion実装上のルール

1. すべての動画コンポジションは `remotion/src/compositions/` 配下に配置（動的生成）
2. 共通パーツ（iPhoneフレーム等）は `remotion/src/shared/` から import
3. ユーザー商品のUIコンポーネントは `products/<name>/components/` から相対importで参照
4. Tailwindを使う場合、Remotionのpostcssセットアップを `remotion.config.ts` で有効化
5. フレームレートは `config.yaml` の `fps` に従う（デフォルト30）
6. `npx remotion still` でフレーム出力する際は、`--output` で明示的にパス指定
7. **Remotion固有のAPI使用方法（useCurrentFrame、interpolate、Sequence、Composition等）は `remotion-best-practices` Skill のルールに従う**
8. Remotion本体のソースコードをリポジトリにコピー・改変しない（ライセンス上の再配布禁止に抵触するため）

---

## エラーハンドリング方針

### Skill実行中のエラー分類

| 分類 | 対応 |
|------|------|
| 設定ファイル不正（YAMLパースエラー等） | 即座に停止、ユーザーに通知 |
| `components/` が空 | Skill A実行を促して停止 |
| Remotionレンダリングエラー（1本分） | その動画はスキップ、`issues.json`に記録、続行 |
| 視覚検証で問題検出 | 修正ループ（最大3回）→解決しなければスキップ |
| Claude Codeトークン切れ | プロセス終了、外側のスケジューラに任せる |
| 公式Skillが未インストール | 起動時に検知し、インストール手順を提示して停止 |

### ログ出力

- 全Skill実行は `logs/<timestamp>.log` にstream-json形式で記録
- エラーは標準エラー出力にも複製
- `manifest.json` の `validation` フィールドに各動画の結果を集約

---

## 拡張性の考慮

### 将来的に追加されうる要素（**本MVPスコープ外**）

- Higgsfield MCP連携（実動画生成）
- 配信レイヤー（GitHub / S3 / TikTok / Instagram API 等）
- 管理画面連携（Supabase等）
- 完全自動化トグル（承認スキップ）
- 商品ごとの並列実行制御
- A/Bテスト用のバリアント自動分割

### 配信レイヤー拡張時の構造（参考・MVP実装外）

将来的に配信機能を追加する場合、**既存の2Skillを変更せず、独立Skillとして追加する**方針を推奨：

```
adcraft/
├── skills/
│   ├── extract-product-ui/         # 既存（変更なし）
│   ├── create-advertisement/       # 既存（変更なし）
│   └── publish-advertisement/      # 将来追加
│       ├── SKILL.md
│       └── adapters/
│           ├── github.ts
│           ├── s3.ts
│           ├── tiktok.ts
│           └── instagram.ts
```

`config.yaml` には optional な `publish:` セクションを後方互換で追加可能。配信不要なユーザーには影響しない設計。

この方針が成立する根拠：
- `output/` ディレクトリと `manifest.json` が中立なハンドオフポイントとして機能する
- 生成と配信が完全に疎結合
- 各Skillの単一責任原則が維持される

**繰り返しますが、これはあくまで参考情報であり、本MVPでは実装しません。**

### 拡張時に守るべき設計原則

1. `rules/` の追加ファイル化は許容（複数ルールセットの共存）
2. Skill自体を増やすことで機能拡張（既存Skillを肥大化させない）
3. `config.yaml` のスキーマ追加は後方互換を保つ（必須フィールド追加禁止、optional追加のみ）
4. `output/` の構造変更時は `manifest.json` のバージョン管理を導入
5. **配信レイヤーは独立Skillとして実装する**（本Skillに混ぜない）。`output/` を入力にして配信先に送る Skill を別途用意する形が望ましい