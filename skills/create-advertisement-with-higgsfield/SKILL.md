---
name: create-advertisement-with-higgsfield
description: products/<name>/ の core.md と config.yaml.higgsfield: を入力に、Higgsfield MCP (GPT Image 2 + Seedance 2.0) で実写級の画像/動画を生成し、ElevenLabs MCP でナレーション TTS を作って Remotion で時系列合成、視覚検証ループを経て output/<product>/<YYYY-MM-DD>/ に MP4 等を配置する。MVPは1本/20秒/4カット/9:16。コスト上限 $10/run を絶対遵守。配信は責務外。トリガー例：「higgsfield版で広告動画を作って」「create-advertisement-with-higgsfield」「<商品名> をHiggsfieldで生成」。
---

# create-advertisement-with-higgsfield

商品ごとのマーケ方針（`core.md`）と機械設定（`config.yaml`）を入力に、Higgsfield MCP と ElevenLabs MCP で素材を生成し、Remotion で合成する Skill。既存 `create-advertisement` と完全併存する。

## 依存

このSkillは以下に依存する。**事前に確認**すること：

- **`remotion-dev/skills`（remotion-best-practices）**：Remotion API（`useCurrentFrame`, `interpolate`, `Sequence`, `Composition` 等）の正しい使い方を提供する公式 Skill。本 Skill は Remotion 固有の実装方法を**再定義しない**。
  - 未インストールの場合：`npx skills add remotion-dev/skills` の実行を案内し、停止する。
- **Higgsfield MCP**: 公式リモートMCP `https://mcp.higgsfield.ai/mcp` (OAuth, Higgsfield Team plan以上)。未接続なら停止し `claude mcp add` 手順を案内。
- **ElevenLabs MCP**: 公式 (APIキー要)。未接続なら停止し案内。
- **`lib/cost-tracker.ts`** / **`lib/higgsfield-checklist.ts`**: 本skill実装で利用する内部ユーティリティ。
- **`rules/create-advertisement-with-higgsfield-rules.md`**: 不変ルール（R-H1〜R-H13）。skill起動時に必ず読む。

## 実行モード

- **対話モード**：Claude Code UI から手動呼び出し。生成計画を立てたら実行前に確認を求める。
- **headless モード**：`claude -p "create-advertisement-with-higgsfield で …"` から起動。`--permission-mode bypassPermissions` 前提で自動承認して進む。

R-H11（既存R12継承）により、プロンプトに `headless` / `自律実行` / `承認不要` / `auto` / `そのまま生成` 等のキーワード、または「最後まで」「停止せず」「全自動で」等の連続実行表現があれば、対話モードでも確認をスキップする。

## 入力

ユーザーが指定する：

1. **対象商品名**（1つ、MVPは複数同時不可）
2. （任意）特定フォーマット指定（MVPは `reel` のみ対応）
3. （任意）方向性指示（「クリーンめで」等、ショット計画に反映）

## 処理フロー

### Step 0. ルール読み込み（必須） — R-H1

1. `rules/create-advertisement-with-higgsfield-rules.md` を Read で読み込む。R-H1〜R-H13 を**必ず適用**する。
2. Higgsfield MCP の `list_models()` を呼ぶ → 200 OK & モデル ≥ 1 を確認。失敗なら `MCP_NOT_CONNECTED: higgsfield` で停止し、`claude mcp add` 手順を案内。
3. ElevenLabs MCP の lightweight call → 200 OK 確認。失敗なら停止。

### Step 1. 商品設定の読み込みと整合性チェック — R-H11, R-H14

各対象商品について：

1. `products/<name>/core.md` を読む（プレースホルダのままならエラー停止）。同時に `## コンテンツカテゴリ` セクションに列挙された category 一覧を抽出する
2. `products/<name>/config.yaml` を読む（`yaml` パッケージで parse）
   - `higgsfield.enabled: true` でない場合は「`config.yaml.higgsfield.enabled` を true にしてください」で停止
