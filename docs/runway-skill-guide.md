# Skill D 運用ガイド — create-advertisement-with-runway

> Skill D は Runway MCP（`gpt_image_2` / `gen4_image` + `seedance2` / `gen4_turbo` 等）と
> ElevenLabs MCP（TTS）を統合し、**実写級ビジュアル + ナレーション付き**の広告動画を生成する。
> Skill C（higgsfield 版）と同型のパイプラインで、生成バックエンドだけ Runway に差し替えたもの。
> 外部 AI サービスへの課金が発生する。

## いつ Skill D を使うか

| 状況 | 推奨 |
|---|---|
| 試運転 / 無料 / イラスト系 | Skill B (`create-advertisement`) |
| 量産（月 10 本以上、コスト 0）| Skill B |
| Higgsfield アカウントで実写級を作りたい | Skill C (`create-advertisement-with-higgsfield`) |
| **Runway アカウント / Runway Developer API で実写級を作りたい** | **Skill D** |
| Runway native モデル（gen4_turbo / gen4_image）の品質を使いたい | **Skill D** |
| seedance2 / gpt_image_2 を Runway 経由で使い、Higgsfield 版とモデルファミリーを揃えて比較したい | **Skill D** |

Skill C と Skill D は **同じ products/`<name>`/ 資産（core.md / voice-spec / reference）を共有**できる。`config.yaml` の `higgsfield:` / `runway:` ブロックで使い分ける。

> ※ 「Higgsfield 版と比較」は **モデルファミリーを揃えた比較**であり、厳密な同条件ではない（backend / model ID
> 表記 `gpt-image-2`↔`gpt_image_2`・`seedance_2_0`↔`seedance2` / 価格 / 呼び出し経路が異なる）。出力やコストは一致しない。

## 事前準備

### 1. Runway への接続方法は 3 経路ある

本 Skill は **(B) ローカル stdio MCP** を前提に設計している（headless/cron が動くため）。

| | 経路 | 種別 | 認証 | 課金 | headless/cron |
|---|---|---|---|---|---|
| **A** | Hosted MCP `https://mcp.runwayml.com/mcp` | リモート HTTP (Streamable) | OAuth（Runway アカウント、キー不要）| Web サブスクの credit | ❌ OAuth 対話必須 |
| **B** | **Local stdio MCP** `github.com/runwayml/runway-api-mcp-server` | stdio（clone+build）| `RUNWAYML_API_SECRET` | Dev API credit | ✅（本 Skill が前提）|
| **C** | 公式 skills plugin `github.com/runwayml/skills` | Claude Code skills（Dev API 直）| `RUNWAYML_API_SECRET` | Dev API credit | ✅ |

### 2. MCP サーバ接続（経路 B）

```bash
# 1. Developer API キーを発行（dev.runwayml.com で組織作成 → API Keys タブ → 発行）
#    ※ キーは発行時 1 回だけ表示。最低 $10（1,000 credits, $0.01/credit）チャージが必要。
export RUNWAYML_API_SECRET="key_xxxxx"

# 2. 公式 MCP サーバを clone + build
git clone https://github.com/runwayml/runway-api-mcp-server
cd runway-api-mcp-server
npm install && npm run build          # → build/index.js

# 3. Claude Code に追加（MCP_TOOL_TIMEOUT は動画ジョブが長いため大きめに）
claude mcp add runway \
  -e RUNWAYML_API_SECRET=$RUNWAYML_API_SECRET \
  -e MCP_TOOL_TIMEOUT=1000000 \
  -- node /abs/path/to/runway-api-mcp-server/build/index.js

# 4. ElevenLabs MCP（auto モード時のみ必須）
echo 'export ELEVENLABS_API_KEY="sk_xxxxx"' >> ~/.zshenv && source ~/.zshenv
claude mcp add elevenlabs --type stdio --command "uvx elevenlabs-mcp" \
  --env ELEVENLABS_API_KEY=$ELEVENLABS_API_KEY

# 5. 接続確認
claude mcp list
# runway: ... ✓ Connected
# elevenlabs: ... ✓ Connected
```

