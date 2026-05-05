# create-advertisement Rules

> **Skill `create-advertisement` の不変ルール（v1.0.0）**
>
> Skill B は実行のたびに**まず**このファイルを読み込み、内容に従って動画生成を行う。
> ユーザーがフォークしてカスタマイズすることも想定されているが、本ファイルの**意図**を踏襲することを推奨する。
>
> 本ファイルの version は `manifest.json` の `rules_version` に記録される。

## ゴール

- ユーザーの実プロダクト UI を組み込んだ、X / Instagram で配信できる短尺広告動画を **5 本** 生成する
- 5 本それぞれが説得力ある「違い」を持つこと（型当てはめではなく、Claude が根拠を持って差を説明できる粒度）
- 視覚的に崩れがなく、即配信可能な品質であること
- 配信は本 Skill の責務外。`./output/<product>/<YYYY-MM-DD>/` に成果物を配置するまでで完了

## パス解決の前提

本 Skill 内で `./output/`、`./products/`、`./remotion/` 等の相対パスは、**すべて Claude Code を起動したカレントワーキングディレクトリ（CWD）基準**で解決する。プラグインインストール経由（`~/.claude/plugins/cache/...`）であっても**プラグインキャッシュ内には書かない**こと。利用者の作業リポジトリ内の `./output/` に書く。

`config.yaml.output.base_dir` が指定されている場合は、CWD からの相対パスとして解釈する（例：`./output`、`../shared-output` 等）。絶対パスも許容。

## 不変ルール

### R1. 動画長

- 1 本あたり **20〜30 秒**（`config.yaml.formats.reel.duration` に従うが、25 秒前後を推奨）
- 短すぎる（10 秒未満）または長すぎる（45 秒超）動画は生成しない

### R2. 必須要素

すべての動画に以下を必ず含める：

- **ユーザーの実プロダクト画面のシーン**（`products/<name>/components/` から import した実コンポーネントを描画する。ダミー画像で代替しない）
- **オリジナルの紹介画面**（タイトルやキャッチコピーのテキスト主体のシーン）
- **アクティブなエフェクト**：実プロダクト画面に対して以下のうち**最低 2 種類**を組み合わせる
  - クリック演出（カーソル / タップリングのアニメーション）
  - ズームイン / ズームアウト
  - スクロール演出
  - パン / フォーカス移動
  - シーケンシャルなハイライト

### R3. iPhone フレーム

- 実プロダクト画面を表示するシーンでは、`remotion/src/shared/IPhoneFrame.tsx` を使ってフレームに収めることを基本とする
- 横長フォーマット（16:9）の場合は不要
- フレーム内に UI が収まりきらない場合は縮小やスクロールを使う（はみ出し禁止）

### R4. アスペクト比

- リール（X / Instagram 向け）は **9:16**（1080 x 1920）
- 横長は 16:9（1920 x 1080）。`config.yaml` で個別指定された比率を優先

### R5. バリエーション

5 本それぞれ、流れ・訴求軸・構成のうち少なくとも 1 つを変える。例：

- 1 本目：機能訴求中心
- 2 本目：問題解決訴求（「こんな経験ない？」型）
- 3 本目：Before / After 構成
- 4 本目：ユーザーストーリー / 1 日の使用シーン
- 5 本目：差別化 / 価格訴求

ただし**機械的な型当てはめは禁止**。`config.yaml.variation.strategy: "auto"` の場合、Claude が `core.md` を読んで、その商品にフィットする 5 つの方向性を**自分で考えて根拠を持って**選ぶ。`manual` の場合は `manual_directions` をそのまま使う。

### R6. 着手前の事前リサーチ

生成計画を立てる**前に**、WebSearch / WebFetch で以下を軽く確認する：

- 「短尺広告 / リール バズる コツ」関連の最新情報
- 視聴維持率を高める冒頭 3 秒のコツ
- 商品ジャンルに近い参考事例

リサーチ結果は計画立案の根拠として使うが、深追いはしない（5〜10 分以内）。

### R7. 各動画の生成ループ

1 本につき以下のループを実行する：

1. **計画**：variation を踏まえてシーン構成・台詞・エフェクトを決める
2. **生成**：`./output/<product>/<date>/<id>.tsx` に Remotion `.tsx` を書く
   - Remotion API（`useCurrentFrame`, `interpolate`, `Sequence`, `Composition` 等）の使い方は `remotion-best-practices` Skill のルールに従う
   - 共通パーツ（iPhoneFrame, TextOverlay, transitions）は `remotion/src/shared/` から import
   - 商品コンポーネントは `products/<name>/components/` から相対 import
