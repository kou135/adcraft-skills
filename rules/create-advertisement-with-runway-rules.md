# create-advertisement-with-runway Rules

> **Skill `create-advertisement-with-runway` の不変ルール（v1.0.0）**
>
> Skill は実行のたびに**まず**このファイルを読み込み、内容に従って動画生成を行う。
> 既存 `create-advertisement-rules.md`（R1-R13）/ `create-advertisement-with-higgsfield-rules.md`
> （R-H1-R-H18）とは独立した R-R 系統を採用。本ファイルの version は `manifest.json` の
> `runway_rules_version` に記録される。
>
> **設計方針**：Skill C（higgsfield 版）と**機能（パイプライン）レベルで同型**になるよう、
> 生成バックエンドだけ Runway に差し替えたもの。R-R1〜R-R18 は R-H1〜R-H18 と機能的に 1:1 対応する
> （ただし Runway MCP の制約下での等価実装：model は config preference で解決、コストは client 側算出 等）。
> **R-R19 は Higgsfield に対応ルールが存在しない Runway バックエンド固有の制約**（`list_models()` /
> balance tool 非対応、生成物 URL の 24h 失効、ratio の pixel 文字列、model ID literal、duration enum、
> referenceImages 構造）を集約した**補助ルール**であり、R-R1〜R-R18 の 1:1 対応を損なうものではない。
>
> **変更履歴**：
> - v1.0.0: 初版。Skill C v1.2.0（R-H18 lite/auto モード）相当の機能を Runway 向けに移植。

## ゴール

- **Runway hosted MCP（`https://mcp.runwayml.com/mcp`、Streamable HTTP、OAuth）** と
  ElevenLabs MCP を用いて、`products/<name>/core.md` のマーケ方針に基づく実写級の広告動画を生成する。
  課金は **Runway の Web サブスク・クレジット枠**から引かれる（Higgsfield と同型。clone / API キー不要）。
- MVP は **1 本 / 20 秒 / 4 カット / 9:16**。
- 1 run の消費は `config.yaml.runway.credit_limit_per_run`（推定クレジット上限）と
  `cost_limit_usd`（USD 概算 proxy）の小さい方で頭打ちにする。**真のハードキャップは月次サブスク枠**（Standard 625/月 等）。
- 既存 `create-advertisement` / `create-advertisement-with-higgsfield` skill / ルール / output 構造を
  壊さず併存する。
- 配信は本 skill の責務外（既存 R10 を継承）。

## 不変ルール

### R-R1. MCP 疎通確認（起動時）

skill 起動時に以下を順に確認し、1 つでも失敗したら停止する：

1. Runway hosted MCP に lightweight call（組織/プラン情報やモデル一覧を返す確認系 tool）→ 200 OK
   - **hosted MCP が公開する tool 名は接続時に実機確認する**（`/mcp` で列挙される。本ファイル/SKILL.md の
     `runway_generateImage` 等は期待マッピングで、実 tool 名と異なれば実機名に合わせる、R-R19）。
   - hosted は初回ブラウザ OAuth が 1 回必要。以後はトークンがキャッシュ＋リフレッシュされ headless 可（Higgsfield と同様）。
2. `lib/runway-cost.ts` の `isPricingTablePopulated()` が true（価格テーブルが空でない）。false / import 不能なら
   `LIB_RUNWAY_COST_NOT_FOUND` で停止（model 解決・コスト算出の前提が壊れているため、R-R2）
3. ElevenLabs MCP の lightweight call（例: `list_voices()`）→ 200 OK（**auto モード時のみ必須**、R-R18）
4. `products/<name>/assets/reference/*.{png,jpg,jpeg,webp}` が 1 枚以上存在
5. **各 reference 画像が base64 化後 ≤16MB**（`fitsBase64Limit(fileBytes)` で判定、R-R3 / R-R19）。
   超過があれば `REFERENCE_IMAGE_TOO_LARGE:{filename}` で停止し、(a) リサイズ（生 ~11.5MB 未満）、または
   (b) 公開 URL にアップロードして `referenceImages` の `uri` に HTTPS URL を渡す、を案内する