公開 tool：`runway_generateImage` / `runway_generateVideo` / `runway_getTask` / `runway_cancelTask` / `runway_upscaleVideo` / `runway_editVideo` / `runway_getOrg`。**`list_models()` / balance tool は無い**。

### 3. 課金体系 — Higgsfield と思想が逆（重要）

| | Higgsfield（Skill C）| Runway Developer API（Skill D, 経路 B）|
|---|---|---|
| 課金の決まり方 | **サブスクのプランがモデルアクセスを決める** | **プランは無関係**。Dev Portal にチャージした credit から従量課金 |
| クレジット付与 | サブスクに月次同梱（Starter 200 / Plus 1,000 / Ultra 3,000）| **同梱なし**。$0.01/credit を都度購入（最低 $10、無料トライアル無し）|
| モデルゲーティング | プランで制限（例：seedance は Plus 以上）| **無し**。全モデルが全 usage tier で呼べる |
| usage tier | — | 同時実行数 / 日次生成数 / 30日支出上限のみ制御（Tier1 同時1・50gen/日・$100 → Tier5 $100k）|

> Web サブスク（Standard $15/月, 625cr 等）と Developer API は **完全別財布**。Web プランを買っても
> API クレジットは付かない。本 Skill（経路 B = Dev API）では Web プランは不要。

### 4. プロダクト側準備

`products/<name>/` の中身は Skill C と共通（R-R1 / R-R14 で検証）:

```
products/<name>/
├── core.md                          ← 「## コンテンツカテゴリ」セクション必須
├── config.yaml                      ← runway.enabled: true
├── components/
└── assets/
    ├── reference/                   ← 実プロダクト UI スクショ（base64 で referenceImages に渡す）
    │   ├── index.md
    │   └── *.png
    ├── voice-spec/                  ← カテゴリ別音声仕様
    │   ├── _index.md / worldview.md / feature.md / persona.md
    └── bgm/                         ← bgm.required: true 時のみ必須
```

詳細は [`content-category-framework.md`](./content-category-framework.md) と [`voice-spec-design.md`](./voice-spec-design.md)。

## 起動方法

### 対話モード

```
create-advertisement-with-runway skill で minima を 1 本だけ生成。
[worldview] タグを variation_note 先頭に付与。
```

Claude が計画を提示 → ユーザー承認 → 自律実行。

### Headless モード（cron 対応）

```bash
cd /path/to/adcraft && \
  unset ANTHROPIC_API_KEY && mkdir -p logs && \
  claude -p "create-advertisement-with-runway skill で minima を 1 本生成。\
variation_note 先頭に [worldview] タグを必ず付与。\
動画は seedance2 を 1st、失敗時は gen4_turbo → 静止画 fallback。\
ratio は 720:1280。生成物は SUCCEEDED 直後に必ずダウンロード。\
承認不要、最後まで自律実行で。" \
    --permission-mode bypassPermissions --max-turns 200 \
    --output-format stream-json --verbose \
    >> logs/$(date +%Y%m%d-%H%M%S).log 2>&1
```

R-R11 により `承認不要` / `自律実行` 等のキーワードで確認をスキップ。経路 B（stdio + API キー）なので headless で動く。

## lite モード vs auto モード

`config.yaml.runway` の 2 フィールドで切替（R-R18）。**デフォルトは lite モード**:

| フィールド | デフォルト | 効果 |
|---|---|---|
| `tts.enabled` | **`false`** | `false` = lite（TTS スキップ、`.md` に台本のみ）/ `true` = auto（ElevenLabs 自動生成 + ffmpeg post-master）|
| `bgm.required` | **`false`** | `false` = .tsx に BGM `<Audio>` 非埋込 / `true` = `assets/bgm/*.mp3` を全 shot 通敷 |

