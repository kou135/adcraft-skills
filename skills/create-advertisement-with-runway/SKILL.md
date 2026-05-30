---
name: create-advertisement-with-runway
description: products/<name>/ の core.md と config.yaml.runway: を入力に、Runway MCP (gpt_image_2 / gen4_image + seedance2 / gen4_turbo) で実写級の画像/動画を生成し、ElevenLabs MCP でナレーション TTS を作って Remotion で時系列合成、視覚検証ループを経て output/<product>/<YYYY-MM-DD>/ に MP4 等を配置する。MVPは1本/20秒/4カット/9:16。コスト上限 $10/run を絶対遵守。配信は責務外。トリガー例：「runway版で広告動画を作って」「create-advertisement-with-runway」「<商品名> をRunwayで生成」。
---

# create-advertisement-with-runway

商品ごとのマーケ方針（`core.md`）と機械設定（`config.yaml`）を入力に、Runway MCP と ElevenLabs MCP で素材を生成し、Remotion で合成する Skill。既存 `create-advertisement`（Skill B）/ `create-advertisement-with-higgsfield`（Skill C）と完全併存する。Skill C と同型のパイプラインで、生成バックエンドだけ Runway に差し替えたもの。

## 依存

このSkillは以下に依存する。**事前に確認**すること：

- **`remotion-dev/skills`（remotion-best-practices）**：Remotion API の正しい使い方を提供する公式 Skill。本 Skill は Remotion 固有の実装方法を**再定義しない**。
  - 未インストールの場合：`npx skills add remotion-dev/skills` を案内し停止。
- **Runway MCP**: `runwayml/runway-api-mcp-server`（ローカル stdio、Node.js）。clone + `npm install && npm run build` 後、`claude mcp add runway -e RUNWAYML_API_SECRET=<key> -e MCP_TOOL_TIMEOUT=1000000 -- node /abs/path/build/index.js`。`RUNWAYML_API_SECRET` は dev.runwayml.com で発行（最低 $10 チャージ要）。未接続なら停止し案内。
  - 公開 tool：`runway_generateImage` / `runway_generateVideo` / `runway_getTask` / `runway_cancelTask` / `runway_upscaleVideo` / `runway_editVideo` / `runway_getOrg`。**`list_models()` / balance tool は無い**（R-R2 / R-R6）。
- **ElevenLabs MCP**: 公式（APIキー要）。**auto モード時のみ必須**。未接続なら（auto 時）停止。
- **`lib/cost-tracker.ts`** / **`lib/runway-cost.ts`** / **`lib/runway-checklist.ts`**: 本skill実装で利用する内部ユーティリティ。
- **`rules/create-advertisement-with-runway-rules.md`**: 不変ルール（R-R1〜R-R19）。skill起動時に必ず読む。

## 実行モード

- **対話モード**：Claude Code UI から手動呼び出し。生成計画を立てたら実行前に確認を求める。
- **headless モード**：`claude -p "create-advertisement-with-runway で …"` から起動。`--permission-mode bypassPermissions` 前提で自動承認して進む。

R-R11（基底 `create-advertisement` の R12「headless 時のユーザー確認スキップ」を継承）により、プロンプトに `headless` / `自律実行` / `承認不要` / `auto` / `そのまま生成` 等のキーワード、または「最後まで」「停止せず」「全自動で」等の連続実行表現があれば、対話モードでも確認をスキップする。

## 入力

ユーザーが指定する：

1. **対象商品名**（1つ、MVPは複数同時不可）
2. （任意）特定フォーマット指定（MVPは `reel` のみ対応）
3. （任意）方向性指示（「クリーンめで」等、ショット計画に反映）

## 処理フロー

### Step 0. ルール読み込み（必須） — R-R1

