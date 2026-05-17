---
date: 2026-05-16
topic: create-advertisement-with-higgsfield
status: design (approved)
author: kota-suzuki (with Claude Opus 4.7)
related:
  - skills/create-advertisement/SKILL.md
  - rules/create-advertisement-rules.md
---

# create-advertisement-with-higgsfield — Design Spec

## Overview

既存の `create-advertisement` skill を補完する新しい skill。Higgsfield MCP（GPT Image 2 + Seedance 2.0）で実写級の画像/動画を生成し、ElevenLabs MCP でナレーションを生成、Remotion で時系列合成して MP4 を出力する。

既存skillと完全に併存し、ファイル衝突しない設計。

## Goals

1. **Higgsfield 統合**: 公式リモートMCP (`https://mcp.higgsfield.ai/mcp`) を介して GPT Image 2 と Seedance 2.0 を呼び出し、生成AIによる高品質な広告素材を作る
2. **音声統合**: ElevenLabs 公式 MCP でナレーションを自動生成し、BGM（手動配置）と合わせて完成された動画にする
3. **既存資産の流用**: `lib/manifest.ts`、`lib/validators.ts`、`remotion/src/shared/*`、`output/<product>/<date>/` のファイル構造を最大限再利用
4. **コスト燃焼防止**: 1run あたり $10 のハード上限を絶対遵守、超過予測時は即 abort
5. **観測可能性**: 成功・失敗・abort いずれの終了でも、課金内訳と検証ログを構造化ファイルとして残す

## Non-Goals

- 既存 `create-advertisement` skill の変更や置換
- 複数本同時生成（MVP は 1 本）
- 並列実行（レート制限が公式非公開のため直列固定）
- BGM の自動生成（手動配置運用）
- 配信処理（git push / SNS API / Slack 通知等。既存 R10 を継承）
- 動画再生成（コスト爆発防止のため 1 発主義。NG 時は静止画フォールバック）

## MVP Scope（合意済）

| 項目 | 値 |
|---|---|
| 本数 | 1 本 |
| 動画長 | 20 秒 |
| カット数 | 4（1 カット平均 5 秒） |
| アスペクト比 | 9:16（1080×1920、reel 想定） |
| 画像生成 | GPT Image 2（Higgsfield MCP） |
| 動画生成 | Seedance 2.0（Higgsfield MCP） |
| ナレーション | ElevenLabs MCP |
| BGM | 手動配置 (`products/<name>/assets/bgm/*.mp3`) |
| コスト上限 | 1run $10、safety margin 0.95（実停止は $9.50） |
| 想定コスト | $2.3〜5/本（検証込で $3〜6） |

## §1. Architecture

### Skill 構成

新規追加：

- `skills/create-advertisement-with-higgsfield/SKILL.md` — 素材生成オーケストレータ
- `rules/create-advertisement-with-higgsfield-rules.md` — R-H1〜R-H13 の不変ルール（既存 R1-R13 と独立、versioning 別系統 `higgsfield_rules_version`）

### 既存 skill との関係

新 skill は**既存 `create-advertisement` を呼び出さない**。Remotion `.tsx` を直接書く責務は新 skill 側で持つ（生成素材を組み込む `.tsx` は構造が違うため）。

代わりに `lib/` の共通ヘルパーを共用：

- `lib/manifest.ts`（atomic write、既存 R9 相当）
- `lib/validators.ts`（VISUAL_CHECKLIST + 新規 `HIGGSFIELD_IMAGE_CHECKLIST` を追加）
- `lib/remotion-helpers.ts`（FORMAT_PRESETS）
- `lib/cost-tracker.ts`（**新規**、Cost Tracker / 単価テーブル / abort 判定ユーティリティ）
- `remotion/src/shared/*`（`IPhoneFrame`、`TextOverlay`、`transitions`）

### ファイル配置

