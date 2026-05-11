---
name: create-advertisement
description: products/<name>/ の core.md と config.yaml に従って、Remotion で広告動画（リール / 横長 / スライド画像）を複数本生成し、視覚検証ループ（remotion still で PNG → Claude が画像として読み判定 → 修正）を経て output/<product>/<YYYY-MM-DD>/ に MP4 等を配置する。配信は責務外。トリガー例：「広告動画を作って」「リールを生成」「create-advertisement」「<商品名> の動画を生成」。
---

# create-advertisement

商品ごとのマーケ方針（`core.md`）と機械設定（`config.yaml`）を入力に、Remotion で広告動画を生成・検証・修正・出力する Skill。

## 依存

このSkillは以下に依存する。**事前に確認**すること：

- **`remotion-dev/skills`（remotion-best-practices）**：Remotion API（`useCurrentFrame`, `interpolate`, `Sequence`, `Composition` 等）の正しい使い方を提供する公式 Skill。本 Skill は Remotion 固有の実装方法を**再定義しない**。`.tsx` を生成するときは公式 Skill のルールに従う。
  - 未インストールの場合：`npx skills add remotion-dev/skills` の実行を案内し、停止する。

## 実行モード

- **対話モード**：ユーザーが Claude Code の UI から直接呼び出した場合。生成計画を立てたら実行前に確認を求める。
- **headless モード**：`claude -p "create-advertisement skill で …"` から起動された場合。`--permission-mode acceptEdits` 前提で自動承認して進む。

## 入力

ユーザーが指定する：

1. **対象商品名**（複数可、または「全商品」=「`products/` 直下全部」）
2. （任意）特定フォーマット指定（例：「reel だけ」）
3. （任意）本数上書き
4. （任意）方向性指示（「Before/After 多めで」等）

## 処理フロー

### Step 0. ルール読み込み（必須）

最初に `rules/create-advertisement-rules.md` を Read tool で読み込む。
そこに書かれた R1〜R12 を**必ず適用**する。

### Step 1. 商品設定の読み込みと整合性チェック

各対象商品について：

1. `products/<name>/core.md` を読む（プレースホルダのままならエラー停止）
2. `products/<name>/config.yaml` を読む（`yaml` パッケージで parse）
3. `products/<name>/components/` の中身をリストアップ（空ならエラー停止し、Skill A 実行を案内）

R11 の整合性チェックに引っかかったら停止。

### Step 2. 着手前リサーチ（R6）

WebSearch / WebFetch で以下を軽く確認（合計 5〜10 分以内）：

- 「短尺広告 / リール バズる コツ 2026」
- 「視聴維持率 冒頭 3 秒 リール」
- 商品ジャンルに近い参考事例（必要に応じて）

得た知見はメモしておき、Step 3 の計画立案で参考にする。

### Step 3. 生成計画の立案

`config.yaml.formats.*.enabled` と `count` を読み、生成すべき動画/画像のリストを作る。

各アイテムについて以下を決める：

| 項目 | 決め方 |
|---|---|
| `id` | `reel-1`, `reel-2`, … 等の連番（type-index） |
| `type` | `reel` / `slide` / `horizontal` / `blog` |
| `variation_note` | `core.md` を踏まえて Claude が考える「他との違いの一言説明」 |
| シーン構成 | 紹介 → プロダクト画面 → 訴求 → CTA など |
| 主要エフェクト | R2 から最低 2 種選ぶ |
| BGM / 音声 | MVP では未対応（必要なら手動で `<Audio>` 追加） |

`config.yaml.variation.strategy: "auto"` の場合、5 本の方向性は Claude が `core.md` から導出。`manual` の場合は `manual_directions` をそのまま使う。

#### 対話モード時のユーザー確認（R12）

計画を箇条書きで提示してユーザーに承認を求める。修正要求があれば反映。

**ただし以下に該当する場合は確認をスキップして自律実行する**：

- プロンプトに `headless` / `自律実行` / `承認不要` / `auto` / `そのまま生成` 等の語がある
- 「最後まで」「停止せず」「全自動で」等の連続実行指示がある
- `claude -p` の 1 ターン実行と推察される文脈（プロンプトが完結していて対話前提でない）

`claude -p` は 1 ターン応答型なので、確認待ちにすると途中終了する。判断に迷う場合は計画を簡潔に提示しつつ**そのまま生成ループに入る**。

### Step 4. 各動画の生成ループ