3. **Composition 登録**：`remotion/src/Root.tsx` に当該動画用の Composition を追加（既に登録済みの id があるなら更新）
4. **静止画検証**：`pnpm exec remotion still <entry> <id> <png-path> --frame=N` で複数フレーム（0 / 中間 / 終了）を `.frames/` に出力
5. **視覚チェック**：Claude が PNG を Read tool で読み、`VISUAL_CHECKLIST`（`lib/validators.ts`）に沿って判定
6. **コードチェック**：`pnpm exec tsc --noEmit` で当該ファイルにエラーがないか確認
7. **修正ループ**：問題があれば `<id>.tsx` を修正 → 4 へ戻る（最大 `config.yaml.validation.max_iteration` 回、デフォルト 3）
8. **本番レンダリング**：すべて OK なら `pnpm exec remotion render <entry> <id> <mp4-path>` で MP4 出力
9. **プレビュー保存**：`<id>.preview.png` として 1 フレーム目を保存
10. **検証ログ保存**：`<id>.validation.json` に構造化結果を保存

### R8. 修正ループの上限超過

`max_iteration` 回試行しても視覚問題が解消しない動画は：

- その動画は**スキップ**（部分ファイルを残さず削除）
- `issues.json` に「id / type / 最終 iteration / 残った issues」を追記
- 他の動画は通常通り処理を続行（1 本の失敗が全体を止めない）

### R9. manifest.json の生成

- 全動画の処理が完了した最後にまとめて書く
- atomic write（`lib/manifest.ts` の `writeManifestAtomic`）を使う
- 中断時に partial state を残さない

### R10. 配信は責務外

以下の処理は**実装しない**。要求されても丁寧に断る：

- Git push / commit
- GitHub PR 作成
- TikTok / Instagram / X API 投稿
- 管理画面 / DB への登録
- Slack 通知 等の外部連携

成果物を `./output/` に配置したら完了とする。配信が必要なユーザーは別途スクリプトを用意する設計。

### R11. 商品設定の整合性チェック

実行開始時に以下を確認し、矛盾があればユーザーに通知して停止：

- `core.md` がプレースホルダのまま（ひな形未編集）
- `config.yaml` の必須フィールド欠落
- `components/` が空（→ Skill A の実行を促す）
- `formats.*.enabled` がすべて false

### R12. 手動実行時のユーザー確認

対話モード（Claude Code UI から手動で呼び出された場合）では：

- 生成計画（5 本の方向性）を立てたら**実行前にユーザー確認を求める**
- ユーザーが承認したら生成ループに入る
- 計画の修正要求があれば反映してから再確認

ただし以下のいずれかの条件が満たされる場合は、**ユーザー確認をスキップして自律実行する**：

1. ユーザーのプロンプトに `headless` / `自律実行` / `承認不要` / `auto` / `そのまま生成` 等のキーワードが含まれる
2. ユーザーのプロンプトに「最後まで」「停止せず」「全自動で」等の連続実行を示す表現がある
3. ユーザーが事前に「承認は不要、走り切って」と明示した

`claude -p` のヘッドレス実行は 1 ターンで応答を返す仕様なので、上記キーワードを含めることで途中で止まらず最後まで実行できる。

判断に迷う場合は、計画を箇条書きで簡潔に提示しつつ、**そのまま生成ループに入る**（待機しない）。

## 受入基準（このルールに従って生成された成果物の合格条件）

1. `./output/<product>/<date>/` に MP4 が（reel 設定なら）5 本配置されている
2. 各動画が R2 の必須要素（実プロダクト画面 + オリジナル紹介 + 2 種以上のエフェクト）を含む
3. 視覚チェックがすべて pass している（または `issues.json` で明示的にスキップが説明されている）
4. `tsc --noEmit` がエラーなく通る
5. `manifest.json` が `Structure.md` のスキーマ通り
6. iPhoneFrame が縦長動画で使われ、フレーム内に UI が収まっている
7. 5 本それぞれの `variation_note` に Claude が言語化した「他の 4 本との違い」が記述されている

## アンチパターン

- ❌ 動画ごとに iPhone フレームを毎回違うサイズで実装する（共通コンポーネントを使うこと）
- ❌ 視覚チェックをスキップして即 render する
- ❌ 動画 1 本でクラッシュしたら全体を止める
- ❌ `core.md` を無視して config だけで生成する（マーケ方針が反映されない）
- ❌ Remotion 実装の細かい使い方を本 Skill 内で考え込む（→ `remotion-best-practices` に委譲）
- ❌ 配信処理を「ついでに」実装する
- ❌ 失敗した中間ファイルを `./output/` に残したまま終了する