```
adcraft/
├── skills/
│   ├── create-advertisement/                          # 既存（触らない）
│   ├── create-advertisement-with-higgsfield/          # 新規
│   │   ├── SKILL.md
│   │   └── scripts/                                   # 必要なら helper
│   └── extract-product-ui/                            # 既存
├── rules/
│   ├── create-advertisement-rules.md                  # 既存
│   └── create-advertisement-with-higgsfield-rules.md  # 新規
├── lib/
│   └── validators.ts                                  # HIGGSFIELD_IMAGE_CHECKLIST 追記
├── products/<name>/
│   ├── core.md
│   ├── config.yaml                                    # higgsfield: セクション追加
│   ├── components/                                    # 任意
│   └── assets/                                        # 新規
│       ├── reference/                                 # 商品リファレンス画像
│       └── bgm/                                       # 手動配置 BGM
├── output/<product>/<YYYY-MM-DD>/
│   ├── .assets/<id>/                                  # 中間素材
│   │   ├── shot-plan.yaml                             # ショット計画
│   │   ├── shot-0.png .. shot-3.png                   # GPT Image 2 出力
│   │   ├── shot-0.mp4 .. shot-3.mp4                   # Seedance 2.0 出力（fallback時なし）
│   │   ├── narration.mp3                              # ElevenLabs 出力
│   │   └── assets-manifest.json                       # モデルID・URLキャッシュ
│   ├── <id>.tsx
│   ├── <id>.mp4
│   ├── <id>.preview.png
│   ├── <id>.validation.json
│   ├── <id>.md
│   ├── manifest.json
│   ├── issues.json
│   └── cost-report.json                               # ★新規
└── .gitignore                                         # output/**/.assets/ 追加
```

### MCP 接続前提

- Higgsfield 公式 MCP: `https://mcp.higgsfield.ai/mcp`（OAuth, Higgsfield Team plan 以上）
- ElevenLabs 公式 MCP（APIキー必要）
- どちらも未接続なら skill 起動時に `claude mcp add` 手順を案内して停止（R-H1）

## §2. 処理フロー & Data Flow

### Step 0. ルール読み込み + MCP 疎通確認 (R-H1)

1. `rules/create-advertisement-with-higgsfield-rules.md` を Read
2. Higgsfield MCP の `list_models()` を呼ぶ → 200 OK & モデル 1 個以上
3. ElevenLabs MCP の lightweight call → 200 OK
4. `products/<name>/assets/reference/*.{png,jpg,jpeg,webp}` が 1 枚以上存在
5. `products/<name>/assets/bgm/*` が 1 枚以上存在（`bgm.required: true` のとき）
6. どれか失敗なら停止、明確な reason を stdout

### Step 1. 商品設定読み込み + 整合性チェック (R-H11)

- `products/<name>/core.md` 読み込み（placeholder のままなら停止）
- `products/<name>/config.yaml` 読み込み、`higgsfield:` セクションを parse
- formats.reel.enabled == true & count >= 1 を確認

### Step 2. モデル ID 動的解決 + cost guard 初期化 (R-H2, R-H6)

```ts
const models = await list_models();
const image_model_id = pickByPreference(
  models, cfg.higgsfield.image.model_preference
); // 例: ["gpt-image-2", "nano-banana-2"]
const video_model_id = pickByPreference(
  models, cfg.higgsfield.video.model_preference
); // 例: ["seedance2", "seedance2-fast"]

const cost_tracker = {
  spent_usd: 0,
  reserved_usd: 0,
  limit_usd: cfg.higgsfield.cost_limit_usd ?? 10.00,
  safety_margin: cfg.higgsfield.cost_safety_margin ?? 0.95,
  aborted: false,
  history: [],
};
```

選択結果は `.assets/<id>/assets-manifest.json` にキャッシュ。

### Step 3. ショット計画

Claude が `core.md` から 4 カット構成を立案：

