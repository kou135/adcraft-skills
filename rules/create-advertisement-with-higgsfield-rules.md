# create-advertisement-with-higgsfield Rules

> **Skill `create-advertisement-with-higgsfield` の不変ルール（v1.1.0）**
>
> Skill は実行のたびに**まず**このファイルを読み込み、内容に従って動画生成を行う。
> 既存 `create-advertisement-rules.md` の R1-R13 とは独立した R-H 系統を採用。
> 本ファイルの version は `manifest.json` の `higgsfield_rules_version` に記録される。
>
> **変更履歴**：
> - v1.1.0: 音声品質改修。R-H14（content category & voice-spec 読み込み）、R-H15（SSML
>   強制）、R-H16（ffmpeg post-master）、R-H17（voice-spec / reference の read-only）を
>   追加。Step 1 / 7 / 8 への影響あり。

## ゴール

- Higgsfield MCP（GPT Image 2 + Seedance 2.0）と ElevenLabs MCP を用いて、
  `products/<name>/core.md` のマーケ方針に基づく実写級の広告動画を生成する。
- MVP は **1 本 / 20 秒 / 4 カット / 9:16**。
- 1 run のコストは `config.yaml.higgsfield.cost_limit_usd`（デフォルト $10）を絶対遵守する。
- 既存 `create-advertisement` skill / R1-R13 ルール / output 構造を壊さず併存する。
- 配信は本 skill の責務外（既存 R10 を継承）。

## 不変ルール

### R-H1. MCP 疎通確認（起動時）

skill 起動時に以下を順に確認し、1 つでも失敗したら停止する：

1. Higgsfield MCP の `list_models()` を呼ぶ → 200 OK & モデル 1 個以上返る
2. ElevenLabs MCP の lightweight call（例: `list_voices()`）→ 200 OK
3. `products/<name>/assets/reference/*.{png,jpg,jpeg,webp}` が 1 枚以上存在
4. `products/<name>/assets/bgm/*.mp3` が 1 枚以上存在（`bgm.required: true` のとき）

停止時は `MCP_NOT_CONNECTED` / `REFERENCE_IMAGE_MISSING` / `BGM_MISSING` 等の明確な reason を stdout に出し、ユーザーに `claude mcp add` 手順を案内する。

### R-H2. モデル ID は動的解決、ハードコード禁止

- `list_models()` の結果から `config.yaml.higgsfield.image.model_preference` と `.video.model_preference` の優先順で照合し、最初に存在する ID を使う。
- preference に書かれた全モデルが list 結果に存在しないなら停止。
- 選択結果は `output/<product>/<date>/.assets/<id>/assets-manifest.json` にキャッシュし、同セッション中は再問い合わせ不要。

### R-H3. 商品リファレンス画像の一貫性参照

- skill 起動後最初に `upload_image()` で `products/<name>/assets/reference/*` を Higgsfield にホスト。
- 返却 URL を `assets-manifest.json` にキャッシュ。
- **全カットの `generate_image()` 呼び出しで同じ参照 URL を渡す**（商品一貫性のため）。
- リファレンス画像が複数なら全 upload、各カットで関連するものを選んでプロンプトで indicate。

### R-H4. 画像段階は厳格検証 / 動画段階は 1 発主義

| 段階 | リトライ予算 | 失敗時の挙動 |
|---|---|---|
| 画像（GPT Image 2） | 初回 + リトライ最大 2 回（合計 3 回まで） | そのカットの動画化を中止、`issues.json` 記録、次カットへ |
| 動画（Seedance 2.0） | 1 回のみ | **静止画フォールバック**（R-H5） |
| 合成（既存 R7） | 既存 R7 踏襲、最大 3 回 | 動画スキップ（既存 R8） |

`config.yaml.higgsfield.video.one_shot: false` にした場合のみ動画再生成を許容（明示オプトイン、デフォルト true）。

### R-H5. 動画 NG 時の静止画フォールバック