6. `products/<name>/assets/bgm/*.mp3` が 1 枚以上存在（`bgm.required: true` のとき）

停止時は `MCP_NOT_CONNECTED:runway` / `REFERENCE_IMAGE_MISSING` / `BGM_MISSING` 等の明確な reason を
stdout に出し、`claude mcp add --transport http runway https://mcp.runwayml.com/mcp` →（Claude Code 内で）`/mcp` で
OAuth 認証、の手順を案内する（clone / API キー不要）。

### R-R2. モデル ID は config preference から解決、ハードコード禁止

- モデル ID は `config.yaml.runway.image.model_preference` と `.video.model_preference` の優先順から取り、
  `lib/runway-cost.ts` の `isKnownImageModel()` / `isKnownVideoModel()`（価格テーブル = 既知モデル集合）で
  検証して最初に true になる 1 つを使う（hosted がモデル一覧 tool を公開していても、選定は preference 主導）。
- preference に書かれた全モデルが既知集合にも存在しないなら停止（`MODEL_NOT_KNOWN`）。
- ⚠️ **静的テーブルの宿命**：Runway 側でモデル追加 / 価格改定があると `lib/runway-cost.ts` が古くなる。
  さらに **hosted（web-app サブスク）のクレジット消費は Dev API 由来の本テーブルとずれうる**（gen4.5 等）。
  重要な run の前に runwayml.com/pricing（web-app）を確認し、接続テストで実消費を実測して校正する（R-R19.1）。
- model ID は **literal を厳守**（R-R19）。特に `gen4.5`（ドット）/ `gen4_image`（アンダースコア）。
- 選択結果は `output/<product>/<date>/.assets/<id>/assets-manifest.json` にキャッシュし、同セッション中は再解決不要。

### R-R3. 商品リファレンス画像の一貫性参照

- Runway は higgsfield の `upload_image()` → URL 方式ではなく、`runway_generateImage`（text_to_image）の
  **`referenceImages` 配列（1〜3 枚）に `{ uri, tag }` を渡す**方式。`uri` は HTTPS URL または
  **base64 data URI**（JPEG/PNG/WebP, ≤16MB）。
- `products/<name>/assets/reference/*` は base64 data URI に変換して全カットの `runway_generateImage` で
  同じ参照を渡す（商品一貫性のため）。`tag` を付け、prompt 内で `@tag` 構文で参照する。
- 変換した data URI（またはアップロード URL）と tag を `assets-manifest.json` にキャッシュ。

### R-R4. 画像段階は厳格検証 / 動画段階は 1 発主義

| 段階 | リトライ予算 | 失敗時の挙動 |
|---|---|---|
| 画像（gpt_image_2 / gen4_image） | 初回 + リトライ最大 2 回（合計 3 回まで） | そのカットの動画化を中止、`issues.json` 記録、次カットへ |
| 動画（seedance2 / gen4_turbo） | 1 回のみ | **静止画フォールバック**（R-R5） |
| 合成（既存 R7） | 既存 R7 踏襲、最大 3 回 | 動画スキップ（既存 R8） |

`config.yaml.runway.video.one_shot: false` にした場合のみ動画再生成を許容（明示オプトイン、デフォルト true）。
画像判定は `lib/runway-checklist.ts` の `RUNWAY_IMAGE_CHECKLIST` で構造化する。

### R-R5. 動画 NG 時の静止画フォールバック

- 動画生成失敗 / task `FAILED` / `CANCELLED` / モデレーションブロック / 動画段階軽量検証 NG の場合
- `.tsx` 内で当該カットは `<Video src=...mp4>` の代わりに **`<Img src=...png>` + `<ZoomIn>`（Ken Burns）** を使う
- `issues.json` に `type: "video_fallback_to_image"` を info レベルで記録（失敗扱いではなく許容済み挙動）
- preference に複数動画モデルがある場合（例：`seedance2` 失敗 → `gen4_turbo`）、静止画に落ちる前に
  次候補モデルを 1 回試行してよい（R-R4 の「動画 1 回のみ」は同一モデルに対して適用）。