1. `rules/create-advertisement-with-runway-rules.md` を Read で読み込む。R-R1〜R-R19 を**必ず適用**する。
2. Runway MCP の `runway_getOrg()` を呼ぶ → 200 OK & 組織情報（クレジット残高含む）を確認。失敗なら `MCP_NOT_CONNECTED:runway` で停止し、`claude mcp add runway …` 手順を案内。
3. `lib/runway-cost.ts` の `isPricingTablePopulated()` を呼ぶ → true を確認。false / import 不能なら `LIB_RUNWAY_COST_NOT_FOUND` で停止（model 解決・コスト算出の前提が壊れているため、R-R2）。
4. （auto モード時のみ）ElevenLabs MCP の lightweight call → 200 OK 確認。失敗なら停止。

### Step 1. 商品設定の読み込みと整合性チェック — R-R11, R-R14

各対象商品について：

1. `products/<name>/core.md` を読む（プレースホルダのままならエラー停止）。`## コンテンツカテゴリ` の category 一覧を抽出。
2. `products/<name>/config.yaml` を読む（`yaml` パッケージで parse）
   - `runway.enabled: true` でない場合は「`config.yaml.runway.enabled` を true にしてください」で停止
3. `products/<name>/assets/reference/*.{png,jpg,jpeg,webp}` が 1 枚以上 → なければ `REFERENCE_IMAGE_MISSING` で停止
   - **各 reference 画像が ≤16MB**（Runway base64 data URI 制約、R-R3）→ 超過は `REFERENCE_IMAGE_TOO_LARGE:{filename}` で停止し、リサイズ or 公開 URL での `uri` 指定を案内
4. **`products/<name>/assets/reference/index.md` が存在** → なければ `REFERENCE_INDEX_MISSING` で停止（R-R14）
5. **`assets/voice-spec/_index.md` と各 `{category}.md` が揃っている** → 欠落あれば `VOICE_SPEC_MISSING:{category}` で停止（R-R14）
6. **各 `{category}.md` に必須 6 セクション**（`Voice Persona` / `Tone Keywords` / `Pace Target` / `Prosody Patterns` / `Taboos` / `Recommended ElevenLabs Voices`）→ 欠落あれば `VOICE_SPEC_INCOMPLETE:{category}:{missing}` で停止
7. `assets/bgm/*.mp3` が 1 枚以上（`bgm.required: true` のとき）→ なければ `BGM_MISSING` で停止
8. `formats.reel.enabled == true && count >= 1` を確認
9. **R-R17 read-only 監視のため、`assets/voice-spec/` と `assets/reference/` 配下の全ファイル mtime を `assets_mtime_snapshot.json` に記録**

### Step 2. モデル ID 解決 + Cost Tracker 初期化 — R-R2, R-R6

Runway MCP に `list_models()` が無いため、**config preference から解決**し `lib/runway-cost.ts` の価格テーブル（既知モデル集合）で検証する：

```ts
import { createCostTracker } from "../../lib/cost-tracker";
import { isKnownImageModel, isKnownVideoModel } from "../../lib/runway-cost";

const image_model_id = cfg.runway.image.model_preference.find(isKnownImageModel);
const video_model_id = cfg.runway.video.model_preference.find(isKnownVideoModel);
// どちらも見つからなければ MODEL_NOT_KNOWN で停止

const cost_tracker = createCostTracker({
  limit_usd: cfg.runway.cost_limit_usd ?? 10.0,
  safety_margin: cfg.runway.cost_safety_margin ?? 0.95,
});
```

選択結果は後で `assets-manifest.json` にキャッシュする。model ID は literal を厳守（R-R19、`gen4.5` ドット / `gen4_image` アンダースコア）。

### Step 3. ショット計画 — R-R14, R-R19

`core.md` の訴求軸とブランドトーンから、Claude が 4 カット構成を立案：