- 動画生成失敗 / `state: failed` / `state: nsfw` / 動画段階軽量検証 NG の場合
- `.tsx` 内で当該カットは `<Video src=...mp4>` の代わりに **`<Img src=...png>` + `<ZoomIn>` (Ken Burns 効果)** を使う
- `issues.json` に `type: "video_fallback_to_image"` を info レベルで記録
- これは「失敗扱いではなく許容済み挙動」

### R-H6. コスト上限の絶対遵守

- `config.yaml.higgsfield.cost_limit_usd`（未指定なら $10）を `cost_tracker.limit_usd` に反映。
- 各 `generate_image` / `generate_video` / TTS 呼び出し**前**に予測判定：

  ```
  if (spent_usd + reserved_usd + next_call_cost > limit_usd * safety_margin) → abort
  ```

- `safety_margin` のデフォルトは `0.95`（$10 上限なら $9.50 で stop）。
- abort 時：
  - `issues.json` に `cost_limit_reached`（at_step / at_shot / predicted_cost）を記録
  - **生成済カットだけで最終 Remotion 合成を試行**（部分成果でも出す）
  - 全カット未着なら manifest を items 空で書いて終了
- headless 時もユーザー確認なしで即 abort（既存 R12 を継承）。

### R-H7. 直列実行

- 同一カット内：画像 → 動画は直列。
- カット間：カット 0 → 1 → 2 → 3 直列。
- 例外：ElevenLabs TTS は画像/動画生成と並列 OK（別 MCP）。
- 並列化は MVP 範囲外。`config.yaml.higgsfield.parallel: false`（デフォルト）。

### R-H8. エラーバックオフ

- HTTP 429 → 指数 backoff `5s → 15s → 45s` 後諦め
- HTTP 5xx → 指数 backoff `2s → 6s → 18s` 後諦め
- `subscribe()` long-poll タイムアウトは 3 分
- バックオフ中の wait は cost_tracker 非加算（呼び出し成功時のみ加算）

### R-H9. 中間素材の永続化 & クリーンアップ

- `output/<product>/<date>/.assets/<id>/` に `shot-plan.yaml` / `shot-N.png` / `shot-N.mp4`（または fallback 時なし）/ `narration.mp3` / `assets-manifest.json` を保存。
- abort / crash 時も**残す**（再開・デバッグ用）。
- `config.yaml.validation.strict_mode: true` のときのみ最終 render 後に削除。
- `.gitignore` に `output/**/.assets/` を追加（巨大バイナリ排除）。

### R-H10. cost-report.json は必ず出力

- 成功 / 失敗 / abort いずれの終了でも `cost-report.json` を atomic write。
- 内訳：`by_provider` / `history` 配列 / `aborted_by_cost` フラグ。
- ユーザーが課金を後から検証できる証跡として機能。

### R-H11. 既存 R10 / R11 / R12 を継承

- **R10（配信責務外）**: そのまま継承。git push / SNS API / Slack 通知等は実装しない。
- **R11（整合性チェック）**: core.md placeholder / config 不正 / formats 全 false / **assets/reference 空 / assets/bgm 空（required時）** を停止条件に加える。
- **R12（headless 時のユーザー確認スキップ）**: そのまま継承。`headless` / `自律実行` / `承認不要` / `auto` / `そのまま生成` 等のキーワードで自動承認。

### R-H12. 投稿コピー（R13）の継承

- 既存 R13 そのまま継承：`<id>.md`（フロントマター + フック + 本文 + ハッシュタグ 5 本）。
- 違いは `variation_note` に「Higgsfield 版 / 生成 AI による差別化軸」が反映される点。

### R-H13. ファイル命名でエンジン識別

- 動画 ID 命名規則：`<product>-hf-<type>-<index>`（例：`taskflow-hf-reel-1`）。
- `-hf-` プレフィックスで既存 skill 出力（`taskflow-reel-1`）と衝突回避。
- Composition id（`remotion/src/Root.tsx`）も同じ命名。

### R-H14. コンテンツカテゴリ & voice-spec の読み込み必須