### R-R6. クレジット消費の上限遵守（hosted / client 側推定）

- **真のハードキャップは月次サブスク・クレジット枠**（Standard 625/月 等）。Runway 側が枠超過を物理的に止めるため、
  暴走課金リスクは Dev API より低い。本 skill の cost guard はその枠を 1 run で食い潰さないための**推定ベースの安全弁**。
- hosted MCP は per-call コスト/残高を返さない可能性が高い。消費は `lib/runway-cost.ts` の
  `estimateRunwayImageCredits` / `estimateRunwayVideoCredits` で **model + duration + resolution から client 側にクレジット推定**する。
- `config.yaml.runway.credit_limit_per_run`（推定クレジット上限）と `cost_limit_usd`（USD 概算 proxy、`cost_tracker` 連携用）
  の **どちらか先に到達した方**で abort。各 `generate*` / TTS 呼び出し**前**に予測判定：

  ```
  if (spent + reserved + next_call > limit * safety_margin) → abort   // credit と USD の両方で評価
  ```

- `safety_margin` のデフォルトは `0.95`。abort 時は `tracker.aborted = true` を立て（`aborted_by_cost` を真にするため、R-R10）、
  `issues.json` に `cost_limit_reached`（at_step / at_shot / predicted_credits）を記録し、**生成済カットだけで最終 Remotion 合成を試行**する。
- **0 カット abort 時（生成済が 1 枚も無い）は Remotion 合成を試みず、`items` 空の manifest と cost-report を書いて clean に終了**（base R-H6 継承）。
- 推定は best-known テーブル値で、**hosted（web-app）の実消費とずれうる**。cost guard が踏み抜かないよう画像は worst case
  （gpt_image_2 = 41 cr）で見積もる。**seedance2 / gpt_image_2 の web-app クレジット消費は接続テストで実測校正**（R-R2 / R-R19.1）。
- ⚠️ seedance2 は高消費（Dev API 36 cr/s 相当）。preference に `gen4_turbo`（5 cr/s）を fallback として置き安全弁にする。
  コスト優先の初回は native（gen4_turbo / gen4_image）を 1st にするのも可。

### R-R7. 直列実行

- 同一カット内：画像 → 動画は直列。カット間：0 → 1 → 2 → 3 直列。
- 例外：ElevenLabs TTS は画像/動画生成と並列 OK（別 MCP）。
- `config.yaml.runway.parallel: false`（デフォルト）。MVP は直列。

### R-R8. エラーバックオフ & async polling

- 生成は async：`runway_generateImage` / `runway_generateVideo` が task を返す → `runway_getTask(id)` で
  status を poll（`PENDING` / `THROTTLED` / `RUNNING` / `SUCCEEDED` / `FAILED` / `CANCELLED`）。
- poll 間隔は **≥5s + jitter**。`THROTTLED` や HTTP 429 は指数 backoff `5s → 15s → 45s` 後諦め。
  HTTP 5xx は `2s → 6s → 18s`。task の待機タイムアウトは 10 分。
- バックオフ中の wait は cost_tracker 非加算（task が `SUCCEEDED` になった時のみ commit）。
- `FAILED` 理由がプロンプト起因（モデレーション等）なら画像段階はプロンプト微調整 1 回リトライ可。

### R-R9. 中間素材の永続化 & 24h 失効対応

- `output/<product>/<date>/.assets/<id>/` に `shot-plan.yaml` / `shot-N.png` / `shot-N.mp4`（fallback 時なし）/
  `narration-N.mp3` / `assets-manifest.json` を保存。
- ⚠️ **Runway の生成物 URL は 24h で失効する**。task `SUCCEEDED` 後 **即座にダウンロード**して上記パスに
  永続化すること（R-R19）。URL をそのまま `.tsx` から参照するのは禁止。