3. `products/<name>/assets/reference/*.{png,jpg,jpeg,webp}` が 1 枚以上あること → なければ `REFERENCE_IMAGE_MISSING` で停止
4. **`products/<name>/assets/reference/index.md` が存在すること** → なければ `REFERENCE_INDEX_MISSING` で停止（R-H14）
5. **`products/<name>/assets/voice-spec/_index.md` と core.md の category 一覧で定義された各 `{category}.md` が揃っていること** → 欠落あれば `VOICE_SPEC_MISSING:{category}` で停止（R-H14）
6. **各 `{category}.md` に必須 6 セクションが揃っていること**（`Voice Persona` / `Tone Keywords` / `Pace Target` / `Prosody Patterns` / `Taboos` / `Recommended ElevenLabs Voices`）→ 欠落あれば `VOICE_SPEC_INCOMPLETE:{category}:{missing}` で停止
7. `products/<name>/assets/bgm/*.mp3` が 1 枚以上あること（`bgm.required: true` のとき）→ なければ `BGM_MISSING` で停止
8. `formats.reel.enabled == true && count >= 1` を確認
9. **R-H17 read-only 監視のため、`assets/voice-spec/` と `assets/reference/` 配下の全ファイル mtime を `assets_mtime_snapshot.json` に記録**

### Step 2. モデル ID 動的解決 + Cost Tracker 初期化 — R-H2, R-H6

```ts
import { createCostTracker } from "../../lib/cost-tracker";

const models = await mcp.higgsfield.list_models();
const image_model_id = pickByPreference(models, cfg.higgsfield.image.model_preference);
const video_model_id = pickByPreference(models, cfg.higgsfield.video.model_preference);
// 全 preference に該当なしなら停止

const cost_tracker = createCostTracker({
  limit_usd: cfg.higgsfield.cost_limit_usd ?? 10.00,
  safety_margin: cfg.higgsfield.cost_safety_margin ?? 0.95,
});
```

選択結果は後で `assets-manifest.json` にキャッシュする。

### Step 3. ショット計画 — R-H14

`core.md` の訴求軸とブランドトーンから、Claude が 4 カット構成を立案：

- **variation_note の先頭に `[category]` タグを必ず置く**（例：`[worldview] Higgsfield 版…`）。タグ無しは `MISSING_CATEGORY_TAG` で停止
- そのカテゴリの `assets/voice-spec/{category}.md` をこの時点で**先に読み込んで** Voice Persona と Pace Target を頭に入れた状態でショット計画する
- 各カットの `purpose` / `duration_sec` / `visual_prompt`（GPT Image 2 用）/ `motion_prompt`（Seedance 用）/ `narration_text_ssml`（ElevenLabs 用、SSML 込み、R-H15）
- `narration_text_ssml` には **`<break>` と `<prosody>` を最低 1 個ずつ含める**（voice-spec の `Prosody Patterns` セクションの exemplar に従う）
- 合計 duration が `formats.reel.duration` と一致するように
- R-H11（R12継承）に従い、対話モードでは計画を提示してユーザー確認、headless ならそのまま実行

計画は `output/<product>/<YYYY-MM-DD>/.assets/<id>/shot-plan.yaml` に保存（`category` フィールドを必ず含める）。

### Step 4. 商品リファレンス画像の upload — R-H3

1. `products/<name>/assets/reference/*` を `upload_image()` でホスト
2. 返却 URL を `.assets/<id>/assets-manifest.json` にキャッシュ
3. 以降の全 `generate_image()` でこの URL を参照に渡す

### Step 5. 画像生成ループ（カット単位、直列） — R-H4, R-H7, R-H8

各カット index 0..3 について：

1. **cost guard**：`shouldAbort(tracker, next_call_cost)` を呼ぶ。true なら abort → Step 8 へジャンプ（生成済カットだけで合成試行）
2. `reserve(tracker, estimateImageCost(image_model_id), { step: "generate_image", model: image_model_id, shot_index, provider: "higgsfield" })`
3. `generate_image(model_id, prompt, reference_url)` → `request_id`
4. `subscribe(request_id)`（タイムアウト 3 分）→ 完了 URL 取得
5. 画像をダウンロード → `output/<product>/<date>/.assets/<id>/shot-N.png`
6. **画像視覚チェック**：PNG を Read tool で読み、`HIGGSFIELD_IMAGE_CHECKLIST`（`lib/higgsfield-checklist.ts`）で構造化判定
7. 判定 OK なら `commit(tracker, request_id)`。NG なら `commit` した上で次の反復へ（最大 3 回 = 初回 + リトライ 2）
8. 3 回 NG → そのカットをスキップ、`issues.json` に `image_validation_failed` 記録、次カットへ
9. **エラー時**：HTTP 429/5xx は R-H8 のバックオフ、`state: nsfw` はプロンプト微調整 1 回リトライ、`state: failed` は 1 回リトライ、それでも失敗なら `cancel(tracker)` してそのカットスキップ

