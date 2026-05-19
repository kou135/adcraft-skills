# Skill C 運用ガイド — create-advertisement-with-higgsfield

> Skill C は Higgsfield MCP（GPT Image 2 + Seedance 2.0 等）と ElevenLabs MCP（TTS）を統合し、**実写級ビジュアル + ナレーション付き** の広告動画を生成する。
> Skill B (`create-advertisement`) の上位互換だが、外部 AI サービスへの課金が発生する。

## いつ Skill C を使うか

| 状況 | 推奨 |
|---|---|
| 試運転 / 無料 / イラスト系 | Skill B |
| 量産（月 10 本以上） | Skill B（コスト 0）|
| 実写級ビジュアル + ナレーションが欲しい | **Skill C** |
| ペルソナの一人称モノローグ動画 | **Skill C** |
| ブランド世界観をプロフェッショナルに表現 | **Skill C** |
| 試験運用 / 高品質少数本 | **Skill C** |

## 事前準備

### 1. MCP サーバ接続

```bash
# Higgsfield MCP
claude mcp add higgsfield --type http --url https://mcp.higgsfield.ai/mcp
# → ブラウザで OAuth 認証フロー

# ElevenLabs MCP
echo 'export ELEVENLABS_API_KEY="sk_xxxxx"' >> ~/.zshenv
source ~/.zshenv
claude mcp add elevenlabs --type stdio \
  --command "uvx elevenlabs-mcp" \
  --env ELEVENLABS_API_KEY=$ELEVENLABS_API_KEY

# 接続確認
claude mcp list
# higgsfield: ... ✓ Connected
# elevenlabs: ... ✓ Connected
```

### 2. プラン要件

| プロバイダ | 最低プラン | 月額 | 何が解放されるか | 何が制限か |
|---|---|---|---|---|
| **Higgsfield Starter** | Starter | $15 | GPT Image 2、kling 2.6 動画化 | **Seedance 2.0 は Plus $39 以上**で利用可（地域制限の可能性あり） |
| **Higgsfield Plus** | Plus | $39 | Seedance 2.0 + 1,000 cred/月 | 一部 image model 365 日無制限 |
| **ElevenLabs Starter** | Starter | $5 | Voice Library + Sara 含む professional voice、商用 OK、30k char/月 | Professional Voice Cloning 未対応 |
| **ElevenLabs Creator** | Creator | $22 | Professional Voice Cloning、121k char/月 | — |

### 3. 推奨構成

| 用途 | プラン構成 | 月額合計 | 月の生成本数 |
|---|---|---|---|
| **試験運用**（kling 中心、静止画 fallback OK） | Higgsfield Starter + ElevenLabs Starter | **$20** | 4-5 リール |
| **動画化フル**（Seedance 2.0） | Higgsfield Plus + ElevenLabs Starter | **$44** | 10-11 リール |
| **量産** | Higgsfield Ultra + ElevenLabs Creator | **$121** | 30+ リール |

### 4. プロダクト側準備

`products/<name>/` の中身が以下を満たす必要がある（R-H1 / R-H14 で検証）:

```
products/<name>/
├── core.md                          ← 「## コンテンツカテゴリ」セクション必須
├── config.yaml                      ← higgsfield.enabled: true
├── components/                      ← Skill A で生成、または手動配置
└── assets/
    ├── reference/                   ← 実プロダクト UI スクショ
    │   ├── index.md                 ← 画面 → スクショの対応表
    │   └── *.png
    ├── voice-spec/                  ← カテゴリ別音声仕様
    │   ├── _index.md
    │   ├── worldview.md
    │   ├── feature.md
    │   └── persona.md
    └── bgm/                         ← 任意（bgm.required: true 時のみ必須）
```

詳細は [`content-category-framework.md`](./content-category-framework.md) と [`voice-spec-design.md`](./voice-spec-design.md) を参照。

## 起動方法

### 対話モード

```
create-advertisement-with-higgsfield skill で minima を 1 本だけ生成。
[worldview] タグを variation_note 先頭に付与。
```

Claude が計画を提示 → ユーザー承認 → 自律実行。

### Headless モード（推奨、cron 対応）