- abort / crash 時も中間素材は**残す**。`config.yaml.validation.strict_mode: true` のときのみ最終 render 後に削除。
- `.gitignore` に `output/**/.assets/` を含める（既存設定を踏襲）。

### R-R10. cost-report.json は必ず出力

- 成功 / 失敗 / abort いずれの終了でも `cost-report.json` を atomic write。
- 内訳：`by_provider`（`runway` / `elevenlabs`）/ `history` 配列 / `aborted_by_cost` フラグ。
- Runway は balance 非取得のため、`toReport(tracker, session, { notes })` で `notes` に**必ず**以下相当を明記する
  （`CostReport.notes`、R-R6）：「コストは `lib/runway-cost.ts` の価格表（最終検証: <date>）に基づく
  **client 側推定値**であり、モデル更新・価格改定により実際の Runway 課金と一致しない場合がある。最終額は
  Runway の billing ダッシュボードで確認すること」。使用モデルと適用クレジット単価も併記して監査可能にする。

### R-R11. 既存 R10 / R11 / R12 を継承

- **R10（配信責務外）**：git push / SNS API / Slack 通知等は実装しない。
- **R11（整合性チェック）**：core.md placeholder / config 不正 / formats 全 false / reference 空 /
  bgm 空（required 時）を停止条件に加える。
- **R12（headless 時のユーザー確認スキップ）**：`headless` / `自律実行` / `承認不要` / `auto` /
  `そのまま生成` 等のキーワードで自動承認。

### R-R12. 投稿コピー（R13）の継承

- 既存 R13 そのまま継承：`<id>.md`（フロントマター + フック + 本文 + ハッシュタグ 5 本）。
- `variation_note` に「Runway 版 / 生成 AI による差別化軸」を反映。先頭 `[category]` タグは R-R14。

### R-R13. ファイル命名でエンジン識別

- 動画 ID 命名規則：`<product>-rw-<type>-<index>`（例：`taskflow-rw-reel-1`）。
- `-rw-` プレフィックスで既存 skill 出力（`taskflow-reel-1` / `taskflow-hf-reel-1`）と衝突回避。
- Composition id（`remotion/src/Root.tsx`）も同じ命名。

### R-R14. コンテンツカテゴリ & voice-spec の読み込み必須

- 各 variation の `variation_note` は **先頭に `[category/viewpoint]` の 2 階層タグ**を持つ（例：`[worldview/observed] Runway 版 …`）。
  - `category` 無しは `MISSING_CATEGORY_TAG` で fail-fast。
  - `viewpoint` は core.md の該当カテゴリ「視点パレット」の値のみ許可。省略時はパレット 1st を default 採用
    （`viewpoint_defaulted` を info 記録）、パレット外は `INVALID_VIEWPOINT_TAG:{category}:{viewpoint}` で停止。
  - viewpoint は過去 reel の直近 N-1 件と重複させない（Step 3 の履歴チェック）。manifest の `items[].viewpoint`
    （旧 manifest は `variation_note` の 2 階層目から抽出）が履歴の参照源。
- 起動時に以下を順に確認、1 つでも失敗したら停止：
  1. `products/<name>/core.md` 内 `## コンテンツカテゴリ` に該当 `[category]` が定義
  2. `products/<name>/assets/voice-spec/{category}.md` が存在
  3. `products/<name>/assets/voice-spec/_index.md` の `カテゴリ一覧` 表に該当 category が掲載
  4. 該当 `{category}.md` に `Voice Persona` / `Tone Keywords` / `Pace Target` / `Prosody Patterns` /
     `Taboos` / `Recommended ElevenLabs Voices` の 6 セクションが揃っている
- `products/<name>/assets/reference/index.md` が存在し対応表を持つこと。
- 違反 reason：`MISSING_CATEGORY_TAG` / `CATEGORY_NOT_IN_CORE` / `VOICE_SPEC_MISSING:{category}` /
  `VOICE_SPEC_INCOMPLETE:{category}:{missing_section}` / `REFERENCE_INDEX_MISSING`

