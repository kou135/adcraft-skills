# `config.yaml` スキーマリファレンス

Skill `create-advertisement` が読み取る機械設定ファイル。

## 全フィールド

```yaml
product_name: string                   # 必須。商品名（kebab-case 推奨）
description: string                    # 任意

formats:
  reel:
    enabled: boolean                   # デフォルト false
    count: integer                     # 1 度の実行で生成する本数
    duration: integer                  # 秒。20-30 推奨
    aspect: string                     # "9:16" 推奨
    fps: integer                       # デフォルト 30
  slide_image:
    enabled: boolean
    count: integer                     # 1 度の実行で生成するセット数
    aspect: string                     # "1:1" or "4:5"
    slides_per_set: integer            # 1 セットの枚数
  horizontal:
    enabled: boolean
    count: integer
    duration: integer
    aspect: string                     # "16:9"
    fps: integer
  blog:
    enabled: boolean
    count: integer
    target_word_count: integer

output:
  base_dir: string                     # デフォルト "./output"

validation:
  max_iteration: integer               # 修正ループ上限。デフォルト 3
  check_frames: array                  # 例: [0, "mid", "end"]
  strict_mode: boolean                 # デフォルト false

variation:
  strategy: string                     # "auto" | "manual"
  manual_directions: array             # strategy="manual" 時のみ有効
    # - "機能訴求"
    # - "問題解決"
    # - "Before/After"
    # - "ユーザーストーリー"
    # - "差別化"
```

## フィールド詳細

### `product_name`（必須）

商品名。`output/<product_name>/...` のパスにも使われるので kebab-case 推奨。

### `formats.*`

各フォーマットを `enabled: true` にすると、その種類の生成が有効になります。MVP 段階では `reel` のみ実装されており、他は将来追加。

#### `reel.duration`

20〜30 秒を強く推奨。`rules/create-advertisement-rules.md` の R1 で 20-30 秒の範囲を強制しています。

#### `formats.reel.aspect`

`"9:16"` を推奨（X / Instagram リール想定）。他のアスペクト比も指定可能ですが、`IPhoneFrame` 等の共通コンポーネントは 9:16 縦長前提で設計されています。

### `validation.max_iteration`

視覚検証で問題が出たときの修正ループ上限。3 が良い塩梅です。
増やすと 1 本あたりの生成時間が伸び、減らすと崩れた動画がスキップされやすくなります。

### `validation.check_frames`

still で検証する代表フレーム。

- `0`：開始フレーム
- `"mid"`：中間（durationInFrames / 2）
- `"end"`：終了直前（durationInFrames - 1）
- 整数も指定可（例: `[0, 30, 60, 120]`）

### `variation.strategy`

- `"auto"`：Claude が `core.md` を読んで 5 本の方向性を自分で決める（推奨）
- `"manual"`：`manual_directions` の配列をそのまま使う

`manual` は「型」になりやすいので、慣れるまでは `auto` を推奨します。

## `higgsfield:` ブロック（Skill C 専用、任意）

`create-advertisement-with-higgsfield`（Skill C）が読む。各フィールドの意味は [`higgsfield-skill-guide.md`](./higgsfield-skill-guide.md) と [`templates/config.yaml.template`](../templates/config.yaml.template) のコメントを参照。`enabled: false`（既定）なら無視される。

## `runway:` ブロック（Skill D 専用、任意）

`create-advertisement-with-runway`（Skill D）が読む。`enabled: false`（既定）なら無視される。Runway は Web サブスクではなく Developer API のクレジット制（$0.01/credit、従量・プラン無関係）。

```yaml
runway:
  enabled: boolean              # 既定 false。true で Skill D が起動可能に
  cost_limit_usd: number        # 1 run のハード上限（USD、既定 10.00）。balance tool 非対応のため client 側推定で遵守
  cost_safety_margin: number    # 既定 0.95（limit × margin で abort）
  shots_per_video: integer      # 1 動画のカット数（既定 4）
  shot_duration_sec: integer    # 1 カット秒数（既定 5）。shots_per_video × shot_duration_sec = formats.reel.duration
  parallel: boolean             # 既定 false（MVP は直列）
  ratio: string                 # 動画の 9:16 pixel 文字列 "720:1280"（"9:16" は不可）
  image:
    model_preference: string[]  # 既定 ["gpt_image_2","gen4_image"]。literal 厳守（gen4_image はアンダースコア）
    max_iterations_per_shot: integer  # 既定 3（初回 + リトライ 2）
    ratio: string               # 任意。画像生成専用 ratio（未指定なら上位 ratio）。video と enum が異なりうる
  video:
    model_preference: string[]  # 既定 ["seedance2","gen4_turbo"]。seedance2 は高コスト、gen4_turbo を fallback に
    one_shot: boolean           # 既定 true（失敗時は次候補→静止画、同一モデル再生成しない）
    fallback_to_static: boolean # 既定 true
  tts:                          # R-R18: opt-in。既定 lite（TTS スキップ、台本のみ）
    enabled: boolean            # 既定 false。true で ElevenLabs 自動生成（auto モード）
    provider: string            # "elevenlabs"
    voice_id: string            # enabled: true 時に必須
    model_id: string            # 例 "eleven_turbo_v2_5"
  bgm:
    required: boolean           # 既定 false。true なら assets/bgm/*.mp3 を全 shot 通敷
    selection: string           # "auto" | "explicit"
```

詳細は [`runway-skill-guide.md`](./runway-skill-guide.md) と [`../rules/create-advertisement-with-runway-rules.md`](../rules/create-advertisement-with-runway-rules.md)（R-R1〜R-R19）を参照。

## 含まれないフィールド（意図的）

- `github_branch`、`pr_template`、`tiktok_account_id` 等の **配信関連設定**
  → 配信は本 Skill の責務外のため、`config.yaml` のスキーマには含めません。
  → 配信が必要な場合は、`output/` を読み取る別スクリプトを用意してください。
  → 将来的に配信レイヤーが拡張される場合、optional な `publish:` セクションが後方互換で追加される可能性があります（[`Specification.md`](../Specification.md) の「将来の拡張案」参照）。
