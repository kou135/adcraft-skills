# adcraft 実装タスク分解

`Specification.md` と `Structure.md` に基づく実装計画。各タスクは「動作確認可能な単位」に分解。
完了したタスクには `[x]` を入れる。Phase 末尾でコミット。

---

## Phase 1: 基盤構築

### 1.1 リポジトリ基本ファイル
- [ ] 1.1.1 `.gitignore` を作成（`node_modules/`, `output/`, `logs/`, `.env*`, `remotion/src/compositions/*` 等）
- [ ] 1.1.2 `LICENSE`（MIT、Copyright Kota Suzuki）を作成
- [ ] 1.1.3 `THIRD_PARTY_LICENSES.md` を作成（Remotion Free/Company 警告含む）
- [ ] 1.1.4 `package.json` を作成（pnpm 想定、Node `>=20.0.0`、Remotion `^4.x` 等）
- [ ] 1.1.5 `tsconfig.json` を作成（ES2022 / react-jsx / strict / bundler）
- [ ] 1.1.6 `pnpm install` で依存解決成功を確認

### 1.2 ディレクトリスケルトン
- [ ] 1.2.1 `skills/extract-product-ui/` と `skills/create-advertisement/` を作成（SKILL.md は Phase 2/3 で執筆）
- [ ] 1.2.2 `rules/`、`lib/`、`templates/`、`products/`、`output/`、`docs/` を作成（必要に応じ `.gitkeep`）
- [ ] 1.2.3 `examples/product-sample/` のディレクトリ枠（中身は Phase 4）

### 1.3 Remotion 最小セットアップ
- [ ] 1.3.1 `remotion/remotion.config.ts` を作成（postcss / Tailwind 有効化の設定）
- [ ] 1.3.2 `remotion/src/Root.tsx` を作成（最小 Composition 登録のみ）
- [ ] 1.3.3 `remotion/src/compositions/.gitkeep` を配置
- [ ] 1.3.4 `remotion/src/shared/` ディレクトリを作成（中身は Phase 3）

### 1.4 共通ユーティリティ雛形
- [ ] 1.4.1 `lib/manifest.ts`：`manifest.json` の型定義 + atomic write 関数
- [ ] 1.4.2 `lib/validators.ts`：視覚検証結果の型定義 + JSON 出力ヘルパー
- [ ] 1.4.3 `lib/remotion-helpers.ts`：共通の Composition 登録ヘルパーの空骨子

### 1.5 視覚検証フローの実証（重要）
- [ ] 1.5.1 最小の検証用 Composition を作成（`remotion/src/shared/_DemoSquare.tsx` などダミー名）
- [ ] 1.5.2 `pnpm exec remotion still` で 1 フレームの PNG を出力し、出力に成功することを確認
- [ ] 1.5.3 私（メイン Claude）が Read tool でその PNG を読み、画像として認識できるかを確認
- [ ] 1.5.4 Explore サブエージェントに同じ PNG を Read させて、独立に画像認識可能か検証
- [ ] 1.5.5 結果を `tasks.md` の末尾に「視覚検証実証ログ」として残し、設計続行可否を判断

### 1.6 Phase 1 締め
- [ ] 1.6.1 `pnpm exec tsc --noEmit` が通ることを確認
- [ ] 1.6.2 進捗報告 + Phase 1 を `feat: phase 1 foundation` でコミット

---

## Phase 2: Skill A — `extract-product-ui`

### 2.1 SKILL.md 執筆
- [ ] 2.1.1 frontmatter（name / description）+ 本文を `skills/extract-product-ui/SKILL.md` に記述
- [ ] 2.1.2 description にトリガーワードを盛り込む（「商品UIを抽出」「Next.jsプロダクトから動画用UI抽出」等）

### 2.2 抽出ワークフロー定義
- [ ] 2.2.1 入力（実プロダクトパス / 商品名）と確認フロー（画面選択をユーザーに必ず確認）の手順を SKILL.md に明文化
- [ ] 2.2.2 抽出時の置換ルール（API 呼び出し→`// TODO: replaced with mock data`、認証ガード除去 等）を明文化
- [ ] 2.2.3 Tailwind / globals.css のコピー手順を明文化（不在時はテンプレからコピー）
- [ ] 2.2.4 「既存 `core.md` / `config.yaml` 上書き禁止」「`components/` 既存ファイルは差分提示後に確認」を強調