### R-R15. TTS スクリプトの SSML 強制（auto モードのみ）

Step 7（TTS 生成）に渡すスクリプトには以下を**必ず**含める：

- 各 shot に `<break time="x.xs"/>` 最低 1 箇所（voice-spec の `Pace Target` 準拠）
- ブランド/感情キーワードに `<prosody>` 最低 1 箇所（voice-spec の `Prosody Patterns` 準拠）
- voice_settings は voice-spec の「ElevenLabs voice_settings 推奨」を literal で ElevenLabs MCP に渡す
- voice 選定は `Recommended ElevenLabs Voices` の優先順位。1st 不可なら 2nd → 3rd → fallback、結果を
  cost-report.json の `notes` に記録

違反時：`MISSING_SSML_BREAK` / `MISSING_SSML_PROSODY` / `MISSING_VOICE_SETTINGS` で fail-fast。

### R-R16. ffmpeg ポストマスター工程の必須化（auto モードのみ）

Step 7 と Step 8 の間に **Step 7.5 ポストマスター**を必ず実行：

- `narration-N.mp3`（raw）→ `narration-N.mastered.mp3`（mastered）
- ffmpeg フィルタチェーン（不変）：

  ```bash
  ffmpeg -i in.mp3 -af "\
    highpass=f=85,\
    equalizer=f=2500:t=q:w=1.4:g=2,\
    acompressor=threshold=-18dB:ratio=3:attack=5:release=80,\
    loudnorm=I=-16:TP=-1.5:LRA=11\
  " -y out.mp3
  ```

- `.tsx` 内 `<Audio>` は **必ず `.mastered.mp3` を参照**（raw 直参照は禁止）。
- raw / mastered の integrated LUFS を `cost-report.json` の `audio.loudness` に記録。
- ffmpeg 不在 / 実行失敗時：`POST_MASTER_FAILED` で fail（raw mp3 のままの render は禁止）。

### R-R17. voice-spec & reference は autonomous run 中 read-only

- autonomous run 中、いかなる Step も `assets/voice-spec/*.md` / `_index.md` / `assets/reference/*` /
  `reference/index.md` に対し **Write / Edit を行ってはならない**（curate された入力であり、1 本の reel 都合で
  書き換えない）。これらの更新は将来予定の専用 skill（refresh-voice-specs 等）の明示起動で行う。
- 違反検知：起動前に mtime を記録、終了前に再チェック。変更されていれば `READ_ONLY_VIOLATION:{path}` を
  issues.json に記録し、**Step 11 終了サマリにも目立つ警告として表示する**（検知のみで停止はしないが、
  headless でも見落とさないよう顕在化させる）。git で元に戻すことを案内する。

### R-R18. TTS / BGM 自動化の opt-in 化（lite / auto モード切替）

`config.yaml.runway` の 2 フィールドで挙動を切替える。**デフォルトは lite モード**：

| フィールド | デフォルト | 効果 |
|---|---|---|
| `tts.enabled` | **`false`** | `false` = lite（TTS スキップ、台本のみ）/ `true` = auto（ElevenLabs 自動生成）|
| `bgm.required` | **`false`** | `false` = .tsx に BGM `<Audio>` 非埋込 / `true` = `assets/bgm/*.mp3` を全 shot 通敷 |

#### lite モード（デフォルト、`tts.enabled: false`）

- Step 7 / 7.5 を**スキップ**。.tsx に narration `<Audio>` を埋め込まない。
- Step 10（`.md`）に **「## ナレーション台本」セクションを必ず追加**（shot 別の SSML 込み台本 + CapCut 手順）。
- `manifest.json`：`items[].audio_mode: "manual"`。
- R-R14 継続適用（voice-spec は台本生成のガイド）。R-R15/16 は TTS 呼び出しが無いため fail-fast 対象外。

