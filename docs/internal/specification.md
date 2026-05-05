# 広告動画自動生成 Skill — 仕様書

## プロジェクト概要

Claude Code向けのSkillとしてOSS公開する、広告動画自動生成システム。
Remotionをベースに、ユーザーの実プロダクト画面を組み込んだ広告動画（Instagram/TikTokリール、スライド広告画像、X/PC用横長動画、ブログ）を自律的に生成する。

ユーザーは自分のプロダクトのマーケ方針と設定を書くだけで、Claude Codeが自律ループ（生成 → 視覚検証 → 自己修正 → 次の動画）で複数本の広告素材を生成できる。

生成物はローカルの `output/` ディレクトリに蓄積される。配信先（GitHub、管理画面、各種SNS API等）は本Skillの責務外とし、ユーザー側で別途実装する設計。

## 依存するSkill

本プロジェクトは Remotion公式の Agent Skill に依存する。

- **`remotion-dev/skills`（remotion-best-practices）**：Remotion実装のドメイン知識。アニメーション、Composition、Sequencing、アセット管理等の正しい使い方を Claude Code に提供する。利用者は本Skillとは別に事前インストールする。

本プロジェクトの2つのSkillはこの公式Skillが提供するRemotion実装知識に依存して動作する。Remotion固有の実装方法を本プロジェクト内で再定義しない。

## ライセンス方針

本プロジェクト本体は **MIT License** で公開する。

ただし依存ライブラリの **Remotion は独自の二層ライセンス**（Free License / Company License）を採用しているため、利用者は組織サイズに応じて適切なライセンスを取得する義務がある。

- **Free License対象**：個人、従業員3人以下のfor-profit組織、非営利団体、評価段階のユーザー
- **Company License必要**：上記に該当しないfor-profit組織（4人以上）

本プロジェクトは Remotion を **npm依存として宣言するのみ**で、ソースコードの再配布は行わない。利用者が `npm install` 時に各自取得する形態とすることで、Remotionライセンスの再配布禁止条項に抵触しないようにする。

利用者への周知のため、以下のファイルをリポジトリに含める：
- `LICENSE`：本プロジェクトのMITライセンス
- `THIRD_PARTY_LICENSES.md`：依存ライブラリのライセンス情報（Remotionの独自ライセンス注意喚起を含む）
- `README.md` 内のライセンスセクション：上記の要約と利用者への注意喚起

## 提供する2つのSkill

### Skill A: `extract-product-ui`

**役割**
ユーザーの実プロダクト（Next.js等）のソースコードから、動画用に使えるUI層（純粋なプレゼンテーショナルコンポーネント）を抽出する。

**実行頻度**
- 商品の新規追加時
- 実プロダクトのUI大型更新時
- つまり「たまにしか使わない」

**入力**
- ユーザーの実プロダクトのリポジトリパス
- 商品名

**処理内容**
1. 対象リポジトリの構造を解析し、主要画面コンポーネントをリストアップ
2. ユーザーに動画化対象の画面を確認
3. 各コンポーネントから以下を除去・置換：
   - API呼び出し（fetch、API client等)
   - 認証ガード
   - グローバルステート依存
   - サーバーサイド専用ロジック
4. ダミーデータをpropsで受け取る純粋コンポーネントに変換
5. Tailwind config・globals.cssを共有領域にコピー
6. `products/<product-name>/components/` に配置
7. `products/<product-name>/core.md` と `config.yaml` のひな形を生成

**出力**
```
products/<product-name>/
├── components/
│   ├── <Screen1>.tsx
│   ├── <Screen2>.tsx
│   └── _shared/
│       ├── tailwind.config.js
│       └── globals.css
├── core.md           # ひな形（ユーザーが後で編集）
├── config.yaml       # ひな形（ユーザーが後で編集）
└── assets/           # 空ディレクトリ
```

**再実行時の挙動**
既存の `core.md` と `config.yaml` は上書きしない。`components/` のみ差分更新。

---

### Skill B: `create-advertisement`