lite モードは TTS の shot 尺超過問題を物理的に回避し、CapCut 等での手動付与前提でプロダクション品質に到達しやすい。auto モードは完成 MP4 のみで配信可能。混合（`tts.enabled:false, bgm.required:true` 等）も可。

## 利用可能モデルと価格（Developer API、$0.01/credit、2026-05 検証値）

| 種別 | model ID | 価格 | 備考 |
|---|---|---|---|
| 動画 | `seedance2` | 36 cr/s（480/720p）40（1080p）→ 5s≒**$1.80** | ByteDance。本 Skill の 1st |
| 動画 | `gen4_turbo` | 5 cr/s → 5s=**$0.25** | Runway native。安価な fallback |
| 動画 | `gen4.5` | 12 cr/s → 5s=$0.60 | Runway native 旗艦 |
| 動画 | `gen4_aleph` | 15 cr/s | video→video 編集 |
| 動画 | `act_two` | 5 cr/s | キャラ演技 |
| 画像 | `gpt_image_2` | 1〜41 cr | OpenAI。本 Skill の 1st |
| 画像 | `gen4_image` | 5 cr(720p)/8(1080p)=$0.05/$0.08 | Runway native |
| 画像 | `gen4_image_turbo` | 2 cr=$0.02 | 最速 |

**model ID は literal 厳守**：`gen4.5`（ドット）/ `gen4_image`（アンダースコア）。`gen4_5` `gen_4_5` は誤り。
**duration** は固定 enum `[5, 10]`（gen4_turbo/gen4.5/gen3a_turbo）。**ratio** は pixel 文字列 `"720:1280"`（9:16）。

## コスト管理

`config.yaml.runway.cost_limit_usd`（デフォルト $10）を絶対遵守（R-R6）。balance tool が無いため
`lib/runway-cost.ts` で **client 側に model+秒+解像度から算出**する。各 API 呼び出し前に予測判定：

```
if (spent + reserved + next_call > limit × safety_margin) → abort
```

### 1 リールの典型コスト（4 shot, 5s/shot）

video は 720p（36cr/s）で算出。image は cost guard が踏み抜かないよう **worst case で計上**する（gpt_image_2 は 1〜41cr と幅があるため見積は 41cr=$0.41/枚、4枚で ~$1.64）。**実課金はこれ以下になることが多い**が、guard は推定値で判定するので余裕を見ておく。

| 構成 | image（guard 見積, worst case）| video（720p）| 合計/reel 見積 |
|---|---|---|---|
| seedance2 + gpt_image_2（本 Skill 既定）| ~$1.6 | $7.20 | **~$8.8**（$9.50 abort 閾値に近い）|
| gen4_image + gen4_turbo（native, 安価）| $0.20 | $1.00 | **~$1.2** |
| 静止画 fallback のみ | $0.20 | $0 | **~$0.2** |

> ⚠️ **既定（seedance2 + gpt_image_2）は ~$8.8 と $9.50 abort 閾値に近い**。画像 1 枚でも worst case を引くと
> 余裕が薄く、リトライや 1080p で premature abort（最後のカットが落ちる）リスクがある。
> **初回・コスト優先なら `image`/`video` の `model_preference` 1st を native（`gen4_image` / `gen4_turbo`、~$1.2/reel）に入れ替える**こと。
> seedance2 主軸は Higgsfield Plus（seedance fast ≒$0.66/clip）より割高でもある。
> 表の数値は価格表ベースの **client 側推定値**（実課金は Runway billing で確認）。

## エラーハンドリング