### Step 6. 動画生成ループ（カット単位、1 発主義） — R-H4, R-H5

画像 OK だったカットだけ：

1. **cost guard**
2. `reserve(tracker, estimateVideoCost(video_model_id, shot.duration_sec), { step: "generate_video", model: video_model_id, shot_index, provider: "higgsfield" })`
3. `generate_video(model_id, image_url=uploaded_shot_N, prompt=motion_prompt, duration=shot.duration_sec)`
4. `subscribe()` → 完了
5. ダウンロード → `.assets/<id>/shot-N.mp4`
6. **動画段階軽量検証**：致命的破綻のみ（途中切れ / 黒画面 / 1 秒未満）。NG なら：
   - mp4 を残さず、`issues.json` に `video_fallback_to_image` を info で記録
   - Step 8 で `<Img src=shot-N.png>` + `<ZoomIn>` を使う
7. `commit(tracker, request_id)`（成功時のみ）/ `cancel(tracker)`（致命破綻時のみ）

### Step 7. ナレーション TTS 生成（ElevenLabs、Step 5/6 と並列実行可）— R-H7, R-H15, R-H18

> **R-H18: `config.yaml.higgsfield.tts.enabled` (default `false`) で auto / lite モード切替**

#### lite モード（`tts.enabled: false`、デフォルト）

Step 7 全体を **スキップ**。`audio_mode: "manual"` を manifest に記録予約。voice-spec は引き続き Step 10 のナレーション台本生成のガイドとして読み込む（R-H14 維持）。

#### auto モード（`tts.enabled: true`）

1. **事前検証**：`tts.voice_id` が空なら `TTS_VOICE_ID_MISSING` で fail-fast
2. **cost guard**：`shouldAbort(tracker, estimateTtsCost(全narration合計char数))`
3. **voice 選定**：voice-spec の `Recommended ElevenLabs Voices` の優先順位に従い、利用可能な最上位 voice を選択。402 paid_plan_required で 1st が使えなければ 2nd → 3rd → fallback と順に試行、選択結果と理由を cost-report.json の `notes` に記録
4. **voice_settings** は voice-spec の **「ElevenLabs voice_settings 推奨」** セクションから literal 取得：

   ```json
   { "stability": 0.70, "similarity_boost": 0.75, "style": 0.30, "use_speaker_boost": true }
   ```

   ハードコード禁止、必ず spec から読む（R-H15）。
5. **shot ごとに分割して TTS 呼び出し**（カット境界が明確になるため、合体読みは禁止）：
   各 shot の `narration_text_ssml`（Step 3 で準備、SSML 込み）を 1 呼び出し → `.assets/<id>/narration-N.mp3`
6. **shot 尺整合性チェック**（推奨、将来 R-H19）：生成された mp3 の duration が `shot_duration_sec` を超えていたら警告 + `issues.json` に `narration_overflow:{shot_index}:{actual_sec}` を記録（fail はしない、視聴者は cut off 動画を見る）
7. `reserve(tracker, estimateTtsCost(chars_per_shot), { step: "tts", model: cfg.higgsfield.tts.model_id, provider: "elevenlabs", shot_index })` を shot 単位で
8. `commit(tracker)` を各 shot 成功時
9. **失敗時**：voice fallback を試す（R-H15）。それでも失敗なら `cancel(tracker)`、無音で続行、`issues.json` に `tts_failed:{shot_index}` 記録

### Step 7.5. ナレーションのポストマスター（ffmpeg、auto モードのみ） — R-H16, R-H18

> **lite モード（`tts.enabled: false`）のときは Step 7.5 全体を スキップ**

auto モード時のみ実行：

各 `narration-N.mp3`（raw）を mastered 化：

```bash
ffmpeg -i .assets/<id>/narration-N.mp3 -af "\
  highpass=f=85,\
  equalizer=f=2500:t=q:w=1.4:g=2,\
  acompressor=threshold=-18dB:ratio=3:attack=5:release=80,\
  loudnorm=I=-16:TP=-1.5:LRA=11\
" -y .assets/<id>/narration-N.mastered.mp3
```