```yaml
# .assets/<id>/shot-plan.yaml
video_id: taskflow-hf-reel-1
total_duration_sec: 20
shots:
  - index: 0
    duration_sec: 5
    purpose: hook
    visual_prompt: "..."          # GPT Image 2 用
    motion_prompt: "..."          # Seedance 2.0 用
    narration_text: "..."         # ElevenLabs 用（空文字でナレーションなし可）
  - index: 1
    duration_sec: 5
    purpose: problem
    ...
  - index: 2
    duration_sec: 5
    purpose: solution_reveal
    ...
  - index: 3
    duration_sec: 5
    purpose: cta
    ...
```

### Step 4. 商品リファレンス画像 upload (R-H3)

- `products/<name>/assets/reference/*.{png,jpg,jpeg,webp}` を `upload_image()` でホスト
- 返却 URL を `assets-manifest.json` にキャッシュ
- 以降の全 `generate_image()` でこの URL を参照に渡す

### Step 5. 画像生成ループ（カット単位、直列、検証含む）(R-H4, R-H7, R-H8)

各カット index 0〜3 について：

1. `cost_tracker` チェック：次の generate_image + generate_video 予測コストで超過するか
2. 超過なら abort → 生成済カットだけで Step 8 へ進む
3. `generate_image(model_id, prompt, reference_url)` → request_id
4. `subscribe(request_id)` で完了待ち（タイムアウト 3 分）
5. 画像 URL ダウンロード → `.assets/<id>/shot-N.png` 保存
6. Claude が PNG を Read tool で読み、`HIGGSFIELD_IMAGE_CHECKLIST` で判定
7. NG なら最大 2 回まで `generate_image` リトライ（プロンプト微調整）
8. 3 回 NG ならそのカットをスキップ、issues.json 記録、次カットへ（動画化もしない）
9. 成功時 `cost_tracker.history` に追記、`spent_usd` 加算

### Step 6. 動画生成ループ（カット単位、1発主義）(R-H4, R-H5)

画像 OK だったカットだけ：

1. `cost_tracker` チェック
2. `generate_video(model_id, image_url=uploaded_shot_N, prompt=motion_prompt, duration=5)`
3. `subscribe()` で完了待ち
4. ダウンロード → `.assets/<id>/shot-N.mp4`
5. 動画 NG（state=failed / state=nsfw / 致命的破綻）時は**静止画フォールバック**：
   - mp4 を書かず、issues.json に `type: "video_fallback_to_image"` を info で記録
   - 後の Step 8 で `<Img src=shot-N.png>` + `<ZoomIn>` を使う
6. cost_tracker 加算

### Step 7. ナレーション TTS 生成（ElevenLabs、Step 5/6 と並列実行可）(R-H7)

1. 全カットの `narration_text` を結合 → 全体スクリプト作成
2. ElevenLabs MCP の TTS ツールに渡す（voice_id, model_id は config から）
3. mp3 ダウンロード → `.assets/<id>/narration.mp3`
4. TTS 失敗時は無音で続行、issues 記録

### Step 8. Remotion `.tsx` 生成

Claude が `output/<product>/<date>/<id>.tsx` を直接書く：

```tsx
import {AbsoluteFill, Audio, Sequence, Video, Img, staticFile} from "remotion";
import {ZoomIn} from "../../remotion/src/shared/transitions";
import {TextOverlay} from "../../remotion/src/shared/TextOverlay";

export const TaskflowHfReel1 = () => (
  <AbsoluteFill>
    {/* BGM: 全期間 */}
    <Audio src={staticFile("assets/bgm/energetic-01.mp3")} volume={0.2} />
    {/* ナレーション */}
    <Audio src={staticFile(".assets/taskflow-hf-reel-1/narration.mp3")} />
    {/* カット0: 0〜5sec */}
    <Sequence from={0} durationInFrames={150}>
      <Video src={staticFile(".assets/taskflow-hf-reel-1/shot-0.mp4")} />
      <TextOverlay text="..." startAt={15} endAt={120} />
    </Sequence>
    {/* カット2: 静止画フォールバック例 */}
    <Sequence from={300} durationInFrames={150}>
      <ZoomIn>
        <Img src={staticFile(".assets/taskflow-hf-reel-1/shot-2.png")} />
      </ZoomIn>
    </Sequence>
    {/* ... */}
  </AbsoluteFill>
);
```