- **variation_note の先頭に `[category/viewpoint]` の 2 階層タグを置く**（例：`[persona/observed] …`）。
  - `category` 無しは `MISSING_CATEGORY_TAG` で停止
  - `viewpoint` は `core.md` の各カテゴリ「視点パレット」リストの値のみ許可。省略時はパレット最上段（1st）を default 採用し `issues.json` に `viewpoint_defaulted` を info 記録。パレットに無い値は `INVALID_VIEWPOINT_TAG:{category}:{viewpoint}` で停止
- **過去 reel の viewpoint 履歴チェック（直近 N-1 件と重複禁止）**:
  - `output/<product>/*/manifest.json` を glob で全て読み、`items[].category` / `items[].viewpoint`（旧 manifest は `variation_note` の `[category/viewpoint]` から抽出）で `viewpoint_history[category]` を時系列降順に並べる
  - `N = 該当カテゴリ「視点パレット」リストの長さ`（現状 N=4）。`recent_set = slice(0, N-1)`（直近 3 件）
  - **`recent_set` に含まれない viewpoint だけを選択候補**にし、複数あれば訴求軸との適合度で 1 つ選ぶ
  - 違反時は `VIEWPOINT_REPETITION_TOO_RECENT:{category}:{viewpoint}:{distance}` で別候補を再選定（fail はしない）
- そのカテゴリの `assets/voice-spec/{category}.md` を**先に読み込んで** Voice Persona / Pace Target を頭に入れた状態で計画
- 各カットの `purpose` / `duration_sec` / `viewpoint` / `visual_prompt`（image モデル用）/ `motion_prompt`（video モデル用）/ `narration_text_ssml`（ElevenLabs 用、SSML 込み、R-R15）/ **`ratio`（R-R19、9:16 は `"720:1280"`）**
- **`duration_sec` は動画モデルの enum に合わせる**（gen4_turbo / gen4.5 / gen3a_turbo は `[5,10]`。既定 5）。enum 外なら近い値に丸め `issues.json` に `duration_rounded` を記録
- `narration_text_ssml` には **`<break>` と `<prosody>` を最低 1 個ずつ**含める（voice-spec の Prosody Patterns 準拠）
- 合計 duration が `formats.reel.duration` と一致するように
- R-R11 に従い、対話モードでは計画を提示してユーザー確認、headless ならそのまま実行

計画は `output/<product>/<date>/.assets/<id>/shot-plan.yaml` に保存（`category` / `viewpoint` / `ratio` を必ず含める）。

### Step 4. 商品リファレンス画像の準備 — R-R3

Runway は upload→URL 方式ではなく `referenceImages` 配列に直接渡す：

1. `products/<name>/assets/reference/*` を **base64 data URI**（`data:image/png;base64,...`、≤16MB）に変換、または公開 URL があればそれを使う
2. 各画像に `tag`（英数字）を付け、`assets-manifest.json` にキャッシュ
3. 以降の全 `runway_generateImage` で `referenceImages: [{ uri, tag }, ...]`（最大 3 枚）を渡し、`visual_prompt` 内で `@tag` 構文で参照する

### Step 5. 画像生成ループ（カット単位、直列） — R-R4, R-R6, R-R8, R-R9

各カット index 0..3 について：