```bash
cd /path/to/adcraft && \
  unset ANTHROPIC_API_KEY && \
  mkdir -p logs && \
  claude -p "create-advertisement-with-higgsfield skill で minima を 1 本生成。\
variation_note 先頭に [worldview] タグを必ず付与。\
voice は voice-spec/worldview.md の優先順位に従う。\
narration には <break> と <prosody> を必ず含める。\
TTS 後に scripts/audio-post-master.sh で必ず post-master。\
動画は Seedance 2.0 を 1st、失敗時は kling → 静止画 fallback。\
承認不要、最後まで自律実行で。" \
    --permission-mode bypassPermissions \
    --max-turns 200 \
    --output-format stream-json --verbose \
    >> logs/$(date +%Y%m%d-%H%M%S).log 2>&1
```

R-H11（既存 R12 継承）により `承認不要` / `自律実行` 等のキーワードが含まれていれば対話モードでも確認をスキップする。

## 11 ステップの流れ

```
Step 0  ルール読み込み (rules/create-advertisement-with-higgsfield-rules.md)
Step 1  商品設定 + voice-spec + reference の整合性チェック (R-H14, R-H17)
        → core.md の categories 抽出
        → assets/voice-spec/{category}.md 必須 6 セクション検証
        → assets/reference/index.md 存在検証
        → mtime snapshot 取得（R-H17 監査用）
Step 2  モデル ID 動的解決 + Cost Tracker 初期化
Step 3  ショット計画（variation_note 先頭 [category] タグ必須）
        → voice-spec を読み込んで Pace Target / Prosody Patterns を頭に入れる
        → narration_text_ssml に <break> と <prosody> を埋め込む（R-H15）
Step 4  リファレンス画像 upload
Step 5  画像生成ループ（cut 直列、最大 3 回再試行）
Step 6  動画生成（1 発主義、失敗時は R-H5 静止画+ZoomIn フォールバック）
Step 7  TTS 生成（voice-spec の voice 1st 推奨で試行、fallback chain あり、R-H15）
Step 7.5 ffmpeg post-master（必須、R-H16）
        → raw mp3 → mastered.mp3
        → HPF 85Hz + 2.5kHz presence boost + soft compression + loudnorm -16 LUFS
Step 8  Remotion .tsx 生成（必ず .mastered.mp3 を参照）
Step 9  既存 R7 検証ループ + render
Step 10 投稿コピー + manifest + cost-report + issues + R-H17 監査
        → mtime 再チェック、変更検知で警告
Step 11 stdout 終了サマリ
```

## コスト管理

`config.yaml.higgsfield.cost_limit_usd`（デフォルト $10）を絶対遵守する（R-H6）。各 API 呼び出し前に予測判定:

```
if (spent + reserved + next_call > limit × safety_margin) → abort
```

abort 時は生成済 shots だけで合成試行し、`cost-report.json` を必ず出力。

### 1 リールの典型コスト

| ステップ | 単価 | 4 shot 合計 |
|---|---|---|
| image2 (gpt_image_2) | $0.08 / shot | **$0.32** |
| video (kling 2.6 @ 5s) | $1.60 / shot | $6.40 |
| video (seedance 2.0 @ 5s) | $2.80 / shot | $11.20 |
| video fallback (static + ZoomIn) | $0 | **$0** |
| TTS (eleven_turbo_v2_5) | ~$0.0003 / char | **$0.04** |

**現実的な月額**:

| 構成 | コスト/reel | 月予算で何本？ |
|---|---|---|
| 全 static fallback | $0.36 | $20 で月 55 本 |
| kling 動画化 | $1.96 | $20 で月 10 本 |
| seedance 動画化 | $3.20 | $44 で月 13 本 |

## エラーハンドリング

| 状況 | 対応 |
|---|---|
| Higgsfield MCP 未接続 | 起動時停止、`claude mcp add` 案内 |
| ElevenLabs MCP 未接続 | 起動時停止 |
| `core.md` がプレースホルダのまま | 停止、記入を促す |
| `core.md` に `## コンテンツカテゴリ` セクション無し | 停止、`templates/core.md.template` 参照を案内 |
| `variation_note` に `[category]` タグ無し | 停止 (R-H14, `MISSING_CATEGORY_TAG`) |
| `assets/voice-spec/{category}.md` 不在 | 停止 (R-H14, `VOICE_SPEC_MISSING:{category}`) |
| voice-spec の必須 6 セクション欠落 | 停止 (R-H14, `VOICE_SPEC_INCOMPLETE`) |
| `assets/reference/index.md` 不在 | 停止 (R-H14, `REFERENCE_INDEX_MISSING`) |
| 画像 3 回 NG | カット動画化中止、`issues.json` 記録、次カットへ |
| 動画 1 発 NG | 静止画フォールバック (R-H5)、`issues.json` 記録 |
| Seedance 2.0 が 402 を返す | プラン制約 → preference 次候補（kling）に fallback、それも失敗なら静止画 |
| TTS 失敗 | voice fallback chain を試行、すべて失敗なら無音続行 + 記録 |
| TTS で `<break>` `<prosody>` が無い | 停止 (R-H15, `MISSING_SSML_BREAK / MISSING_SSML_PROSODY`) |
| ffmpeg post-master 失敗 | 停止 (R-H16, `POST_MASTER_FAILED`)、raw mp3 で render は禁止 |
| cost 上限到達 | 即 abort、生成済カットで合成試行 |
| R-H17 read-only 違反検知 | `issues.json` に `READ_ONLY_VIOLATION` 記録、停止はしない |