1. ffmpeg バイナリの存在を `which ffmpeg` で確認（Remotion 依存で大抵存在）。なければ `POST_MASTER_TOOL_MISSING` で fail
2. 各 shot に対してフィルタチェーンを適用（不変、R-H16）
3. raw と mastered の **integrated LUFS** を `ffmpeg -af loudnorm=...:print_format=json` の出力からパース、`cost-report.json.audio.shots[i]` に記録
4. 失敗時（exit code ≠ 0）は `POST_MASTER_FAILED:{shot_index}` で fail。**raw mp3 のままで Step 8 に進むのは禁止**

### Step 8. Remotion `.tsx` 生成 — R-H18

Claude が `output/<product>/<date>/<id>.tsx` を直接書く。命名は R-H13 に従い `<product>-hf-reel-<index>`（例：`taskflow-hf-reel-1`）。

**`tts.enabled` / `bgm.required` の組合せで埋込内容を切り替え**:

| `tts.enabled` | `bgm.required` | 埋込内容 |
|---|---|---|
| `false` (lite) | `false` | 動画/静止画 + `<TextOverlay>` のみ。音声なし |
| `false` (lite) | `true` | 動画/静止画 + `<TextOverlay>` + BGM `<Audio>` |
| `true` (auto) | `false` | 動画/静止画 + `<TextOverlay>` + narration `<Audio>` |
| `true` (auto) | `true` | フル：動画 + テロップ + narration `<Audio>` + BGM `<Audio>` |

**ガード**:
- `tts.enabled: false` のとき `<Audio src=...narration-N.mastered.mp3 />` を埋め込んだら `LITE_MODE_VIOLATION:tts_called` で fail
- `bgm.required: false` のとき BGM `<Audio>` を埋め込んだら `LITE_MODE_VIOLATION:bgm_embedded` で fail

骨子（auto + BGM フル例。**Audio は必ず `.mastered.mp3` を参照、R-H16**）：

```tsx
import { AbsoluteFill, Audio, Sequence, Video, Img, staticFile } from "remotion";
import { ZoomIn } from "../../remotion/src/shared/transitions";
import { TextOverlay } from "../../remotion/src/shared/TextOverlay";

export const TaskflowHfReel1 = () => (
  <AbsoluteFill>
    {/* BGM (optional, ASMR コミット時は省略) */}
    <Audio src={staticFile("products/taskflow/assets/bgm/<chosen>.mp3")} volume={0.2} />
    {/* カット0: 0〜5sec */}
    <Sequence from={0} durationInFrames={150}>
      <Video src={staticFile("output/taskflow/2026-05-17/.assets/taskflow-hf-reel-1/shot-0.mp4")} />
      {/* mastered mp3 を参照（raw は禁止）*/}
      <Sequence from={5}>
        <Audio src={staticFile("output/taskflow/2026-05-17/.assets/taskflow-hf-reel-1/narration-0.mastered.mp3")} />
      </Sequence>
      <TextOverlay text="..." startAt={15} endAt={120} />
    </Sequence>
    {/* カット2: 静止画フォールバック例 */}
    <Sequence from={300} durationInFrames={150}>
      <ZoomIn>
        <Img src={staticFile("output/taskflow/2026-05-17/.assets/taskflow-hf-reel-1/shot-2.png")} />
      </ZoomIn>
      <Sequence from={5}>
        <Audio src={staticFile("output/taskflow/2026-05-17/.assets/taskflow-hf-reel-1/narration-2.mastered.mp3")} />
      </Sequence>
    </Sequence>
  </AbsoluteFill>
);
```

ナレーション開始フレーム（`<Sequence from={N}>` の N）は voice-spec のカテゴリ別ペース感に
従い、特に worldview / persona では **frame 5〜10 程度の早出し**を推奨（冒頭 3 秒の hook 強化）。
feature では UI 操作の見せ場と同期させるため frame 15〜25 が妥当。

#### lite モード骨子例（`tts.enabled: false, bgm.required: false`）

最も簡素な構成。narration / BGM は外部編集で当てる前提:

```tsx
import { AbsoluteFill, Sequence, Video, Img, staticFile } from "remotion";
import { ZoomIn } from "../../remotion/src/shared/transitions";
import { TextOverlay } from "../../remotion/src/shared/TextOverlay";

export const TaskflowHfReel1 = () => (
  <AbsoluteFill>
    {/* BGM / narration は埋め込まない (lite mode) */}
    <Sequence from={0} durationInFrames={150}>
      <Video src={staticFile("output/taskflow/2026-05-17/.assets/taskflow-hf-reel-1/shot-0.mp4")} />
      <TextOverlay text="..." startAt={15} endAt={120} />
    </Sequence>
    {/* ... 他 shot も同様 */}
  </AbsoluteFill>
);
```

完成 MP4 は無音。視聴者向けには CapCut / Premiere 等で `.md` のナレーション台本セクションを参考に手動で narration / BGM を当てる。

`remotion/src/Root.tsx` に Composition を登録：

```tsx
<Composition
  id="taskflow-hf-reel-1"
  component={TaskflowHfReel1}
  durationInFrames={20 * 30}
  fps={30}
  width={1080}
  height={1920}
/>
```

> Remotion API の使い方（`useCurrentFrame`, `interpolate`, `Sequence`, `Composition` の宣言場所、`spring` の使いどころ等）は `remotion-dev/skills` のルールに従う。本 Skill 内で再定義しない。

### Step 9. 既存 R7 検証ループ + render

ここからは既存 `create-advertisement` パイプラインと同じ：

1. `pnpm exec remotion still <entry> <id> <png-path> --frame=N` で 3 フレーム抽出（frame=0 / mid / end）
2. Claude が PNG を Read で視覚チェック（既存 `VISUAL_CHECKLIST`、`lib/validators.ts`）
3. `pnpm exec tsc --noEmit` で型チェック
4. 問題あれば `.tsx` 修正（**素材は再生成しない、合成だけ調整**）→ 最大 3 回（`config.yaml.validation.max_iteration`）
5. OK なら `pnpm exec remotion render <entry> <id> <output-mp4>` で MP4 出力
6. `<id>.preview.png` として frame 0 をコピー
7. `<id>.validation.json` に構造化結果を atomic write

### Step 10. 投稿コピー + manifest + cost-report — R-H10, R-H12, R-H16, R-H17, R-H18

1. **投稿コピー（R-H12 = R13継承 + R-H18 拡張）**：`<id>.md` を生成。共通項目はフロントマター + フック + 本文 + ハッシュタグ 5 本（`variation_note` 先頭に `[category]` タグ、R-H14）。
   - **lite モード時（`tts.enabled: false`）は加えて「## ナレーション台本」セクションを必ず付ける**（R-H18）。shot 別に:
     - シーン要約 / 想定テキスト（日本語）/ 想定発話時間 / 強調キーワード / SSML 例 / 推奨 voice / 推奨音量
     - voice-spec/{category}.md の Pace Target / Prosody Patterns / Exemplar Phrases を参照
   - 末尾に「CapCut / Premiere 等での組み立て手順」を 5 ステップ前後で
   - 欠落していたら `MISSING_NARRATION_SCRIPT` で fail
   - `lib/manifest.ts` の writeManifestAtomic と同じ atomic 書き込みを使う
2. **manifest.json**（atomic write）：`engine: "higgsfield"`、`rules_version: "1.0.0"`、`higgsfield_rules_version: "1.2.0"`、`cost.{limit_usd, spent_usd, aborted_by_cost}`、`items[].models_used` を含む。各 item に以下を追加：
   - `category`（R-H14）
   - **`audio_mode: "manual" | "auto"`**（R-H18、`tts.enabled` の値に応じて）
   - `bgm_embedded: true | false`（R-H18、`bgm.required` の値に応じて）
3. **cost-report.json**（atomic write）：`toReport(tracker, {session_started_at, session_ended_at})` の戻り値に `audio.loudness` セクションを足して書く（auto モード時のみ実数値、lite モード時は `null`）（R-H16）。**成功 / 失敗 / abort のいずれでも必ず出力**（R-H10）。
4. **issues.json**：途中で記録した issue がある場合のみ書く。R-H17 read-only 違反検知時もここに記録。R-H18 違反（lite モードでの誤 TTS 呼出等）もここに記録。
5. **R-H17 read-only 監査**：Step 1 で記録した `assets_mtime_snapshot.json` を再チェック、変更されていれば `READ_ONLY_VIOLATION:{path}` を issues.json に記録（停止はしない）。
6. **中間ファイル**：`.assets/<id>/` は basic 残す（auto モードでは `narration-N.mp3` + `narration-N.mastered.mp3` の両方を保持、A/B 比較用。lite モードでは narration 系ファイルなし）。`strict_mode: true` のみ raw を削除。