1. **cost guard**：`shouldAbort(tracker, estimateRunwayImageCost(image_model_id))` を呼ぶ。true なら abort → Step 8 へジャンプ（生成済カットだけで合成試行）
2. `reserve(tracker, estimateRunwayImageCost(image_model_id), { step: "generate_image", model: image_model_id, shot_index, provider: "runway" })`
3. **pre-flight 検証（R-R19）**：`isValidRatio(ratio)` && `isKnownImageModel(image_model_id)` を確認（不正なら fail-fast）。OK なら `runway_generateImage({ model: image_model_id, promptText: visual_prompt, ratio, referenceImages })` → task
4. `runway_getTask(task_id)` を poll（≥5s 間隔 + jitter、タイムアウト 10 分）→ `SUCCEEDED` で出力 URL 取得
5. **即ダウンロード（R-R19、URL は 24h 失効）** → `output/<product>/<date>/.assets/<id>/shot-N.png`
6. **画像視覚チェック**：PNG を Read tool で読み、`RUNWAY_IMAGE_CHECKLIST`（`lib/runway-checklist.ts`）で構造化判定
7. 判定 OK なら `commit(tracker, task_id)`。NG なら `commit` した上で次の反復（最大 3 回 = 初回 + リトライ 2）
8. 3 回 NG → そのカットをスキップ、`issues.json` に `image_validation_failed` 記録、次カットへ
9. **エラー時**：HTTP 429 / `THROTTLED` は R-R8 のバックオフ、task `FAILED`（モデレーション等）はプロンプト微調整 1 回リトライ、それでも失敗なら `cancel(tracker)` してそのカットスキップ

### Step 6. 動画生成ループ（カット単位、1 発主義） — R-R4, R-R5, R-R19

画像 OK だったカットだけ：

> **Runway image_to_video の `duration` は固定 enum（gen4_turbo / gen4.5 は `[5,10]`）。`ratio` は pixel 文字列（9:16 = `"720:1280"`）。両方 literal を厳守（R-R19）。**
> seedance2 は 36 cr/s（5s≒$1.80）と高コスト。preference に `gen4_turbo`（5 cr/s, 5s=$0.25）を fallback として置く。

1. **cost guard**：`shouldAbort(tracker, estimateRunwayVideoCost(video_model_id, shot.duration_sec))`
2. `reserve(tracker, estimateRunwayVideoCost(video_model_id, shot.duration_sec), { step: "generate_video", model: video_model_id, shot_index, provider: "runway" })`
3. **pre-flight 検証（R-R19）**：`isValidRatio(ratio)` && `isKnownVideoModel(video_model_id)` を確認（不正なら fail-fast）。`duration = roundDuration(shot.duration_sec)`（enum `[5,10]`、丸め発生時は `issues.json` に `duration_rounded` 記録）。`runway_generateVideo({ model: video_model_id, promptImage: <shot-N.png の URL/data URI>, promptText: motion_prompt, ratio, duration })` → task
4. `runway_getTask(task_id)` を poll → `SUCCEEDED`
5. **即ダウンロード（R-R19）** → `.assets/<id>/shot-N.mp4`
6. **動画段階軽量検証**：致命的破綻のみ（途中切れ / 黒画面 / 1 秒未満）。NG なら：
   - preference に次の動画モデルがあれば 1 回試行（R-R5）。それも NG なら mp4 を残さず `issues.json` に `video_fallback_to_image` を info 記録 → Step 8 で `<Img src=shot-N.png>` + `<ZoomIn>`
7. `commit(tracker, task_id)`（成功時のみ）/ `cancel(tracker)`（致命破綻時のみ）

### Step 7. ナレーション TTS 生成（ElevenLabs、Step 5/6 と並列実行可）— R-R15, R-R18

> **R-R18: `config.yaml.runway.tts.enabled`（default `false`）で auto / lite モード切替**

#### lite モード（`tts.enabled: false`、デフォルト）

Step 7 全体を**スキップ**。`audio_mode: "manual"` を manifest に記録予約。voice-spec は Step 10 のナレーション台本生成のガイドとして引き続き読み込む（R-R14）。

#### auto モード（`tts.enabled: true`）