`remotion/src/Root.tsx` に Composition を登録（id 命名規則 R-H13）。

### Step 9. 既存 R7 検証ループ + render（流用）

- `pnpm exec remotion still <entry> <id> <png>` で 3 フレーム抽出
- Claude が PNG を Read tool で視覚チェック（既存 VISUAL_CHECKLIST）
- `pnpm exec tsc --noEmit` で型チェック
- 問題あれば `.tsx` 修正（**素材は再生成しない、合成だけ調整**）→ 最大 3 回
- OK なら `pnpm exec remotion render` で MP4 出力

### Step 10. 投稿コピー(.md) + manifest + cost-report (R-H10, R-H12)

- R13 流用で `<id>.md` 生成
- `manifest.json` atomic write（`engine: "higgsfield"`、`cost.*`、各 `models_used` 記載）
- `cost-report.json` atomic write
- 中間素材 `.assets/<id>/` は basic 残す（`strict_mode: true` 時のみ削除）
- `.gitignore` に `output/**/.assets/` を追加

### Data Flow 図

```
core.md + config.yaml + reference 画像 + BGM
    ↓
ショット計画 (.assets/<id>/shot-plan.yaml)
    ↓
upload_image → 商品参照 URL（一貫性保持用）
    ↓ ← (直列、レート制限対策)
[各カット: cost guard → generate_image → 検証3回 → 動画化 or skip → generate_video 1発 → fallback判定]
    ↓ (並列OK)
ElevenLabs TTS → narration.mp3
    ↓ ← (合流)
.tsx 生成（生成素材 + 既存 shared/）
    ↓
既存R7ループ: still → 視覚チェック → tsc → 修正最大3回 → render
    ↓
.mp4 + .preview.png + .validation.json + .md + manifest.json + cost-report.json + issues.json
```

## §3. 検証 & Cost Guard & Error Handling

### 3.1 二段構え検証

| 段階 | 対象 | 観点 | リトライ | 失敗時 |
|---|---|---|---|---|
| A. 画像段階（厳格） | GPT Image 2 出力 PNG | 商品再現性 / 構図 / テキスト / NSFW / 破綻 | 初回 + リトライ最大2回（合計3回まで） | 動画化中止、issues 記録 |
| B. 動画段階（軽量） | Seedance 2.0 出力 MP4 | 致命的破綻のみ（途中切れ / 黒画面 / 1秒未満等） | **なし（1発主義）** | 静止画フォールバック |
| C. 合成段階（既存R7） | Remotion render 前 still 3 枚 | レイアウト / テロップ / iPhone枠 / z-index | `.tsx` 調整 最大3回 | 動画スキップ → issues |

### 3.2 画像検証チェックリスト

`lib/validators.ts` に追加：

```ts
export const HIGGSFIELD_IMAGE_CHECKLIST = {
  product_consistency: "商品が参照画像と同一に見える（色・形・ロゴ）",
  composition: "構図が motion_prompt と矛盾しない（後の動きが破綻しない）",
  text_legibility: "焼き込みテキストがある場合、読める / 誤字なし",
  no_nsfw_false_positive: "NSFW判定で返ってきていない（state != nsfw）",
  no_anatomical_break: "手足・指・顔の破綻がない（人物カットのみ）",
  brand_safety: "core.md の「避けたい表現」と矛盾しない",
};
```

判定は Claude が PNG を Read tool で読み構造化判定。`severity: "error" | "warning"`。

### 3.3 動画フォールバック

