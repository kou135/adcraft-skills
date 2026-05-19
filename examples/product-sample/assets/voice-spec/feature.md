# voice-spec / feature (TaskFlow example)

機能訴求カテゴリの音声執行仕様。worldview より速く、明確に。

## Voice Persona

- **年齢感**: 20 代後半〜30 代前半
- **性別感**: 穏やかな女性 or gender-neutral
- **関係性**: 機能に詳しい同僚、肩越しに UI を見せてくれる立場
- **距離感**: 肩越しの近さ（マイクから 30cm）
- **比喩**: Linear のプロダクト紹介動画、Notion のオンボーディングナレーション

## Tone Keywords (max 5)

`calm-but-clear` / `friendly-explanatory` / `slightly-faster` / `crisp-articulation` / `confident-without-pressure`

## Pace Target

| 指標 | 目標値 |
|---|---|
| chars/min | 360〜400 |
| talk-time ratio | 55〜65% |
| pause budget | 1 shot あたり 0.3s 以上の `<break>` 最低 1 箇所 |
| 1 文の長さ | 20〜30 chars |

## Prosody Patterns

機能名 / 動作キーワードを強調:

```xml
<prosody pitch="+1st" rate="1.0">30 秒</prosody>
<prosody pitch="+1st" rate="1.0">1 ボード</prosody>
<prosody rate="0.95">追加、</prosody><break time="0.2s"/><prosody rate="0.95">並べ替え、</prosody><break time="0.2s"/><prosody rate="0.95">完了。</prosody>
```

ElevenLabs voice_settings 推奨:

```json
{
  "stability": 0.55,
  "similarity_boost": 0.75,
  "style": 0.20,
  "use_speaker_boost": true
}
```

## Recommended ElevenLabs Voices

| 優先 | voice | 提供 | 備考 |
|---|---|---|---|
| 1st | Harune | Voice Library | JP-native、calm clarity |
| 2nd | Bella | Voice Library | bright, professional female |
| 3rd | Adam | Voice Library | worldview と同じ声で統一感 |
| fallback | Sarah | premade | 緊急時のみ |

## Taboos

- 「業界初」「最強」「圧倒的」等の煽り語
- 「絶対」「必ず」「ぜひ」等の押し付け
- ためらいと早口の混在
- 競合実名比較
- 「タイパ」「コスパ」等の流行語

## Reference Brands / Creators

- **Apple Keynote** プロダクト紹介の "calm explainer"
- **Linear** のデモ動画（fast & focused）
- **Notion** のオンボーディング動画

## BGM / SFX Policy

- **BGM**: 軽い ambient pad 許容（voice の -15dB 下）。商業 EDM 禁止
- **Room tone**: 必須、-30dB
- **UI SFX**: 許容、最小限。タップ音 / 完了時のソフトベル（1 度のみ）

## Exemplar Phrases (SSML-ready)

```text
<!-- 機能宣言 -->
<prosody pitch="+1st" rate="1.0">30 秒</prosody>で始まる<break time="0.3s"/>、<prosody pitch="+1st" rate="1.0">1 ボード</prosody>のタスク管理<break time="0.4s"/>。

<!-- ステップ実演 -->
<prosody rate="0.95">タスクを書く、</prosody><break time="0.2s"/><prosody rate="0.95">日付を選ぶ、</prosody><break time="0.2s"/><prosody rate="0.95">完了。</prosody><break time="0.4s"/>

<!-- 効果 -->
3 つの案件が、<break time="0.3s"/><prosody pitch="+1st">同じボード</prosody>に並ぶ<break time="0.5s"/>。

<!-- CTA -->
<prosody rate="0.92">TaskFlow.</prosody><break time="0.4s"/>30 秒で始める<break time="0.4s"/>。
```

## Validation hints

- [ ] 機能名・動作キーワード (30 秒 / 1 ボード / 完了) が明らかに目立つか
- [ ] worldview より自然に「速く」聞こえるが、煽りを感じない範囲か
- [ ] ステップの間に 0.2〜0.3s の break が確保されているか
- [ ] CTA「30 秒で始める」が断定で終わっているか