1. **事前検証**：`tts.voice_id` が空なら `TTS_VOICE_ID_MISSING` で fail-fast
2. **cost guard**：`shouldAbort(tracker, estimateTtsCost(全narration合計char数))`（`lib/cost-tracker.ts` の `estimateTtsCost` を流用、provider は `elevenlabs`）
3. **voice 選定**：voice-spec の `Recommended ElevenLabs Voices` 優先順。1st 不可なら 2nd → 3rd → fallback、選択理由を cost-report.json の `notes` に記録
4. **voice_settings** は voice-spec の「ElevenLabs voice_settings 推奨」から literal 取得（ハードコード禁止、R-R15）
5. **shot ごとに分割して TTS 呼び出し**：各 shot の `narration_text_ssml` を 1 呼び出し → `.assets/<id>/narration-N.mp3`
6. **shot 尺整合性チェック**（推奨）：mp3 duration が `shot_duration_sec` 超過なら `issues.json` に `narration_overflow:{shot_index}:{actual_sec}` を記録（fail はしない）
7. `reserve(..., { step: "tts", model: cfg.runway.tts.model_id, provider: "elevenlabs", shot_index })` を shot 単位で / `commit` を各 shot 成功時
8. **失敗時**：voice fallback を試す（R-R15）。それでも失敗なら `cancel(tracker)`、無音で続行、`issues.json` に `tts_failed:{shot_index}` 記録

### Step 7.5. ナレーションのポストマスター（ffmpeg、auto モードのみ） — R-R16, R-R18

> **lite モード（`tts.enabled: false`）のときは Step 7.5 全体をスキップ**

各 `narration-N.mp3`（raw）を mastered 化：

```bash
ffmpeg -i .assets/<id>/narration-N.mp3 -af "\
  highpass=f=85,\
  equalizer=f=2500:t=q:w=1.4:g=2,\
  acompressor=threshold=-18dB:ratio=3:attack=5:release=80,\
  loudnorm=I=-16:TP=-1.5:LRA=11\
" -y .assets/<id>/narration-N.mastered.mp3
```

1. `which ffmpeg` で存在確認。なければ `POST_MASTER_TOOL_MISSING` で fail
2. 各 shot にフィルタチェーンを適用（不変、R-R16）
3. raw / mastered の integrated LUFS を `cost-report.json.audio.shots[i]` に記録
4. 失敗時（exit ≠ 0）は `POST_MASTER_FAILED:{shot_index}` で fail。raw mp3 のまま Step 8 に進むのは禁止

### Step 8. Remotion `.tsx` 生成 — R-R13, R-R18

Claude が `output/<product>/<date>/<id>.tsx` を直接書く。命名は R-R13 に従い `<product>-rw-reel-<index>`（例：`taskflow-rw-reel-1`、Composition も同名）。

**`tts.enabled` / `bgm.required` の組合せで埋込内容を切り替え**:

| `tts.enabled` | `bgm.required` | 埋込内容 |
|---|---|---|
| `false` (lite) | `false` | 動画/静止画 + `<TextOverlay>` のみ。音声なし |
| `false` (lite) | `true` | 動画/静止画 + `<TextOverlay>` + BGM `<Audio>` |
| `true` (auto) | `false` | 動画/静止画 + `<TextOverlay>` + narration `<Audio>` |
| `true` (auto) | `true` | フル：動画 + テロップ + narration `<Audio>` + BGM `<Audio>` |

**ガード**:
- `tts.enabled: false` のとき narration `<Audio>` を埋め込んだら `LITE_MODE_VIOLATION:tts_called` で fail
- `bgm.required: false` のとき BGM `<Audio>` を埋め込んだら `LITE_MODE_VIOLATION:bgm_embedded` で fail

骨子（auto + BGM フル例。**Audio は必ず `.mastered.mp3` を参照、R-R16**）：