動画 NG 時：
- `<Video>` を `<Img>` + `<ZoomIn>`（Ken Burns 効果）に置換
- issues.json に `video_fallback_to_image` を info で記録（致命的扱いでない）
- 動画再生成しない（コスト爆発防止）

### 3.4 Cost Guard

#### 単価テーブル（fallback、`list_models()` が pricing を返すならそちら優先）

```ts
export const HIGGSFIELD_PRICING = {
  "gpt-image-2":    { per_image_usd: 0.08 },
  "seedance2":      { per_second_usd: 0.10 },
  "seedance2-fast": { per_second_usd: 0.05 },
};
export const ELEVENLABS_PRICING = {
  per_1000_chars_usd: 0.30,
};
```

#### Cost tracker

```ts
type CostTracker = {
  spent_usd: number;       // 成功した呼び出しの累計
  reserved_usd: number;    // 進行中の予約分
  limit_usd: number;       // config から
  safety_margin: number;   // 0.95
  aborted: boolean;
  history: Array<{
    ts: string; step: string; shot_index?: number;
    model: string; cost_usd: number; spent_running_usd: number;
    request_id?: string;
  }>;
};
```

#### Abort 判定

```
predicted = spent_usd + reserved_usd + next_call_cost
if (predicted > limit_usd * safety_margin) {
  cost_tracker.aborted = true;
  log issues.json: { type: "cost_limit_reached", at_step, at_shot, predicted_cost }
  生成済カットだけで Step 8 へ → 部分成果で render 試行
}
```

headless 時もユーザー確認なしで即 abort。

### 3.5 リトライ & Backoff（HTTP/MCP エラー）

| エラー | 挙動 |
|---|---|
| `state: queued` / `in_progress` | `subscribe()` long-poll、タイムアウト 3 分 |
| `state: failed` | 1 回だけ即時リトライ、再 failed ならスキップ |
| `state: nsfw` | プロンプト微調整 1 回だけリトライ |
| HTTP 429 | 指数 backoff: 5s → 15s → 45s → 諦め |
| HTTP 5xx | 指数 backoff: 2s → 6s → 18s → 諦め |
| OAuth トークン切れ | 即停止、再ログイン案内 |
| ElevenLabs 失敗 | 無音で続行、issues 記録 |

リトライ回数も cost_tracker に加算（呼び出し成功時のみ）。

### 3.6 並列実行ポリシー

MVP は直列。例外として ElevenLabs TTS は画像/動画生成と並列可。`config.yaml.higgsfield.parallel: false`（デフォルト）。

### 3.7 部分成果物の保護

- 各カット成功時に即 `.assets/<id>/shot-N.*` を永続化
- abort / crash 時もそこまでの素材は残す
- `manifest.json` は atomic write
- `.tsx` / `.mp4` の中途半端な状態は cleanup

### 3.8 エラーハンドリング一覧

| 状況 | 対応 |
|---|---|
| Higgsfield MCP 未接続 | 起動時停止、`claude mcp add` 案内 |
| ElevenLabs MCP 未接続 | 起動時停止 |
| `assets/reference/` 空 | 停止、画像配置案内 |
| `assets/bgm/` 空 + `bgm.required: true` | 停止、BGM 配置案内 |
| 画像 3 回 NG | カット動画化中止、issues 記録、次カットへ |
| 動画 1 発 NG | 静止画フォールバック、issues 記録、続行 |
| TTS 失敗 | 無音で続行、issues 記録 |
| cost 上限到達 | 即 abort、生成済カットで合成試行 |
| Remotion R7 検証 3 回 NG | 動画スキップ（既存 R8） |
| Claude Code トークン切れ | プロセス終了、外側スケジューラに任せる |

### 3.9 出力ファイルスキーマ

**`manifest.json`**