- 各 variation の `variation_note` は **先頭に `[category]` タグ**を持たねばならない
  （例：`[worldview] Higgsfield 版 / 実写級リファレンス…`）。タグ無しは `MISSING_CATEGORY_TAG` で fail-fast。
- 起動時に以下を順に確認、1 つでも失敗したら停止：
  1. `products/<name>/core.md` 内 `## コンテンツカテゴリ` セクションに該当 `[category]` が定義されている
  2. `products/<name>/assets/voice-spec/{category}.md` が存在する
  3. `products/<name>/assets/voice-spec/_index.md` の `カテゴリ一覧` 表に該当 category が掲載されている
  4. 該当 `{category}.md` に `Voice Persona` / `Tone Keywords` / `Pace Target` / `Prosody Patterns` /
     `Taboos` / `Recommended ElevenLabs Voices` の 6 セクションが揃っている
- 同様に `products/<name>/assets/reference/index.md` が存在し、`画面 × 対応写真の対応表` を持っていることを要求。
- 違反時の reason 例：`MISSING_CATEGORY_TAG` / `CATEGORY_NOT_IN_CORE` / `VOICE_SPEC_MISSING:{category}` /
  `VOICE_SPEC_INCOMPLETE:{category}:{missing_section}` / `REFERENCE_INDEX_MISSING`

### R-H15. TTS スクリプトの SSML 強制

Step 7（TTS 生成）に渡すスクリプトには以下を**必ず**含める：

- 各 shot のスクリプトに `<break time="x.xs"/>` 最低 1 箇所（voice-spec の `Pace Target.pause budget` 準拠）
- 各 shot のブランドキーワード / 感情キーワードに `<prosody>` 最低 1 箇所（voice-spec の
  `Prosody Patterns` セクションのテンプレートを準拠）
- voice_settings は voice-spec の **「ElevenLabs voice_settings 推奨」** セクションを literal で
  ElevenLabs MCP に渡す（stability / similarity_boost / style / use_speaker_boost）
- voice 選定は voice-spec の `Recommended ElevenLabs Voices` の優先順位に従う。1st が利用不可（402
  paid_plan_required 等）なら 2nd → 3rd → fallback と順に試行、選択結果は cost-report.json の `notes` に記録

違反時：`MISSING_SSML_BREAK` / `MISSING_SSML_PROSODY` / `MISSING_VOICE_SETTINGS` のいずれかで
fail-fast し、修正後再試行を要求する。

### R-H16. ffmpeg ポストマスター工程の必須化

Step 7（TTS 生成）と Step 8（Remotion `.tsx` 生成）の間に **Step 7.5 ポストマスター** を必ず実行する：

- `narration-N.mp3`（raw、ElevenLabs 出力）→ `narration-N.mastered.mp3`（mastered、配信向け）
- ffmpeg フィルタチェーン（不変）：

  ```bash
  ffmpeg -i in.mp3 -af "\
    highpass=f=85,\
    equalizer=f=2500:t=q:w=1.4:g=2,\
    acompressor=threshold=-18dB:ratio=3:attack=5:release=80,\
    loudnorm=I=-16:TP=-1.5:LRA=11\
  " -y out.mp3
  ```

- 効果：
  - 85Hz 以下の低域ノイズ除去
  - 2.5kHz +2dB プレゼンス boost（モバイル環境でも子音が抜ける）
  - soft compression で音量差を圧縮
  - **-16 LUFS** に loudness 正規化（TikTok / Instagram / YouTube 共通標準）
- Step 8 の `.tsx` 内 `<Audio>` は **必ず `.mastered.mp3` を参照**する（raw mp3 直参照は禁止）
- 各カットの raw と mastered の loudness 数値を `cost-report.json` の `audio.loudness` に記録：

  ```json
  "audio": {
    "loudness_target_lufs": -16.0,
    "shots": [
      { "index": 0, "raw_integrated_lufs": -24.3, "mastered_integrated_lufs": -16.1 },
      ...
    ]
  }
  ```