```tsx
import { AbsoluteFill, Audio, Sequence, Video, Img, staticFile } from "remotion";
import { ZoomIn } from "../../remotion/src/shared/transitions";
import { TextOverlay } from "../../remotion/src/shared/TextOverlay";

export const TaskflowRwReel1 = () => (
  <AbsoluteFill>
    <Audio src={staticFile("products/taskflow/assets/bgm/<chosen>.mp3")} volume={0.2} />
    <Sequence from={0} durationInFrames={150}>
      <Video src={staticFile("output/taskflow/2026-05-31/.assets/taskflow-rw-reel-1/shot-0.mp4")} />
      <Sequence from={5}>
        <Audio src={staticFile("output/taskflow/2026-05-31/.assets/taskflow-rw-reel-1/narration-0.mastered.mp3")} />
      </Sequence>
      <TextOverlay text="..." startAt={15} endAt={120} />
    </Sequence>
    {/* 静止画フォールバック例 */}
    <Sequence from={300} durationInFrames={150}>
      <ZoomIn>
        <Img src={staticFile("output/taskflow/2026-05-31/.assets/taskflow-rw-reel-1/shot-2.png")} />
      </ZoomIn>
    </Sequence>
  </AbsoluteFill>
);
```

ナレーション開始フレームは voice-spec のカテゴリ別ペース感に従う（worldview / persona は frame 5〜10 の早出し、feature は 15〜25）。

#### lite モード骨子例（`tts.enabled: false, bgm.required: false`）

```tsx
import { AbsoluteFill, Sequence, Video, Img, staticFile } from "remotion";
import { ZoomIn } from "../../remotion/src/shared/transitions";
import { TextOverlay } from "../../remotion/src/shared/TextOverlay";

export const TaskflowRwReel1 = () => (
  <AbsoluteFill>
    {/* BGM / narration は埋め込まない (lite mode) */}
    <Sequence from={0} durationInFrames={150}>
      <Video src={staticFile("output/taskflow/2026-05-31/.assets/taskflow-rw-reel-1/shot-0.mp4")} />
      <TextOverlay text="..." startAt={15} endAt={120} />
    </Sequence>
  </AbsoluteFill>
);
```

完成 MP4 は無音。視聴者向けには CapCut / Premiere 等で `.md` のナレーション台本を参考に手動で narration / BGM を当てる。

#### Symlink-safe rendering — `_generated_/` ミラーコピー（必須）

`output/` が symlink で別 repo に飛んでいる環境では Webpack の `resolve.symlinks: true` により相対 import が解決失敗する。**生成した `.tsx` を adcraft 内の固定パス `remotion/src/_generated_/<id>.tsx` にもコピー**し、import path を `_generated_/` 起点に書き換える：

```bash
mkdir -p remotion/src/_generated_
cp output/<product>/<date>/<id>.tsx remotion/src/_generated_/<id>.tsx
sed -i '' 's|\.\./\.\./\.\./remotion/src/shared/|../shared/|g' remotion/src/_generated_/<id>.tsx
```

`remotion/src/Root.tsx` への Composition 登録は**必ず `_generated_/` 経由で import**：

```tsx
import { TaskflowRwReel1 } from "./_generated_/taskflow-rw-reel-1";

<Composition
  id="taskflow-rw-reel-1"
  component={TaskflowRwReel1}
  durationInFrames={20 * 30}
  fps={30}
  width={1080}
  height={1920}
/>
```

オリジナル `output/<...>/<id>.tsx` は canonical な timeline 仕様として保持。検証 / render は必ず `_generated_/` 経由のエントリで行う。

> Remotion API の使い方は `remotion-dev/skills` のルールに従う。本 Skill 内で再定義しない。

### Step 9. 既存 R7 検証ループ + render

既存 `create-advertisement` パイプラインと同じ：

1. `pnpm exec remotion still <entry> <id> <png-path> --frame=N` で 3 フレーム抽出（0 / mid / end）
2. Claude が PNG を Read で視覚チェック（`VISUAL_CHECKLIST`、`lib/validators.ts`）
3. `pnpm exec tsc --noEmit` で型チェック
4. 問題あれば `.tsx` 修正（**素材は再生成しない、合成だけ調整**）→ 最大 3 回（`config.yaml.validation.max_iteration`）。修正は**オリジナルと `_generated_/` の両方**に反映
5. OK なら `pnpm exec remotion render <entry> <id> <output-mp4>`。`<entry>` は `_generated_/<id>` を import している Root.tsx に到達するもの
6. `<id>.preview.png` として frame 0 をコピー / `<id>.validation.json` に構造化結果を atomic write
7. render が `Module not found` で fail した場合は Step 8 の `_generated_/` ミラーコピー漏れ。存在と import path 書き換えを再確認