**役割**
`products/<product-name>/` の設定とUI素材を使って、Remotionで広告動画を複数本生成し、視覚検証・自己修正を経てMP4出力する。生成物はローカルの `output/` ディレクトリに配置する。

**実行頻度**
- MVPフェーズ：手動発火（ユーザーがClaude Codeに直接依頼）
- 運用フェーズ：cron / PM2 / GitHub Actions から定期発火（5時間おき等）

**入力**
- 対象商品名（複数可、または「全商品」指定）
- オプション：特定フォーマット指定、本数上書き、方向性指示

**処理内容（自律ループ）**
1. `rules/create-advertisement-rules.md` を読み込み（不変ルール）
2. 対象商品の `core.md` と `config.yaml` を読み込み
3. `components/` 配下のUIコンポーネントを把握
4. 生成計画を立案（本数 × フォーマット）
5. 各動画/画像について以下のループを実行：
   - Remotion `.tsx` を `output/<product>/<date>/` に生成
     - Remotion固有の実装は `remotion-best-practices` Skillの知識に従う
   - `npx remotion still` で複数フレーム（0s / 中間 / 終了）をPNG出力
   - 出力PNGを画像として読み、視覚チェック実施
   - `tsc` と `lint` でコードエラーチェック
   - 問題があれば修正（最大3回ループ、`config.yaml` で設定可）
   - 視覚OK + コードOKになったら `npx remotion render` でMP4出力
6. 全成果物を `output/<product>/<YYYY-MM-DD>/` に配置
7. `manifest.json` を生成（メタデータ・検証結果集約）

**視覚検証のチェック項目**
- 全要素が想定アスペクト比（9:16等）の枠内に収まっている
- テキストが見切れていない、改行崩れがない
- z-index重なりが想定通り
- アニメーション中に要素が画面外に飛んでいない
- iPhoneフレーム使用時、フレーム内に全UIが収まっている

**動画間のバリエーション**
1本ずつ流れ・訴求軸・構成を変える。
ルール上の例：
- 1本目：機能訴求中心
- 2本目：問題解決訴求
- 3本目：Before/After 構成
- 4本目：ユーザーストーリー
- 5本目：価格・差別化訴求

ただし機械的な型当てはめではなく、「Claudeが根拠を持って差を説明できる」粒度でバリエーションを持たせる。

**修正ループの上限**
3回試行しても視覚問題が解消しない場合は、`issues.json` に記録して人間レビューに回す（その動画はスキップ、他は継続）。

**配信は責務外**
生成物の配信（GitHub push、管理画面連携、SNS投稿等）は本Skillの責務外。`output/` に配置するところまでで完了とする。配信が必要な場合は外部スクリプトやSkillで `output/` を読み取って処理する設計。

**出力**
```
output/<product>/<YYYY-MM-DD>/
├── reel-1.tsx
├── reel-1.mp4
├── reel-1.preview.png       # サムネイル
├── reel-1.validation.json   # 検証ログ
├── reel-2.tsx
├── ...
├── slide-1.tsx
├── slide-1.png
├── ...
├── manifest.json            # 生成メタデータ
└── issues.json              # 修正ループで解消できなかった問題
```

`manifest.json` の内容：
```json
{
  "product": "TaskFlow",
  "generated_at": "2026-05-04T14:00:00Z",
  "items": [
    {
      "type": "reel",
      "file": "reel-1.mp4",
      "duration_sec": 25,
      "validation": { "passed": true, "iterations": 1, "issues": [] },
      "variation_note": "機能訴求中心"
    }
  ]
}
```

---

## 利用ユーザーのジャーニー

### Day 0（5分）
1. Remotion公式 Agent Skill をインストール
   ```bash
   npx skills add remotion-dev/skills
   ```
2. 本プロジェクト（adcraft）を `git clone` し、依存をインストール
3. README のライセンスセクションを確認し、Remotion Company License が必要か判断する

### Day 1（30分）
1. README を読む
2. `examples/product-sample` を Skill B で動かしてサンプル動画を出力