#### auto モード（`tts.enabled: true`）

- Step 7 / 7.5 を実行。.tsx に narration `<Audio src=...mastered.mp3 />` を埋め込み。
- R-R14 / R-R15 / R-R16 / R-R17 を完全適用。
- `tts.voice_id` が空なら `TTS_VOICE_ID_MISSING` で fail-fast。`manifest.json`：`items[].audio_mode: "auto"`。

#### BGM の独立制御 / 違反検知

- `bgm.required` は `tts.enabled` と独立（例：`tts.enabled:false, bgm.required:true`）。
- 違反：`tts.enabled:false` で ElevenLabs 呼出 → `LITE_MODE_VIOLATION:tts_called` /
  `bgm.required:false` で BGM 埋込 → `LITE_MODE_VIOLATION:bgm_embedded` /
  lite で「## ナレーション台本」欠落 → `MISSING_NARRATION_SCRIPT`

### R-R19. Runway 固有の制約（必読）

Runway バックエンド特有の落とし穴。SKILL.md 全 Step でこれらを厳守する：

1. **hosted MCP（OAuth、Web サブスク課金）**：①公開 tool 名は接続時に `/mcp` で実機確認（本ファイルの
   `runway_generateImage` 等は期待マッピング）②per-call コスト/残高は返らない前提でコストは client 側にクレジット推定（R-R6）
   ③モデルは config preference から解決（R-R2）④初回 OAuth は 1 回、以後はトークン再利用で headless 可。
2. **生成物 URL は 24h で失効**：task 完了後**即ダウンロード**して永続化（R-R9）。URL 直参照禁止。
   （生成物は Runway library にも保存されるが、ローカル DL を正とする）
3. **ratio は pixel 文字列**：9:16 は `"9:16"` ではなく **`"720:1280"`**（gen4.5 i2v は `832:1104` / `672:1584` も）。
   landscape は `1280:720` 等。**⚠️ image_to_video（動画）と text_to_image（画像、gen4_image）で許容 ratio enum が
   異なる**。`"720:1280"` は動画側で確認済みだが、画像生成側（gen4_image / gpt_image_2）の portrait 文字列は
   別系統（1024/1080 級）の可能性があるため、**実 run（接続テスト）で image 側 ratio を確認**し、必要なら
   `runway.image.ratio` を `runway.video.ratio` と分離する。video 用文字列を image エンドポイントに渡すと 400 になりうる。
4. **model ID literal を厳守**：`gen4.5`（ドット）/ `gen4_turbo` / `gen4_aleph` / `act_two` / `gen3a_turbo` /
   `seedance2` / `gen4_image`（アンダースコア）/ `gen4_image_turbo` / `gpt_image_2`。`gen4_5` `gen_4_5` は誤り。
5. **duration enum（モデル別）**：固定 enum は `lib/runway-cost.ts` の `RUNWAY_VIDEO_DURATION_ENUM` で管理
   （`gen4_turbo` / `gen4.5` / `gen3a_turbo` = `[5, 10]`）。**`seedance2` は 4〜15s の柔軟範囲で固定 enum を持たない**ため
   `allowedDurationsFor(model)` が `null` を返し、その場合は**丸めない**（[5,10] を誤強制しない）。固定 enum を持つ
   モデルでのみ `roundDuration` を使い、丸めが発生したときだけ `issues.json` に `duration_rounded` を記録。
6. **reference image**：`referenceImages` 配列に最大 3 枚、`{ uri, tag }`（uri = base64 data URI か URL）+ `@tag` で prompt 参照（R-R3）。
   **16MB 制約は base64 エンコード後のペイロードに掛かる**（base64 は ~4/3 に膨張）。`fitsBase64Limit(rawBytes)` で
   エンコード後サイズ ≤16MB を判定してから渡す（生 16MB チェックだけでは不十分、R-R1.5 / R-R3）。