### Step 10. 投稿コピー + manifest + cost-report — R-R10, R-R12, R-R16, R-R17, R-R18

1. **投稿コピー（R-R12）**：`<id>.md` を生成（フロントマター + フック + 本文 + ハッシュタグ 5 本、`variation_note` 先頭に `[category]` タグ）。
   - **lite モード時は加えて「## ナレーション台本」セクションを必ず付ける**（R-R18）。shot 別に：シーン要約 / 想定テキスト / 想定発話時間 / 強調キーワード / SSML 例 / 推奨 voice / 推奨音量。末尾に CapCut / Premiere 組み立て手順。欠落時 `MISSING_NARRATION_SCRIPT` で fail
   - `lib/manifest.ts` の `writeManifestAtomic` と同じ atomic 書き込みを使う
2. **manifest.json**（atomic write）：`engine: "runway"`、`rules_version: "1.0.0"`、`runway_rules_version: "1.0.0"`、`cost.{limit_usd, spent_usd, aborted_by_cost}`、`items[].models_used` を含む。各 item に `category` / `viewpoint`（R-R14）/ `audio_mode`（R-R18）/ `bgm_embedded`（R-R18）/ `ratio`（R-R19）を追加
3. **cost-report.json**（atomic write）：`toReport(tracker, {session...}, { notes })` の戻り値に `audio.loudness`（auto 時のみ実数値、lite 時 null）を足す。**成功 / 失敗 / abort いずれでも必ず出力**（R-R10）。`notes` には「コストは `lib/runway-cost.ts` の価格表に基づく **client 側推定値**で、Runway 課金と一致しない場合あり。最終額は Runway billing で確認」+ 使用モデル / 適用クレジット単価を必ず明記（R-R6）
4. **issues.json**：途中で記録した issue がある場合のみ書く。R-R17 read-only 違反、R-R18 違反、R-R19 の `duration_rounded` 等もここに記録
5. **R-R17 read-only 監査**：Step 1 で記録した `assets_mtime_snapshot.json` を再チェック、変更されていれば `READ_ONLY_VIOLATION:{path}` を issues.json に記録（停止はしない）
6. **中間ファイル**：`.assets/<id>/` は basic 残す（auto では `narration-N.mp3` + `.mastered.mp3` 両方）。`strict_mode: true` のみ raw を削除

### Step 11. stdout 終了サマリ

```
✅ create-advertisement-with-runway 完了

product:    <name>
output:     output/<name>/<date>/
duration:   <分秒>
cost:       $<spent> / $<limit> (<%>)  ※ client 側推定

動画:
  ✅ <id>.mp4 (<duration>秒, <shots>カット, validation pass)
     ※ 必要なら shot[N] の fallback 等を併記

issues:     <件数>件
詳細:       output/<name>/<date>/{manifest,issues,cost-report}.json
```

## アンチパターン（やらないこと）

R-R に書かれた禁則に加えて：