### Day 2（1〜2時間）
1. 自分のプロダクト1つを Skill A で抽出
2. `core.md` にマーケ方針を記入
3. `config.yaml` を編集
4. Skill B で5本生成、品質確認

### Day 3〜7
1. `core.md` の表現を磨く
2. 必要なら `rules` をフォークしてカスタマイズ
3. 品質が安定するまで手動で何度か発火

### Week 2以降
1. cron / PM2 / GitHub Actionsで自動運用
2. 商品を追加していく
3. 必要に応じて `output/` を読み取る配信スクリプトを別途実装

---

## 設計思想

### 「変わる部分」と「変わらない部分」の分離
- **変わらない（OSSコア）**：`SKILL.md`、`rules/`、Skillスクリプト本体
- **変わる（ユーザー領域）**：`products/<name>/core.md`、`config.yaml`、`components/`、`assets/`
- **生成物（git管理外）**：`output/`

### 責務の分離（依存Skillと自Skillの境界）
- **`remotion-best-practices`（公式Skill）の責務**：Remotionの正しい使い方の知識
- **`extract-product-ui`（本Skill）の責務**：実プロダクトUIの動画用変換
- **`create-advertisement`（本Skill）の責務**：商品設定に基づく広告動画ワークフロー
- **本Skillの責務外**：配信、投稿、DB連携、管理画面、Git push

### マーケ方針（散文）と機械設定（構造化データ）の分離
- `core.md`：人間が文章で書く（ターゲット層、訴求軸、ブランドトーン）
- `config.yaml`：機械が読む（本数、フォーマット有効化、検証設定）

### Skillの単一責任
- Skill AはUI抽出のみ
- Skill Bは動画生成のみ
- 両者の連携は`products/<name>/`という共有ディレクトリ経由（疎結合）
- 配信レイヤーは Skill 外

### 自律ループは Claude Code の Auto Mode を活用
- `claude -p` のheadlessモードで cron 発火可能
- `--permission-mode acceptEdits` でファイル書き込みを自動承認
- `--max-turns 200` で長時間自律動作

### 視覚検証は Remotion 自身で完結
- `npx remotion still` でフレーム画像出力
- Claudeが画像として直接読み判定
- Playwright等のブラウザ自動化は本Skill内では不要

---

## 技術スタック

### 必須依存
- Node.js 20+
- Remotion（最新安定版）— **npm依存として宣言、ソース同梱はしない**
- TypeScript
- ffmpeg（Remotion依存）
- Claude Code（Pro/Max サブスク or APIキー）
- **`remotion-dev/skills`（Remotion公式 Agent Skill）— 事前インストール必須**

### 推奨追加
- `@remotion/player`：将来の管理画面プレビュー埋め込み用
- `@remotion/google-fonts`：フォント
- `@remotion/transitions`：シーン切替

### Phase 2 候補（本Skill外）
- `@remotion/lambda`：並列レンダリング
- 配信アダプタ（GitHub / S3 / TikTok API / Instagram API 等）
- 管理画面連携

---

## OSS公開時のスコープ

### 含めるもの
- 2つのSkill（`extract-product-ui`、`create-advertisement`）
- ルールファイル（`rules/create-advertisement-rules.md`）
- READMEとドキュメント（依存Skillのインストール手順を含む）
- `LICENSE`（MITライセンス）
- `THIRD_PARTY_LICENSES.md`（依存ライブラリのライセンス情報・Remotionの独自ライセンス注意喚起）
- サンプル商品（`examples/product-sample/`）
- `.gitignore`、`package.json`
- Remotionプロジェクト設定（`remotion/` 配下のあなたが書いた設定・共通パーツ。Remotion本体ソースは同梱しない）

### 含めないもの
- Remotion実装の詳細知識（→ `remotion-dev/skills` に委譲）
- Remotionのソースコード自体（→ npm依存として宣言）
- 配信ロジック（GitHub push、SNS投稿、管理画面連携 等）
- 管理画面（Web UI）
- DB連携コード
- cronスケジューラ設定
- 認証フロー