```json
{
  "product": "taskflow",
  "generated_at": "2026-05-16T22:15:00+09:00",
  "rules_version": "1.0.0",
  "higgsfield_rules_version": "1.0.0",
  "engine": "higgsfield",
  "cost": {
    "limit_usd": 10.00,
    "spent_usd": 4.82,
    "aborted_by_cost": false
  },
  "items": [
    {
      "type": "reel",
      "id": "taskflow-hf-reel-1",
      "file": "taskflow-hf-reel-1.mp4",
      "preview": "taskflow-hf-reel-1.preview.png",
      "copy": "taskflow-hf-reel-1.md",
      "duration_sec": 20,
      "shots": 4,
      "models_used": {
        "image": "gpt-image-2",
        "video": "seedance2",
        "tts": "elevenlabs:eleven_turbo_v2_5"
      },
      "validation": {
        "passed": true,
        "iterations": 1,
        "image_iterations": [1, 1, 2, 1],
        "video_fallbacks": [],
        "issues": []
      },
      "variation_note": "..."
    }
  ]
}
```

**`issues.json`**

```json
{
  "items": [
    {
      "id": "taskflow-hf-reel-1",
      "shot_index": 2,
      "type": "image_validation_failed",
      "iteration": 3,
      "reason": "product_consistency",
      "issues": ["商品ロゴの色が参照画像と異なる"]
    },
    {
      "id": "taskflow-hf-reel-1",
      "shot_index": 2,
      "type": "video_fallback_to_image",
      "reason": "video generation skipped because image failed"
    }
  ]
}
```

**`<id>.validation.json`**

```json
{
  "id": "taskflow-hf-reel-1",
  "iteration": 1,
  "image_stage": [
    {
      "shot_index": 0,
      "iterations": 1,
      "passed": true,
      "checks": { "product_consistency": "pass", "composition": "pass" }
    }
  ],
  "video_stage": [
    { "shot_index": 0, "passed": true, "duration_sec": 5.0 }
  ],
  "compose_stage": [
    { "frame_label": "start", "frame_index": 0, "passed": true, "issues": [] }
  ],
  "overall": { "passed": true, "image_skips": 1, "video_fallbacks": 1, "iterations": 1 }
}
```

**`cost-report.json`**

```json
{
  "limit_usd": 10.00,
  "spent_usd": 4.82,
  "aborted_by_cost": false,
  "session_started_at": "2026-05-16T22:00:00+09:00",
  "session_ended_at":   "2026-05-16T22:15:00+09:00",
  "by_provider": {
    "higgsfield": 4.50,
    "elevenlabs": 0.32
  },
  "history": [
    {
      "ts": "2026-05-16T22:01:12+09:00",
      "step": "generate_image",
      "shot_index": 0,
      "model": "gpt-image-2",
      "request_id": "req_xxx",
      "cost_usd": 0.08,
      "spent_running_usd": 0.08
    }
  ]
}
```

### 3.10 stdout 終了サマリ

```
✅ create-advertisement-with-higgsfield 完了

product:    taskflow
output:     output/taskflow/2026-05-16/
duration:   15分23秒
cost:       $4.82 / $10.00 (48%)

動画:
  ✅ taskflow-hf-reel-1.mp4 (20秒, 4カット, validation pass)
     ※ shot[2] は商品再現性NGで静止画fallback

issues:     2件（image_validation_failed×1, video_fallback_to_image×1）
詳細:       output/taskflow/2026-05-16/{manifest,issues,cost-report}.json
```

## §4. R-H ルール（不変ルール）

`rules/create-advertisement-with-higgsfield-rules.md` に書く。`higgsfield_rules_version: 1.0.0`。

### R-H1. MCP 疎通確認（起動時）

skill 起動時に Higgsfield MCP `list_models()` / ElevenLabs MCP lightweight call / リファレンス画像 / BGM の存在を確認。1 つでも失敗で停止。

### R-H2. モデル ID は動的解決、ハードコード禁止

`list_models()` 結果から `config.yaml.higgsfield.{image,video}.model_preference` 順で照合。全モデル不在なら停止。結果は `.assets/<id>/assets-manifest.json` にキャッシュ。