7. **pre-flight 検証の強制**：3〜6 は API 呼び出し前に `lib/runway-cost.ts` のヘルパで防御的に検証する
   （headless 実行で失敗を未然に防ぐため）。`isValidRatio(ratio)`（`"9:16"` 等を弾く）/
   `isKnownVideoModel` `isKnownImageModel`（typo `gen4_5` 等を弾く）/ `allowedDurationsFor(model)` →
   非 null なら `roundDuration(sec, enum)`、null（seedance2 等）は丸めない / `fitsBase64Limit(bytes)`。
   ratio / model が不正なら fail-fast、duration 丸め発生時のみ `issues.json` に `duration_rounded` を記録。

## 受入基準

1. `output/<product>/<date>/` に MP4 1 本、`.preview.png`、`.md`、`manifest.json`、`issues.json`、`cost-report.json` が揃う
2. `manifest.json` の `engine: "runway"`、`cost.aborted_by_cost: false`（正常時）、各 `models_used` 記載
3. `pnpm exec tsc --noEmit` がエラーなく通る
4. 視覚チェック pass（または `issues.json` で明示説明）
5. `cost.spent_usd ≤ cost.limit_usd`
6. `<id>.md` が R13 フォーマット準拠
7. 中間素材 `.assets/<id>/` に `shot-plan.yaml` / `shot-N.png` / `shot-N.mp4`（または fallback 記録）が揃い、
   生成物は 24h 失効前にローカル永続化されている（R-R19）
8. **R-R14 準拠**：`variation_note` 先頭に `[category]` タグ、`voice-spec/{category}.md` 読込済み
9. **R-R15 準拠**（auto のみ）：narration に `<break>` と `<prosody>` が最低 1 個ずつ、voice_settings を spec から literal 取得
10. **R-R16 準拠**（auto のみ）：`narration-N.mastered.mp3` が出力され `.tsx` がそれを参照、LUFS が cost-report に記録
11. **R-R17 準拠**：voice-spec / reference の mtime が起動前後で同一
12. **R-R18 準拠**：`manifest.json.items[].audio_mode` が `"manual"`(lite) / `"auto"`(auto)。lite 時は `.md` に台本セクション
13. **R-R19 準拠**：ratio が `"720:1280"` 等の pixel 文字列、model ID が正しい literal、生成物が 24h 内に DL 済み

## アンチパターン

- ❌ モデル ID をハードコードする（必ず config preference から、R-R2）
- ❌ 商品リファレンス画像なしで `runway_generateImage` する
- ❌ 動画を複数回再生成する（コスト爆発、特に seedance2）
- ❌ cost guard を無視 / `cost_limit_usd: 0` で実質無制限化する
- ❌ 生成物 URL を DL せず `.tsx` から直参照する（24h で失効、R-R19）
- ❌ ratio に `"9:16"` を渡す（`"720:1280"` が正、R-R19）
- ❌ model ID に `gen4_5` / `gen_4_5` を使う（`gen4.5` が正、R-R19）
- ❌ `cost-report.json` を出さずに終了する
- ❌ R10 違反（配信処理を「ついでに」実装）
- ❌ 既存 `create-advertisement` / `-hf-` 出力ファイルと衝突する命名
- ❌ `variation_note` の `[category]` タグ無しで進む（R-R14）
- ❌ プレーンテキストのまま ElevenLabs に渡す（auto モードで `<break>` `<prosody>` 抜き、R-R15）
- ❌ raw mp3 を `.tsx` から直参照（必ず `.mastered.mp3`、R-R16）
- ❌ ffmpeg ポストマスターをスキップ（auto モード、R-R16）
- ❌ autonomous run 中に voice-spec / reference を書き換える（R-R17）
- ❌ `tts.enabled: false` で ElevenLabs MCP を呼ぶ（R-R18 lite モード違反）
- ❌ `bgm.required: false` で .tsx に BGM `<Audio>` を埋め込む（R-R18 違反）
- ❌ lite モードで `.md` のナレーション台本セクションを省略（R-R18）