### 2.3 テンプレート整備
- [ ] 2.3.1 `templates/core.md.template` を作成
- [ ] 2.3.2 `templates/config.yaml.template` を作成（仕様書のスキーマ通り）
- [ ] 2.3.3 `templates/components/_shared/tailwind.config.js` を作成
- [ ] 2.3.4 `templates/components/_shared/globals.css` を作成

### 2.4 Phase 2 締め
- [ ] 2.4.1 `tsc --noEmit` 通過確認
- [ ] 2.4.2 `feat: phase 2 extract-product-ui skill` でコミット

---

## Phase 3: Skill B — `create-advertisement`

### 3.1 ルールファイル執筆
- [ ] 3.1.1 `rules/create-advertisement-rules.md` を作成
  - ゴール、不変ルール（実プロダクト画面必須、エフェクト必須、20〜30秒、5本バリエーション、iPhone フレーム共通化）
  - 着手前 WebSearch（バズる短尺動画のコツ）を実行する旨
  - 視覚検証（`remotion still` + Claude 画像読み込み）の手順
  - 修正ループ最大3回、issues.json にスキップ理由を記録
  - 配信は責務外
  - 受入基準（動画 5 本 / 視覚 OK / エラーなし / iPhoneフレーム共通化）

### 3.2 Skill B SKILL.md
- [ ] 3.2.1 frontmatter + 本文を `skills/create-advertisement/SKILL.md` に記述
  - 冒頭で `remotion-best-practices` への依存を明記
  - 必ず最初に rules を読む手順
  - 商品設定読込 → 計画立案 → 生成ループ → manifest.json まで明文化

### 3.3 Remotion 共通コンポーネント
- [ ] 3.3.1 `remotion/src/shared/IPhoneFrame.tsx`：内側に children を取る iPhone フレーム
- [ ] 3.3.2 `remotion/src/shared/TextOverlay.tsx`：オーバーレイテキスト（fade / slide）
- [ ] 3.3.3 `remotion/src/shared/transitions.tsx`：fade / slide / zoom 等の trans helper
- [ ] 3.3.4 各コンポーネントが Phase 1 の still 出力で破綻しないことを確認

### 3.4 視覚検証ループ実装
- [ ] 3.4.1 `lib/validators.ts` に検証チェックリスト（要素のフレーム内収まり、テキスト改行、z-index、画面外飛び等）を構造化して定義
- [ ] 3.4.2 SKILL.md に「PNG を Read → 構造化判定 → 問題があれば修正コードを生成 → 再 still → 再判定」のループ手順を記述
- [ ] 3.4.3 修正ループ上限（`config.yaml.validation.max_iteration` デフォルト 3）の参照ルートを定義
- [ ] 3.4.4 上限超過時 `issues.json` に記録してスキップする手順を明記

### 3.5 manifest.json 生成
- [ ] 3.5.1 `lib/manifest.ts` の atomic write を仕上げ（一時ファイルに書いて rename）
- [ ] 3.5.2 SKILL.md に「最後にまとめて書く / 中断時は部分状態を残さない」を明記

### 3.6 Phase 3 締め
- [ ] 3.6.1 `tsc --noEmit` 通過確認
- [ ] 3.6.2 `feat: phase 3 create-advertisement skill` でコミット

---

## Phase 4: サンプル & ドキュメント

### 4.1 サンプル商品（TaskFlow）
- [ ] 4.1.1 `examples/product-sample/components/SampleDashboard.tsx` を作成（Tailwind ベースのダッシュボード）
- [ ] 4.1.2 `examples/product-sample/components/SampleTaskList.tsx` を作成（タスクリスト画面）
- [ ] 4.1.3 `examples/product-sample/components/_shared/tailwind.config.js`、`globals.css` を配置
- [ ] 4.1.4 `examples/product-sample/core.md`（マーケ方針記入済み）を作成
- [ ] 4.1.5 `examples/product-sample/config.yaml`（reel: 5本 / 9:16 / 25秒 等）を作成
- [ ] 4.1.6 `examples/product-sample/assets/` にサンプル PNG を 1 枚配置（任意）