### R-H3. 商品リファレンス画像の一貫性参照

skill 起動後最初に `upload_image()` でホスト、全 `generate_image()` で同じ参照 URL を渡す。複数なら全 upload。

### R-H4. 画像段階は厳格 / 動画段階は 1 発主義

| 段階 | リトライ予算 | 失敗時 |
|---|---|---|
| 画像 | 初回 + リトライ最大 2 回（合計 3 回まで） | 動画化中止、次カット |
| 動画 | 1 回のみ | 静止画フォールバック（R-H5） |
| 合成 | 既存 R7 踏襲、最大 3 回 | スキップ（R8） |

`one_shot: false` のときのみ動画再生成許容（明示オプトイン）。

### R-H5. 動画 NG 時の静止画フォールバック

`<Video>` を `<Img>` + `<ZoomIn>` に置換。`issues.json` に `video_fallback_to_image` を info で記録。これは許容済み挙動。

### R-H6. コスト上限の絶対遵守

`cost_tracker.limit_usd` を `config.yaml.higgsfield.cost_limit_usd`（デフォルト $10）に反映。各呼び出し前に予測判定：

```
if (spent_usd + reserved_usd + next_call_cost > limit_usd * safety_margin) → abort
```

`safety_margin` デフォルト 0.95。abort 時：

- issues.json に `cost_limit_reached`（at_step / at_shot / predicted_cost）
- 生成済カットだけで最終 Remotion 合成を試行
- 全カット未着なら manifest を items 空で書いて終了
- headless 時もユーザー確認なしで即 abort

### R-H7. 直列実行

同一カット内: 画像 → 動画は直列。カット間も直列。例外として ElevenLabs TTS は画像/動画生成と並列 OK。`config.yaml.higgsfield.parallel: false`（デフォルト）。

### R-H8. エラーバックオフ

- HTTP 429 → `5s → 15s → 45s` 後諦め
- HTTP 5xx → `2s → 6s → 18s` 後諦め
- `subscribe()` long-poll タイムアウト 3 分
- バックオフ中の wait は cost_tracker 非加算（呼び出し成功時のみ加算）

### R-H9. 中間素材の永続化 & クリーンアップ

`.assets/<id>/` に shot-plan.yaml / shot-N.png / shot-N.mp4 / narration.mp3 / assets-manifest.json を保存。abort / crash 時も残す。`strict_mode: true` のときのみ最終 render 後に削除。`.gitignore` に `output/**/.assets/` を追加。

### R-H10. cost-report.json は必ず出力

成功 / 失敗 / abort いずれでも `cost-report.json` を atomic write。`by_provider` と `history` 配列、`aborted_by_cost` フラグ含む。ユーザーの課金検証用証跡。

### R-H11. 既存 R10/R11/R12 を継承

- **R10（配信責務外）**: そのまま継承
- **R11（整合性チェック）**: core.md placeholder / config 不正 / formats 全 false / **assets/reference 空 / assets/bgm 空** を追加
- **R12（headless 時のユーザー確認スキップ）**: そのまま継承

### R-H12. 投稿コピー(R13)の継承

`<id>.md`（フロントマター + フック + 本文 + ハッシュタグ 5 本）。違いは variation_note が「Higgsfield 版 / 生成 AI による差別化」を反映。

### R-H13. ファイル命名でエンジン識別

動画 ID 命名規則: `<product>-hf-<type>-<index>`（例: `taskflow-hf-reel-1`）。`-hf-` プレフィックスで既存 skill 出力（`taskflow-reel-1`）と衝突回避。Composition id も同じ命名。

## §5. config.yaml 拡張