- ❌ Composition id を `<product>-rw-` プレフィックスなしで作る（既存と衝突）
- ❌ `output/` の外にファイルを書く
- ❌ 視覚チェックなしで render する
- ❌ 1 カット失敗で全体停止する（次カットへ進む）
- ❌ 配信処理（git / gh / curl で SNS API、Slack 通知等）を追加する
- ❌ `core.md` を読まずに config だけで生成する
- ❌ Remotion 実装の細かい使い方を本 Skill 内で考え込む（→ remotion-best-practices に委譲）
- ❌ 生成物 URL を DL せず `.tsx` から直参照（24h 失効、R-R19）
- ❌ ratio に `"9:16"` を渡す（`"720:1280"`、R-R19）/ model ID に `gen4_5` を使う（`gen4.5`、R-R19）
- ❌ コストを balance tool から取ろうとする（存在しない。client 側算出、R-R6）
- ❌ `variation_note` の `[category]` タグ無しで進む（R-R14）
- ❌ プレーンテキスト narration を ElevenLabs に渡す（auto モードで必ず SSML、R-R15）
- ❌ raw mp3 を `.tsx` から直参照（必ず `.mastered.mp3`、R-R16）
- ❌ autonomous run 中に voice-spec / reference を書き換える（R-R17）
- ❌ `tts.enabled: false` で ElevenLabs MCP を呼ぶ（R-R18 lite モード違反）
- ❌ symlink 環境で Root.tsx から `output/<...>/<id>.tsx` を直接 import する（必ず `_generated_/` 経由）

## ヘッドレス実行コマンド（cron 用）

```bash
cd /path/to/adcraft && \
  unset ANTHROPIC_API_KEY && \
  claude -p "create-advertisement-with-runway skill で taskflow の動画を1本生成して。承認不要、最後まで自律実行して。" \
    --permission-mode bypassPermissions \
    --max-turns 200 \
    --output-format stream-json --verbose \
    >> logs/$(date +%Y%m%d-%H%M%S).log 2>&1
```

**ヘッドレス実行で詰まらないためのポイント**：
- `bypassPermissions` を使う（`acceptEdits` だと `pnpm exec remotion still` 等の Bash で止まる）
- プロンプトに「承認不要、自律実行して」等を含める（R-R11 のユーザー確認をスキップさせる）
- Runway MCP は **ローカル stdio + `RUNWAYML_API_SECRET`** なので headless で動く（hosted MCP の OAuth は cron 不可）
- `--output-format stream-json --verbose` で無音状態を回避

## エラーハンドリング

| 状況 | 対応 |
|---|---|
| Runway MCP 未接続 | 起動時停止、`claude mcp add runway …` 手順を案内 |
| `lib/runway-cost.ts` 不在 / 価格表が空 | `LIB_RUNWAY_COST_NOT_FOUND` で停止（R-R2）|
| reference 画像 > 16MB | `REFERENCE_IMAGE_TOO_LARGE:{filename}` で停止、リサイズ or 公開 URL を案内（R-R3）|
| ElevenLabs MCP 未接続（auto モード）| 起動時停止 |
| `core.md` がプレースホルダのまま | 停止、ユーザーに記入を促す |
| `config.yaml.runway.enabled: false` | 停止、有効化を案内 |
| `assets/reference/` 空 | 停止、商品画像配置を案内 |
| `assets/bgm/` 空 + `bgm.required: true` | 停止、BGM 配置を案内 |
| model preference が既知集合に無い | `MODEL_NOT_KNOWN` で停止（R-R2）|
| 画像 3 回 NG | カット動画化中止、`issues.json` 記録、次カットへ |
| 動画 NG | 次候補モデル 1 回 → 静止画フォールバック、`issues.json` 記録、続行（R-R5）|
| task `THROTTLED` / 429 | R-R8 バックオフ後リトライ |
| 生成物 URL 失効（24h 超）| 該当 task を再生成（cost guard 内で）。原則は SUCCEEDED 直後に DL して回避（R-R19）|
| TTS 失敗（auto）| voice fallback chain、すべて失敗なら無音続行 + 記録 |
| cost 上限到達 | 即 abort、生成済カットで合成試行 |
| Remotion R7 検証 3 回 NG | 動画スキップ（既存 R8）|
| Claude Code トークン切れ | プロセス終了、外側スケジューラに任せる |
| `output/` 書き込み権限なし | 即停止、ユーザー通知 |
