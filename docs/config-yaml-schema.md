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

## 含まれないフィールド（意図的）

- `github_branch`、`pr_template`、`tiktok_account_id` 等の **配信関連設定**
  → 配信は本 Skill の責務外のため、`config.yaml` のスキーマには含めません。
  → 配信が必要な場合は、`output/` を読み取る別スクリプトを用意してください。
  → 将来的に配信レイヤーが拡張される場合、optional な `publish:` セクションが後方互換で追加される可能性があります（[`Specification.md`](../Specification.md) の「将来の拡張案」参照）。
