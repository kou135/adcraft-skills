# コンテンツカテゴリ・フレームワーク

> Skill C (`create-advertisement-with-higgsfield`) が `core.md` の `## コンテンツカテゴリ` セクションを介して活用する、**広告動画の容器分類** の考え方。
> Skill B (`create-advertisement`) でも採用可能（推奨）。

## なぜカテゴリ分けが必要か

同じプロダクトでも、**世界観訴求の動画と機能紹介の動画では、声色・構成・テンポ・ビジュアルすべてが異なる**。これを 1 つの spec で混ぜると、どちらも中途半端になる。

例えば睡眠アプリ Minima の場合:

| | 世界観動画 | 機能紹介動画 |
|---|---|---|
| 声 | almost-whispering、年上の友人 | calm-but-clear、UX に詳しい同僚 |
| 文字数/分 | 280-320 | 340-380 |
| 文の長さ | 15-22 chars | 18-28 chars |
| BGM | 禁止（ASMR コミット） | soft ambient 許容 |
| ビジュアル | 暗い色温度、手元・ベッド | アプリスクリーン中心 |
| CTA 強度 | 弱め・余韻優先 | 明確・押し付けない |

これを 1 つの voice-spec で表現しようとすると、平均値に落ち着いて両方が薄まる。**カテゴリ別に独立した spec を持つ** ことで、各容器が「らしさ」を最大化できる。

## 推奨初期カテゴリ（マーケファネルの 3 段）

最初に揃えたいのはこの 3 つ:

| カテゴリ | 目的 | マーケファネル位置 | 観るモーメント |
|---|---|---|---|
| **`worldview`** | ブランドの世界観・到達したい状態を体感させる | **認知** | スクロール中、ふと止まる瞬間 |
| **`feature`** | プロダクトの主機能の "体感" を実演 | **検討** | 既に課題感あり、検討段階のユーザー |
| **`persona`** | ペルソナのペインを直撃して「これ私だ」を引き出す | **共感深化** | pain を感じている瞬間 |

3 つあれば認知 → 検討 → 共感深化のファネル各段に弾を撃てる。

## カテゴリは「メッセージ優先順位」とは別

`core.md` には既に `## 訴求の軸` セクションがある（例: 第一訴求軸 / 第二訴求軸 / 第三訴求軸）。これとカテゴリは **別の概念**。

```
訴求の軸 = 「何を」優先して語るか（メッセージ優先順位）
       ↓ どの容器で？
カテゴリ  = 「どの容器で」語るか（執行方針）
```

例えば Minima の場合:

```
訴求の軸:
  1. 「最小限のハードル」による絶対的な安心感
  2. 「今日の自分を肯定して眠れる」情緒的ベネフィット
  3. 「自分だけの基盤知識」が育つ知的優越感

      ↓ どの容器で各軸を表現する？

カテゴリ:
  worldview → 第二訴求軸を中心、第三訴求軸を背景で漂わせる
  feature   → 第一訴求軸に集中、第三訴求軸を補強
  persona   → 第一・第二訴求軸を pain → relief の対比で混ぜる
```

各カテゴリで **どの訴求軸をどう channel するか** を `core.md` の `### {category}` セクションの「主訴求軸」に明記する。

## 1 カテゴリ = 1 実行レイヤ

カテゴリ別に独立した執行レイヤを持つ:

```
products/<name>/
├── core.md                          ← カテゴリ定義（umbrella）
└── assets/
    ├── voice-spec/                  ← 音声執行レイヤ
    │   ├── _index.md
    │   ├── worldview.md
    │   ├── feature.md
    │   └── persona.md
    ├── reference/                   ← 画像参照レイヤ
    │   ├── index.md
    │   └── *.png
    └── bgm/                         ← 任意（BGM 使用時）
        └── *.mp3
```

将来、`visual-spec/` `cta-spec/` `hook-spec/` を足すときも同じパターンで増やせる。

## variation_note タグ規約

各 variation の `variation_note` は **先頭に `[category]` タグ** を必ず含める:

```
[worldview] Higgsfield 版 v2 — 自己嫌悪→静寂→刻む→眠れる夜の一人称世界観。
[feature] 1 日 1 語 + 3 問 → 完了 の 3 ステップ実演。
[persona] 隙間時間の浪費家 視点 / 朝の通勤シーン。
```

skill 側はタグを正規表現で抽出 → 該当 `voice-spec/{tag}.md` を読み込んで生成する（R-H14）。タグ無し / 該当 spec 不在は **fail-fast**（autonomous 運用で「謎に flat TTS」が発生するのを防ぐ）。

## ルール

1. **カテゴリは `core.md` でのみ定義・変更可能**。新カテゴリを足す場合は対応する `assets/voice-spec/{new}.md` も同時に整備
2. **同一カテゴリ内の variation 差別化は「同じカテゴリ × 違う表現」で展開**。例: worldview の 3 本は全て「静寂・夜・手元」だが、テキストフックや構成テンポを変える
3. **一度確定したカテゴリ・執行レイヤは autonomous 実行中 read-only**（R-H17）。git 履歴を通じて変更履歴を保持

## カテゴリの追加判断（YAGNI 原則）

最初は worldview / feature / persona の 3 つで十分。必要に応じて追加候補:

| カテゴリ案 | 目的 | 追加検討タイミング |
|---|---|---|
| `proof` | ユーザー実績・数値での裏付け | persona の派生として効かない時 |
| `comparison` | 競合との差別化（実名出さず） | 直接比較訴求が必要な時 |
| `seasonal` | 季節・イベント連動 | 年末年始 / 新生活 / 等の特殊期 |
| `tutorial` | 詳しい操作説明 | feature だけでは情報密度が足りない時 |
| `testimonial` | 実ユーザーの声 | コミュニティ形成期 |
| `behind-the-scenes` | 開発者視点・裏側 | スタートアップ初期のファン醸成 |

**追加するな**: 上記が「ある日急に欲しい」と思っても、まず 3 カテゴリで網羅できるか先に検討する。容器が増えると spec の維持コストが線形に増える。

## 関連ドキュメント

- [`voice-spec-design.md`](./voice-spec-design.md) — voice-spec の書き方ガイド
- [`higgsfield-skill-guide.md`](./higgsfield-skill-guide.md) — Skill C の運用ガイド
- [`../rules/create-advertisement-with-higgsfield-rules.md`](../rules/create-advertisement-with-higgsfield-rules.md) — R-H14〜R-H17 含む不変ルール