これらはユーザーごとに要件が異なるため、Skillの責務は「動画ファイルを生成して `output/` に配置するまで」とする。

---

## MVP完了の定義

以下が達成できればMVP完了：

1. 利用者が `npx skills add remotion-dev/skills` で公式Skillを導入できる
2. 本リポジトリを `git clone` した状態から `npm install` 一発で依存解決できる
3. `examples/product-sample` を Skill B で実行すると、サンプル動画が `output/` に出力される
4. 利用者が自分のプロダクトを Skill A で抽出できる
5. `core.md` と `config.yaml` を編集後、Skill B で動画が生成される
6. 視覚検証ループが動作し、明らかな崩れは自己修正される
7. 5本の動画それぞれにバリエーションがある
8. `manifest.json` がスキーマ通りに生成される
9. Claude Codeのheadlessモード（`claude -p`）から Skill B が発火可能
10. README に従って未経験ユーザーが30分で `examples/product-sample` を動かせる
11. README にライセンスセクションがあり、Remotion独自ライセンスへの注意喚起が含まれている
12. `LICENSE` と `THIRD_PARTY_LICENSES.md` がリポジトリルートに配置されている
13. `tsc --noEmit` がエラーなく通る

---

## 非ゴール（やらないこと）

- 動画の「広告として刺さるか」の主観品質判定
- ピクセル単位の精密な視覚差分検出
- 完全な実プロダクト再現（あくまで動画用簡略再現）
- ブラウザ自動操作（Playwrightは別Skill扱い）
- 音声合成・ナレーション生成（Remotion `<Audio>` で既存音声ファイルを使うのみ）
- 配信・投稿（生成物を `output/` に置くまでが本Skillの責務）
- Git push・GitHub PR 作成（責務外）
- Remotion実装知識の再定義（`remotion-dev/skills` に委譲）

---

## 将来の拡張案（**本MVPスコープ外**・参考情報）

以下は将来的な拡張アイデアであり、**本プロジェクトのMVPでは実装しない**。設計判断の理由として「現構造でこれらが拡張可能であること」を確認しておくのみ。

### 配信レイヤーの拡張（独立Skill方式）

将来的に「生成した動画を自動でGitHubにpush / TikTok APIで投稿 / 管理画面DBに登録」等の配信機能を追加したくなった場合、以下の方針を推奨：

**新規 Skill `publish-advertisement` を `skills/` 配下に追加する**

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

**この方式のメリット**

- 既存2Skillに**1行も変更を加えずに**配信機能を追加できる
- `output/` ディレクトリと `manifest.json` を中立なハンドオフポイントとして使うため、生成と配信が完全に疎結合
- 配信先ごとにアダプタを増やせる（責務分離）
- 利用者は「配信は使わない」「GitHubだけ使う」「全部使う」を自由に選べる
- Skillの単一責任原則を維持できる

**`config.yaml` の拡張パターン**

後方互換を保ちつつ、optional な `publish:` セクションを追加可能：

```yaml
# 既存ユーザーには影響なし。配信を使う場合のみ記述
publish:
  adapter: github
  github:
    branch_prefix: ad/
    auto_pr: true
  approval:
    required: true
```

**配信レイヤー以外の拡張ポイント**

| 拡張ポイント | 現構造での対応方法 |
|------------|------------------|
| 新フォーマット追加（Stories等） | `config.yaml.formats` に追加・`rules` に方針追記 |
| 動画生成エンジン変更（Higgsfield等） | `config.yaml` に `engine:` フィールド追加してSkill B内で分岐 |
| 並列実行制御 | scheduler スクリプトを別途用意（`claude -p` の並列起動） |
| 承認フロー | `manifest.json` に `approval_status` 追加、配信Skill側で参照 |

これらはすべて **MVPでは実装しない**。MVPで品質を固めた後、必要性が確認できたタイミングで段階的に追加する。