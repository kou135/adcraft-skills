# create-advertisement-with-higgsfield Rules

> **Skill `create-advertisement-with-higgsfield` の不変ルール（v1.0.0）**
>
> Skill は実行のたびに**まず**このファイルを読み込み、内容に従って動画生成を行う。
> 既存 `create-advertisement-rules.md` の R1-R13 とは独立した R-H 系統を採用。
> 本ファイルの version は `manifest.json` の `higgsfield_rules_version` に記録される。

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

## 受入基準

1. `output/<product>/<date>/` に MP4 1 本（MVP 想定）、`.preview.png`、`.md`、`manifest.json`、`issues.json`、`cost-report.json` が揃う
2. `manifest.json` の `engine: "higgsfield"`、`cost.aborted_by_cost: false`（正常完了時）、各 `models_used` 記載
3. `pnpm exec tsc --noEmit` がエラーなく通る
4. 視覚チェック pass（または `issues.json` で明示的説明）
5. `cost.spent_usd ≤ cost.limit_usd`
6. `<id>.md` が R13 フォーマット準拠
7. 中間素材 `.assets/<id>/` に `shot-plan.yaml` / `shot-N.png` / `shot-N.mp4`（または fallback 記録）/ `narration.mp3` が揃う

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