R7 のループを各 item について実行する：

#### 4.1 Remotion `.tsx` を書く

- 配置先：`output/<product>/<YYYY-MM-DD>/<id>.tsx`
- 共通パーツ：`remotion/src/shared/{IPhoneFrame, TextOverlay, transitions}` から import
- 商品コンポーネント：`products/<name>/components/<Screen>` から相対 import

> **Remotion API の使い方（`useCurrentFrame`, `interpolate`, `Sequence`, `Composition` の宣言場所、`spring` の使いどころ等）は `remotion-dev/skills` のルールに従う。** 本 Skill 内で再定義しない。

#### 4.2 Composition を Root に登録

`remotion/src/Root.tsx` に当該 item 用の `<Composition>` を追加する。

- `id`: アイテムの `id`（例: `taskflow-reel-1`。productと衝突しないようプレフィックス推奨）
- `durationInFrames`: `duration_sec * fps`
- `fps`, `width`, `height`: `lib/remotion-helpers.ts` の `FORMAT_PRESETS` を使う

既に同 id が登録済みなら更新（重複登録は Remotion がエラーにする）。

#### 4.3 静止画検証

`pnpm exec remotion still <entry> <composition-id> <png-path> --frame=N` を 3 フレーム分実行：

- `frame: 0`（冒頭）
- `frame: floor(durationInFrames / 2)`（中間）
- `frame: durationInFrames - 1`（終了）

出力先：`output/<product>/<YYYY-MM-DD>/.frames/<id>-f0.png` 等

#### 4.4 視覚チェック

各 PNG を Read tool で読み、以下のチェックリスト（`lib/validators.ts` の `VISUAL_CHECKLIST`）に沿って判定：

- frame_overflow：要素がアスペクト比内に収まっている
- text_clipped：テキストが見切れていない、改行崩れがない
- z_index_misorder：重なり順が想定通り
- element_offscreen：画面外への飛び出しがない
- iphone_frame_overflow：iPhone フレーム使用時、フレーム内に UI が収まっている
- general_layout：明らかなレイアウト崩れ・色のバグがない

判定結果は `ValidationIssue[]` の構造で集約（`severity: "error" | "warning"`、`code`、`message` を持たせる）。

#### 4.5 コードチェック

`pnpm exec tsc --noEmit` を実行し、当該 `.tsx` にエラーがないか確認。

#### 4.6 修正ループ

問題があれば：

1. issues を踏まえて `<id>.tsx` を編集（位置・サイズ・スケール・タイミングの調整）
2. 4.3 へ戻って再 still
3. `config.yaml.validation.max_iteration`（デフォルト 3）回まで繰り返す

#### 4.7 上限超過時のスキップ（R8）

`max_iteration` 回試行しても解消しない場合：

- 当該 `.tsx` と `.frames/<id>-*.png` を削除（部分ファイルを残さない）
- `issues.json` に id / type / 最終 issues を追記
- 次の item へ進む（処理は止めない）

#### 4.8 本番レンダリング

すべて OK なら：

```bash
pnpm exec remotion render <entry> <composition-id> <output-mp4-path>
```

#### 4.9 プレビュー保存

レンダリング成功後、frame 0 の PNG を `<id>.preview.png` としてコピー（既に `.frames/<id>-f0.png` があれば再利用）。

#### 4.10 検証ログ保存

`<id>.validation.json` に以下を構造化保存：

```json
{
  "id": "taskflow-reel-1",
  "iteration": 2,
  "frames": [
    { "frame_label": "start", "frame_index": 0, "png_path": "...", "passed": true, "issues": [] }
  ],
  "overall": { "passed": true, "iterations": 2, "issues": [] }
}
```

#### 4.11 投稿コピーの生成（R13）

レンダリング成功後、`<id>.md` を同階層に書き出す。SNS 投稿（X / Instagram 等）用の素材であり、配信処理（R10）はしない。

入力として次を踏まえる：

- `products/<name>/core.md` の「ターゲット層」「訴求の軸」「ブランドトーン」「避けたい表現」
- 当該 item の `variation_note`、`type`、`duration_sec`、生成した `.tsx` のシーン構成

ファイル構造（R13 に従う）：

```markdown
---
id: <item-id>
product: <product>
type: <type>
generated_at: <ISO8601>
---

<フック1文（20〜45 文字、数字 / 意外性 / 二人称呼びかけのいずれか必須、句点で終える）>

<本文 2〜4 文、合計 200 文字以内、ブランドトーン準拠、variation_note の差別化軸を反映>

#tag1 #tag2 #tag3 #tag4 #tag5
```