### 4.2 サンプルでの動作確認
- [ ] 4.2.1 サブエージェントに対して Skill B の手順に沿って `examples/product-sample` で 1 本だけ MP4 を生成させる検証
- [ ] 4.2.2 生成された動画 / preview.png / validation.json / manifest.json の構造が仕様通りか手動確認
- [ ] 4.2.3 必要に応じて SKILL.md / rules を微修正

### 4.3 ドキュメント
- [ ] 4.3.1 `README.md`：概要 / 前提（公式 Skill インストール手順）/ クイックスタート / ライセンスセクション
- [ ] 4.3.2 `docs/getting-started.md`
- [ ] 4.3.3 `docs/core-md-guide.md`
- [ ] 4.3.4 `docs/config-yaml-schema.md`
- [ ] 4.3.5 `docs/customizing-rules.md`

### 4.4 受入基準確認（仕様書 16 項目）
- [ ] 4.4.1 `pnpm install` 一発で依存解決
- [ ] 4.4.2 README に `npx skills add remotion-dev/skills` 明記
- [ ] 4.4.3 README にライセンスセクション + Remotion 注意喚起
- [ ] 4.4.4 LICENSE / THIRD_PARTY_LICENSES.md 配置
- [ ] 4.4.5 THIRD_PARTY_LICENSES に Remotion Free/Company の明記
- [ ] 4.4.6 Remotion 本体ソースが含まれていない
- [ ] 4.4.7 サンプルで Skill B が動く
- [ ] 4.4.8 任意 Next.js プロジェクトで Skill A が動く想定の手順記載
- [ ] 4.4.9 Skill A 再実行で `core.md` / `config.yaml` が保護される旨が rules / SKILL.md に明記
- [ ] 4.4.10 視覚検証ループが動く
- [ ] 4.4.11 5 本に説明可能なバリエーション
- [ ] 4.4.12 manifest.json スキーマ通り
- [ ] 4.4.13 `claude -p` headless で発火可能（README にコマンド例）
- [ ] 4.4.14 30 分で sample が動く README
- [ ] 4.4.15 `tsc --noEmit` パス
- [ ] 4.4.16 配信ロジックが含まれていない（grep で確認）

### 4.5 Phase 4 締め
- [ ] 4.5.1 全タスクのコミット履歴整理
- [ ] 4.5.2 `chore: docs and sample finalization` でコミット

---

## 視覚検証実証ログ（Phase 1.5 完了）

検証条件：`remotion/src/shared/_DemoSquare.tsx`（9:16 / 90 frames / 30fps、赤い角丸正方形が左→右へ移動 + "adcraft demo" テキスト）の frame 30 を `pnpm exec remotion still` で `/tmp/adcraft-still-test/frame-30.png` に出力。

- **メイン Claude の PNG 読み込み**：✅ 成功。アスペクト比（9:16）、背景色（黒）、要素の位置・色（中央左寄りの赤い角丸正方形、グロー付き）、テキスト内容（"adcraft demo"）まで正確に認識。
- **サブエージェント（Explore）の PNG 読み込み**：✅ 成功。同様に全要素を独立に認識。色値の推定（#FF5555 程度）まで報告。
- **結論**：両方の経路で視覚検証が成立する。Skill B は **メイン Claude が直接 PNG を Read** する設計を採用（subagent は並列検証時のオプションとして将来拡張）。
- **採用設計**：
  - `npx remotion still --frame=N` で複数フレーム（0 / 中間 / 終了）を `output/<product>/<date>/.frames/<id>-fN.png` に出力
  - メイン Claude が各 PNG を Read tool で読み、`VISUAL_CHECKLIST` に沿って判定
  - 問題があれば修正 → 再 still → 再判定（最大 3 回）
  - 結果は `<id>.validation.json` に構造化保存