## トラブルシュート

### Q. Seedance 2.0 が `402 Requires plus plan or higher` で失敗する

A. Higgsfield Starter プランでは Seedance 利用不可。対処:

1. **Plus $39 にアップグレード** — Seedance 利用可
2. **kling 2.6 に切替** — Starter で利用可、品質はほぼ同等

`config.yaml` の `higgsfield.video.model_preference` を編集:

```yaml
video:
  model_preference:
    - "seedance2"      # Plus 課金時の 1st 候補
    - "kling2_6"       # Starter 対応の fallback
    - "seedance2-fast" # 3rd
```

skill は preference 順に試行、全失敗なら R-H5 で静止画 + ZoomIn。

### Q. ElevenLabs Sara voice が `402 paid_plan_required` で失敗する

A. config.yaml の voice_id を確認。`l7ME2dcqpdvq6E8sCS24` の Sara は **Voice Library の "professional" カテゴリ**で、Starter 以上で利用可。

それでも 402 が出る場合:

1. ElevenLabs ダッシュボードで voice が saved に追加されているか確認
2. Saved Voices に追加 → 再試行
3. それでも NG なら voice-spec の 2nd 推奨（Harune 等）に fallback

### Q. shot 1 だけ LUFS が低い（target -16 に届かない）

A. SSML の `<break>` が多すぎて silence 比率が 30% 超えている可能性。voice-spec の Exemplar Phrases を確認、break 数を 3 個以内に。[voice-spec-design.md の LUFS 設計](./voice-spec-design.md#lufs-設計) 参照。

### Q. R-H17 read-only 違反 警告が出た

A. autonomous run 中に skill が `assets/voice-spec/` か `assets/reference/` を書き換えた可能性。`issues.json` の `READ_ONLY_VIOLATION` から書き換えられたファイルを特定。

**よくある原因**:
- skill が voice-spec の voice_id を更新しようとした（NG、voice-spec は不変）
- skill が reference に新しい画像を保存した（NG、reference は read-only）

**対処**: git 履歴を確認、必要なら git checkout で元に戻す。

### Q. `READ_ONLY_VIOLATION` が頻出する

A. skill ルール改訂が必要なケース。voice-spec を変更する別 skill (`refresh-voice-specs`、将来予定) を経由するよう設計しなおすか、現在の skill のどこで違反しているか SKILL.md を読み直す。

## カスタマイズ

### 新カテゴリの追加

1. `core.md` の `## コンテンツカテゴリ` に新セクション `### {newcat}` を追加
2. `assets/voice-spec/{newcat}.md` を [`templates/assets/voice-spec/`](../templates/assets/voice-spec/) からコピー
3. 必須 6 セクションを書き起こす
4. `_index.md` の カテゴリ一覧表に新行追加
5. variation_note 先頭に `[newcat]` タグを付けて起動

### voice-spec の改訂

R-H17 により autonomous run 中は read-only。変更時は:

1. 手動で `assets/voice-spec/{category}.md` を編集
2. git commit で履歴を残す
3. 次回 skill 起動時から新 spec が反映される

将来予定の `refresh-voice-specs` skill が出れば、web research → spec 自動更新が可能になる。

## 関連ドキュメント

- [`content-category-framework.md`](./content-category-framework.md) — カテゴリの考え方
- [`voice-spec-design.md`](./voice-spec-design.md) — voice-spec の書き方
- [`getting-started.md`](./getting-started.md) — 初回セットアップ（Skill B 中心）
- [`../rules/create-advertisement-with-higgsfield-rules.md`](../rules/create-advertisement-with-higgsfield-rules.md) — R-H1〜R-H17 不変ルール
- [`../skills/create-advertisement-with-higgsfield/SKILL.md`](../skills/create-advertisement-with-higgsfield/SKILL.md) — Skill C 実装詳細