### Step 11. stdout 終了サマリ

```
✅ create-advertisement-with-higgsfield 完了

product:    <name>
output:     output/<name>/<date>/
duration:   <分秒>
cost:       $<spent> / $<limit> (<%>)

動画:
  ✅ <id>.mp4 (<duration>秒, <shots>カット, validation pass)
     ※ 必要なら shot[N] の fallback 等を併記

issues:     <件数>件
詳細:       output/<name>/<date>/{manifest,issues,cost-report}.json
```

## アンチパターン（やらないこと）

R-H に書かれた禁則に加えて：

- ❌ Composition id を `<product>-hf-` プレフィックスなしで作る（既存と衝突）
- ❌ `output/` の外にファイルを書く
- ❌ 視覚チェックなしで render する
- ❌ 1 カット失敗で全体停止する（次カットへ進む）
- ❌ 配信処理（git / gh / curl で SNS API、Slack 通知等）を「便利だから」追加する
- ❌ `core.md` を読まずに config だけで生成する
- ❌ Remotion 実装の細かい使い方を本 Skill 内で考え込む（→ remotion-best-practices に委譲）
- ❌ Higgsfield の `state: nsfw` を無視する
- ❌ `variation_note` の `[category]` タグ無しで TTS に進む（R-H14）
- ❌ プレーンテキスト narration を ElevenLabs に渡す（必ず SSML、R-H15）
- ❌ raw mp3 を `.tsx` から直参照（必ず `.mastered.mp3`、R-H16）
- ❌ ffmpeg ポストマスター工程を「軽量化のため」省く（R-H16）
- ❌ autonomous run 中に voice-spec / reference を書き換える（R-H17）
- ❌ `tts.enabled: false` で ElevenLabs MCP を呼ぶ（R-H18 lite モード違反）
- ❌ `bgm.required: false` のとき .tsx に BGM `<Audio>` を埋め込む（R-H18 違反）
- ❌ lite モードで `.md` のナレーション台本セクションを省略（R-H18）
- ❌ lite モードの動画に narration が無いことを伝えず、消費者に "音声付き完成品" と誤認させる出力

## ヘッドレス実行コマンド（cron 用）

```bash
cd /path/to/adcraft && \
  unset ANTHROPIC_API_KEY && \
  claude -p "create-advertisement-with-higgsfield skill で taskflow の動画を1本生成して。承認不要、最後まで自律実行して。" \
    --permission-mode bypassPermissions \
    --max-turns 200 \
    --output-format stream-json --verbose \
    >> logs/$(date +%Y%m%d-%H%M%S).log 2>&1
```

**ヘッドレス実行で詰まらないためのポイント**：
- `bypassPermissions` を使う（`acceptEdits` だと `pnpm exec remotion still` 等の Bash で止まる）
- プロンプトに「承認不要、自律実行して」等を含める（R-H11 のユーザー確認をスキップさせる）
- `--output-format stream-json --verbose` で無音状態を回避

## エラーハンドリング

| 状況 | 対応 |
|---|---|
| Higgsfield MCP 未接続 | 起動時停止、`claude mcp add` 手順を案内 |
| ElevenLabs MCP 未接続 | 起動時停止 |
| `core.md` がプレースホルダのまま | 停止、ユーザーに記入を促す |
| `config.yaml.higgsfield.enabled: false` | 停止、有効化を案内 |
| `assets/reference/` 空 | 停止、商品画像配置を案内 |
| `assets/bgm/` 空 + `bgm.required: true` | 停止、BGM 配置を案内 |
| 画像 3 回 NG | カット動画化中止、`issues.json` 記録、次カットへ |
| 動画 1 発 NG | 静止画フォールバック、`issues.json` 記録、続行 |
| TTS 失敗 | 無音で続行、`issues.json` 記録 |
| cost 上限到達 | 即 abort、生成済カットで合成試行 |
| Remotion R7 検証 3 回 NG | 動画スキップ（既存 R8） |
| Claude Code トークン切れ | プロセス終了、外側スケジューラに任せる |
| `output/` 書き込み権限なし | 即停止、ユーザー通知 |
