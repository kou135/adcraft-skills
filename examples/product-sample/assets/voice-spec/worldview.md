# voice-spec / worldview (TaskFlow example)

世界観訴求カテゴリの音声執行仕様。

## Voice Persona

- **年齢感**: 30 代後半、安心感のある声
- **性別感**: 穏やかな男性 or gender-neutral
- **関係性**: 仕事の先輩、自分のペースを尊重してくれる人
- **距離感**: カフェのテーブルを挟んで座っている感覚（マイクから 50cm）
- **比喩**: Apple Keynote の "focused" シーンの落ち着き、Aesop 店頭ナレーションのミニマリズム

## Tone Keywords (max 5)

`calm` / `unhurried` / `confident-without-pressure` / `clear-articulation` / `warm-but-neutral`

## Pace Target

| 指標 | 目標値 |
|---|---|
| chars/min | 300〜340 |
| talk-time ratio | 45〜55% |
| pause budget | 1 shot あたり 0.5s 以上の `<break>` 最低 1 箇所 |
| 1 文の長さ | 18〜24 chars |

## Prosody Patterns

ブランドキーワード強調:

```xml
<prosody pitch="+1st" rate="0.95">TaskFlow</prosody>
<prosody rate="0.92">1 画面</prosody>
<prosody pitch="-1st" rate="0.95">集中</prosody>
```

文末は `<break time="0.4s"/>` で締める、句点前は `<break time="0.2s"/>`。

ElevenLabs voice_settings 推奨:

```json
{
  "stability": 0.65,
  "similarity_boost": 0.75,
  "style": 0.30,
  "use_speaker_boost": true
}
```

## Recommended ElevenLabs Voices

| 優先 | voice | 提供 | 備考 |
|---|---|---|---|
| 1st | Adam | Voice Library | warm, mature, mid-30s male |
| 2nd | Harune | Voice Library | gender-neutral JP-native option |
| 3rd | Sara | Professional | category-pair統一感重視時 |
| fallback | Sarah | premade | 緊急時のみ |

## Taboos

- 早口・energetic な抑揚
- 「すごい」「最強」「圧倒的」等の煽り語
- 競合実名比較（Notion/Asana/Trello/Jira 等）
- 「絶対」「必ず」等の押し付け
- 過度な hedge（"えっと" "あの"）

## Reference Brands / Creators

- **Apple Keynote** の "focused" シーンのナレーション
- **Linear** のプロダクトデモ（fast & focused、無駄ゼロ）
- **Notion** のオンボーディング（落ち着いた誘導）

## BGM / SFX Policy

- **BGM**: 禁止（静謐優先）。後付け運用なら soft piano 1 モチーフを -18dB で
- **Room tone**: 必須、-30dB（朝のカフェの遠い喧騒、書斎の静けさ）
- **SFX**: タップ音 / 紙の擦れ音は許容、勝利音 / ベル禁止

## Exemplar Phrases (SSML-ready)

```text
<!-- フック -->
<break time="0.3s"/>朝、コーヒーを淹れる頃に、<break time="0.4s"/>次のやることが見えている<break time="0.5s"/>。

<!-- 解決提示 -->
<prosody pitch="+1st" rate="0.95">TaskFlow</prosody>なら、<break time="0.3s"/>3 つの案件を<break time="0.2s"/><prosody rate="0.92">1 画面</prosody>で<break time="0.5s"/>。

<!-- 到達状態 -->
今日の最初の 30 分が、<break time="0.3s"/><prosody pitch="-1st">集中</prosody>になる<break time="0.5s"/>。

<!-- ブランド帰着 -->
<prosody rate="0.92">TaskFlow.</prosody><break time="0.5s"/>集中の朝へ<break time="0.5s"/>。
```

## Validation hints

- [ ] 冒頭 0.5s 以内に音が立ち上がっているか
- [ ] ブランドキーワード "TaskFlow" / "1 画面" / "集中" に明確な抑揚があるか
- [ ] "announcer" っぽさが出ていないか（試聴者の 2/3 以上が "落ち着いた先輩" と評価）
- [ ] CTA が押し付けがましくないか（「集中の朝へ」が断定で終わるか）