```yaml
product_name: "TaskFlow"
description: "..."

formats:
  reel:
    enabled: true
    count: 1
    duration: 20
    aspect: "9:16"
    fps: 30

# ★新規セクション
higgsfield:
  enabled: true
  cost_limit_usd: 10.00
  cost_safety_margin: 0.95
  shots_per_video: 4
  shot_duration_sec: 5
  parallel: false
  image:
    model_preference: ["gpt-image-2", "nano-banana-2"]
    max_iterations_per_shot: 3
  video:
    model_preference: ["seedance2", "seedance2-fast"]
    one_shot: true
    fallback_to_static: true
  tts:
    provider: "elevenlabs"
    voice_id: "21m00Tcm4TlvDq8ikWAM"
    model_id: "eleven_turbo_v2_5"
  bgm:
    required: true
    selection: "auto"

validation:
  max_iteration: 3
  check_frames: [0, "mid", "end"]
  strict_mode: false
```

## §6. 受入基準

1. `output/<product>/<date>/` に MP4 1 本、`.preview.png`、`.md`、`manifest.json`、`issues.json`、`cost-report.json` が揃う
2. `manifest.json` の `engine: "higgsfield"`、`cost.aborted_by_cost: false`（正常完了時）、各 `models_used` 記載
3. `pnpm exec tsc --noEmit` がエラーなく通る
4. 視覚チェック pass（または issues.json で明示的説明）
5. `cost.spent_usd ≤ cost.limit_usd`
6. `<id>.md` が R13 フォーマット準拠
7. 中間素材 `.assets/<id>/` に shot-plan.yaml / shot-N.png / shot-N.mp4（または fallback 記録）/ narration.mp3 が揃う

## §7. アンチパターン

- ❌ モデル ID をハードコードする
- ❌ 商品リファレンス画像なしで `generate_image` する
- ❌ 動画を複数回再生成する
- ❌ cost guard を無視 / `cost_limit_usd: 0` 等で実質無制限化を許容する
- ❌ 並列化でレート制限を踏み抜く
- ❌ `.assets/<id>/` を生成途中で削除する
- ❌ cost-report.json を出さずに終了する
- ❌ `state: nsfw` を握り潰して通す
- ❌ R10 違反（配信処理を「ついでに」実装）
- ❌ 既存 `create-advertisement` 出力ファイルと衝突する命名

## §8. Open Questions（実装時に詰める）

1. **モデル単価の取得**: `list_models()` が pricing を返すかどうか実機確認。返さないなら fallback table のメンテ運用を決める
2. **`upload_image` の TTL**: ホストされた参照画像 URL の有効期限。長期間 skill 走らせる場合の再 upload タイミング
3. **Remotion `<Video>` の Higgsfield 出力 URL 直参照可否**: ダウンロードせず URL 直参照できれば中間ファイル削減（ただし render 安定性を優先するならローカル保存推奨）
4. **NSFW 誤検知のリカバリプロンプト戦略**: 商品系で誤検知が多発するなら、プロンプトテンプレートの調整が必要
5. **複数本生成への拡張**: MVP 1 本が動いたあと、count: 3〜5 に増やす際の cost guard 設計（per-run vs per-video）

## §9. Implementation Plan への引き継ぎ

このスペックを `superpowers:writing-plans` skill に渡して実装計画を作る。実装は次の 6 ファイルが主：

1. `skills/create-advertisement-with-higgsfield/SKILL.md`（新規、メイン skill 定義）
2. `rules/create-advertisement-with-higgsfield-rules.md`（新規、R-H1〜R-H13）
3. `lib/validators.ts`（HIGGSFIELD_IMAGE_CHECKLIST 追加）
4. `lib/cost-tracker.ts`（新規、Cost Tracker ユーティリティ）
5. `templates/config.yaml.template`（higgsfield: セクション追加）
6. `.gitignore`（`output/**/.assets/` 追加）

MVP 後の Phase 2 候補:

- 複数本生成（count > 1）
- 並列実行
- BGM 自動生成（Suno API 直叩き等）
- 別動画モデル（Sora 2 / Veo 3）への切り替えオプション