- ffmpeg が見つからない / 実行失敗時：`POST_MASTER_FAILED` で fail（raw mp3 のままの render は禁止）。
  ffmpeg は Remotion が依存しているためほぼ確実に存在するが、明示的にチェックする。

### R-H17. voice-spec & reference は autonomous run 中 read-only

- autonomous run（headless モード or 自律実行キーワード時）は以下を一切変更しない：
  - `products/<name>/assets/voice-spec/*.md`
  - `products/<name>/assets/voice-spec/_index.md`
  - `products/<name>/assets/reference/*.{png,jpg,jpeg,webp}`
  - `products/<name>/assets/reference/index.md`
- 変更が必要な場合は別 skill（将来予定の `refresh-voice-specs` / `refresh-reference-index`）の
  明示的起動を要求する。
- 違反検知方法：skill 起動前にこれら ファイルの mtime を記録、終了前に再チェック。変更されて
  いれば `READ_ONLY_VIOLATION:{path}` で警告（停止はしない、issues.json に記録）。
- これにより「flat TTS の原因が voice-spec を skill が勝手に書き換えていたから」のような
  事故を構造的に防ぐ。

## 受入基準

1. `output/<product>/<date>/` に MP4 1 本（MVP 想定）、`.preview.png`、`.md`、`manifest.json`、`issues.json`、`cost-report.json` が揃う
2. `manifest.json` の `engine: "higgsfield"`、`cost.aborted_by_cost: false`（正常完了時）、各 `models_used` 記載
3. `pnpm exec tsc --noEmit` がエラーなく通る
4. 視覚チェック pass（または `issues.json` で明示的説明）
5. `cost.spent_usd ≤ cost.limit_usd`
6. `<id>.md` が R13 フォーマット準拠
7. 中間素材 `.assets/<id>/` に `shot-plan.yaml` / `shot-N.png` / `shot-N.mp4`（または fallback 記録）/ `narration.mp3` が揃う
8. **R-H14 準拠**：`variation_note` 先頭に `[category]` タグがあり、`assets/voice-spec/{category}.md` が読み込まれている
9. **R-H15 準拠**：narration スクリプトに `<break>` と `<prosody>` が最低 1 個ずつ含まれ、voice_settings が voice-spec から literal 取得されている
10. **R-H16 準拠**：`narration-N.mastered.mp3` が出力され、`.tsx` がそれを参照している。`cost-report.json` の `audio.loudness` に raw / mastered の LUFS が記録されている
11. **R-H17 準拠**：voice-spec / reference の mtime が起動前後で同一（変更されていない）

## アンチパターン

- ❌ モデル ID をハードコードする（必ず `list_models()` で解決）
- ❌ 商品リファレンス画像なしで `generate_image` する
- ❌ 動画を複数回再生成する（コスト爆発）
- ❌ cost guard を無視 / `cost_limit_usd: 0` で実質無制限化する設定を許容する
- ❌ 並列化でレート制限を踏み抜く（MVP は直列）
- ❌ `.assets/<id>/` を生成途中で削除する（crash 後再開不能になる）
- ❌ `cost-report.json` を出さずに終了する
- ❌ Higgsfield 側の `state: nsfw` を握り潰して通す
- ❌ R10 違反（配信処理を「ついでに」実装）
- ❌ 既存 `create-advertisement` 出力ファイルと衝突する命名
- ❌ `variation_note` の `[category]` タグ無しで TTS 生成に進む（R-H14）
- ❌ プレーンテキストのまま ElevenLabs に渡す（`<break>` `<prosody>` 抜き、R-H15）
- ❌ voice_settings をハードコード（voice-spec の値を literal 参照すること、R-H15）
- ❌ raw mp3 を `.tsx` から直参照する（必ず `.mastered.mp3` 経由、R-H16）
- ❌ ffmpeg ポストマスター工程をスキップする（R-H16）
- ❌ autonomous run 中に voice-spec / reference のファイルを書き換える（R-H17）