| 状況 | 対応 |
|---|---|
| Runway MCP 未接続 | 起動時停止、`claude mcp add runway …` 案内 |
| `lib/runway-cost.ts` 不在 / 価格表が空 | `LIB_RUNWAY_COST_NOT_FOUND` で停止（R-R2）|
| reference 画像 > 16MB | `REFERENCE_IMAGE_TOO_LARGE` で停止。16MB 未満にリサイズ、または公開 URL を `uri` に渡す（R-R3）|
| ElevenLabs MCP 未接続（auto）| 起動時停止 |
| model preference が既知集合に無い | `MODEL_NOT_KNOWN` で停止（R-R2）|
| 画像 3 回 NG | カット動画化中止、`issues.json` 記録、次カットへ |
| 動画 NG | 次候補モデル → 静止画 fallback（R-R5）、記録 |
| task `THROTTLED` / 429 | R-R8 バックオフ（5s→15s→45s）後リトライ |
| 生成物 URL 24h 失効 | SUCCEEDED 直後に DL して回避（R-R19）。失効後は cost guard 内で再生成 |
| `tts.enabled: true` だが `voice_id` 空 | 停止（R-R18, `TTS_VOICE_ID_MISSING`）|
| ffmpeg post-master 失敗（auto）| 停止（R-R16, `POST_MASTER_FAILED`）|
| lite モードで .tsx に narration `<Audio>` 混入 | 停止（R-R18, `LITE_MODE_VIOLATION`）|
| cost 上限到達 | 即 abort、生成済カットで合成試行 |

## トラブルシュート

### Q. ratio を `"9:16"` で渡したら弾かれる

A. Runway は pixel 文字列を取る。9:16 縦は **`"720:1280"`**（gen4.5 i2v は `832:1104` / `672:1584` も可）。横は `1280:720` 等。

### Q. `gen4.5` を `gen4_5` と書いたら model not found

A. model ID は literal 厳守。動画旗艦は **`gen4.5`（ドット）**、画像は **`gen4_image`（アンダースコア）**。`gen4_5` / `gen_4_5` は第三者ラッパーの表記で公式 API では誤り。

### Q. 生成した動画 URL がしばらくすると 404 になる

A. Runway API の生成物 URL は **24h で失効**する。task が `SUCCEEDED` になったら**即ダウンロード**して `output/<...>/.assets/<id>/` に永続化すること（R-R19）。URL を `.tsx` から直接参照してはいけない。

### Q. コストが balance から取れない

A. Runway MCP には balance / transactions tool が無い。コストは `lib/runway-cost.ts` で client 側に推定する設計（R-R6）。`cost-report.json` の spent は推定値である旨を `notes` に明記する。

### Q. seedance2 が高い

A. seedance2 は 36 cr/s（5s≒$1.80）。コスト優先なら `video.model_preference` の 1st を `gen4_turbo`（5s=$0.25）に変更:

```yaml
runway:
  video:
    model_preference:
      - "gen4_turbo"     # 安価・安定
      - "seedance2"      # 高品質だが高コスト
```

### Q. R-R17 read-only 違反 警告が出た

A. autonomous run 中に skill が `assets/voice-spec/` か `assets/reference/` を書き換えた可能性。`issues.json` の `READ_ONLY_VIOLATION` から特定し git で戻す。

## カスタマイズ

### native モデルへの切替（コスト削減）

`config.yaml.runway` の `image.model_preference` / `video.model_preference` を `gen4_image` / `gen4_turbo` 先頭に。1 リール ~$1.2 まで下がる。

### 新カテゴリの追加 / voice-spec の改訂

Skill C と同じ手順（[`higgsfield-skill-guide.md`](./higgsfield-skill-guide.md) の「カスタマイズ」参照）。voice-spec / reference は autonomous run 中 read-only（R-R17）。

## 関連ドキュメント

- [`content-category-framework.md`](./content-category-framework.md) — カテゴリの考え方
- [`voice-spec-design.md`](./voice-spec-design.md) — voice-spec の書き方
- [`higgsfield-skill-guide.md`](./higgsfield-skill-guide.md) — Skill C 運用ガイド（共通部分の参照元）
- [`../rules/create-advertisement-with-runway-rules.md`](../rules/create-advertisement-with-runway-rules.md) — R-R1〜R-R19 不変ルール
- [`../skills/create-advertisement-with-runway/SKILL.md`](../skills/create-advertisement-with-runway/SKILL.md) — Skill D 実装詳細