書き出し要件：

- パス：`output/<product>/<date>/<id>.md`
- atomic に近い扱いをする（一時ファイル → rename）。`lib/manifest.ts` の `writeManifestAtomic` と同様の発想
- ハッシュタグは**必ず 5 本**、商品名タグを 1 本含み、半角スペース区切りで 1 行
- フックを `#` や絵文字で始めない / 45 文字超で始めない（R13 の規約に違反したら 1 回だけ書き直す。それでも違反したらこの `.md` をスキップ）

コピー生成だけが失敗した場合：

- `.md` は出力しない
- `issues.json` に `{ id, reason: "copy_generation_failed" }` を追記
- 動画 / preview / validation は通常通り残す（manifest 上で `copy` フィールドを省略）

### Step 5. manifest.json の生成（R9）

全 item の処理が**完了した後**に、`lib/manifest.ts` の `writeManifestAtomic` を使って一括書き出し。

`Structure.md` の Manifest スキーマ通り：

```json
{
  "product": "<name>",
  "generated_at": "<ISO8601>",
  "rules_version": "1.0.0",
  "items": [
    {
      "type": "reel",
      "id": "taskflow-reel-1",
      "file": "taskflow-reel-1.mp4",
      "preview": "taskflow-reel-1.preview.png",
      "copy": "taskflow-reel-1.md",
      "duration_sec": 25,
      "validation": { "passed": true, "iterations": 1, "issues": [] },
      "variation_note": "機能訴求中心。Dashboard を中心に複数プロジェクト管理の効率性を見せる流れ。"
    }
  ]
}
```

### Step 6. 中間ファイルのクリーンアップ

- `.frames/` 配下の検証用 PNG は基本残す（後追い検証のため）が、stict_mode 時は削除可
- 失敗した item の partial files は必ず削除
- 最終的な `output/<product>/<date>/` は manifest / 動画ファイル / `.md`（コピー生成が成功したもののみ）が揃っている状態にする

## アンチパターン（やらないこと）

R に書かれた禁則に加えて：

- ❌ Composition id を product 名なしで作る（複数商品で衝突する）
- ❌ `output/` の外にファイルを書く（gitignore からも外れる）
- ❌ 視覚チェックなしで render する
- ❌ 1 本がエラーになったら全体停止する
- ❌ 配信処理（git, gh, curl で SNS API、Slack 通知等）を「便利だから」追加する
- ❌ `core.md` を読まずに config だけで生成する
- ❌ Remotion 実装の詳細をこの SKILL.md 内で説明する（→ remotion-best-practices に委譲）

## ヘッドレス実行コマンド（cron 用）

```bash
cd /path/to/adcraft && \
  unset ANTHROPIC_API_KEY && \
  claude -p "create-advertisement skill で全商品の動画を生成して。承認不要、最後まで自律実行して。" \
    --permission-mode bypassPermissions \
    --max-turns 200 \
    --output-format stream-json --verbose \
    >> logs/$(date +%Y%m%d-%H%M%S).log 2>&1
```

**ヘッドレス実行で詰まらないためのポイント**：
- `bypassPermissions` を使う（`acceptEdits` だと `pnpm exec remotion still` 等の Bash で止まる）
- プロンプトに「承認不要、自律実行して」等を含める（R12 のユーザー確認をスキップさせる）
- `--output-format stream-json --verbose` で無音状態を回避

## エラーハンドリング

| 状況 | 対応 |
|---|---|
| `core.md` がプレースホルダのまま | 停止、ユーザーに記入を促す |
| `config.yaml` の YAML parse エラー | 停止、エラー位置を通知 |
| `components/` が空 | 停止、Skill A の実行を促す |
| `remotion-best-practices` 未インストール | 停止、`npx skills add remotion-dev/skills` を案内 |
| 1 本のレンダリングエラー | スキップして `issues.json` に記録、続行 |
| 視覚検証で max_iteration 超過 | スキップして `issues.json` に記録、続行 |
| 投稿コピー（`.md`）の生成失敗 | 当該 `.md` のみスキップ、`issues.json` に `copy_generation_failed` を追記、動画は残す |
| Claude Code トークン切れ | プロセス終了、外側スケジューラに任せる |
| `output/` 書き込み権限なし | 即停止、ユーザー通知 |
