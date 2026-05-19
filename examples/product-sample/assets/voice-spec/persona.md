# voice-spec / persona (TaskFlow example)

ペルソナ pain 訴求カテゴリ。フリーランスの「混乱」を一人称で代弁する。

## Voice Persona

- **年齢感**: viewer ペルソナと同世代（27〜35）
- **性別感**: variation ごとに切替可（フリーランス男女問わず）
- **関係性**: viewer 自身の内的モノローグの代弁者
- **距離感**: 自分の頭の中のつぶやき（最近接、マイクから 15cm）
- **比喩**: TikTok 1 日 vlog POV クリエイター、Spotify Wrapped のパーソナル narration

## Tone Keywords (max 5)

`first-person` / `peer-empathy` / `slightly-breathy` / `confessional` / `barely-conversational`

## Pace Target

| 指標 | 目標値 |
|---|---|
| chars/min | 320〜360 |
| talk-time ratio | 50〜60% |
| pause budget | 1 shot あたり 0.5s 以上の `<break>` 最低 2 箇所 |
| 1 文の長さ | 12〜22 chars |

## Prosody Patterns

感情の起伏:

```xml
<!-- pain -->
<prosody pitch="-1st" rate="0.95">また Slack で別件…</prosody><break time="0.6s"/>。

<!-- realization -->
<break time="0.5s"/>あ、<break time="0.3s"/><prosody pitch="+2st">1 ボード</prosody>に書いとけばよかった<break time="0.4s"/>。

<!-- relief -->
<prosody pitch="-1st" rate="0.92">これなら、忘れない</prosody><break time="0.5s"/>。
```

ElevenLabs voice_settings 推奨:

```json
{
  "stability": 0.50,
  "similarity_boost": 0.75,
  "style": 0.40,
  "use_speaker_boost": true
}
```

## Recommended ElevenLabs Voices

| 優先 | voice | 提供 | 備考 |
|---|---|---|---|
| 1st | Harune | Voice Library | JP-native、控えめな monologue |
| 2nd | Shin | Voice Library | 男性 persona variation 用 |
| 3rd | Adam | Voice Library | worldview と共有で統一感 |
| fallback | Sarah | premade | non-native のため persona には不向き |

`variation_note` に `persona_gender: female|male|neutral` を含めて voice 自動切替。

## Taboos

- アナウンサー口調（最大の NG）
- 「ぜひ」「みなさん」等の broadcasting 語
- 過剰な感情演技（pain 強調しすぎ NG、relief 喜びすぎ NG）
- 競合実名

## Reference Brands / Creators

- **TikTok 1 日 vlog** 系 POV クリエイター
- **ドキュメンタリーのインタビュー素材**（情熱大陸、NHK プロフェッショナル）
- **Spotify Wrapped** のパーソナル narration

## BGM / SFX Policy

- **BGM**: 禁止
- **Room tone**: 必須、-30dB（シーンと一致：朝のデスク / 通勤電車 / カフェ）
- **diegetic SFX**: タップ音 / 通知音は許容（シーンと一致するもののみ）

## Exemplar Phrases (SSML-ready)

```text
<!-- pain monologue -->
<break time="0.3s"/>また Slack で、<break time="0.3s"/>別件の連絡<break time="0.5s"/>。<prosody pitch="-1st" rate="0.95">あれ、あのタスクどこ行った…</prosody><break time="0.6s"/>。

<!-- realization beat -->
<break time="0.5s"/>...あ、<break time="0.4s"/>3 案件、<break time="0.3s"/><prosody pitch="+2st" rate="0.95">1 ボード</prosody>に書いとけば、忘れない<break time="0.5s"/>。

<!-- relief -->
<prosody pitch="-1st" rate="0.92">今日は、ちゃんと終われる</prosody><break time="0.4s"/>。

<!-- CTA -->
<prosody rate="0.90">TaskFlow.</prosody><break time="0.5s"/>今週だけ、試す<break time="0.5s"/>。
```

## Validation hints

- [ ] アナウンサー / ナレーター感がゼロか
- [ ] pain → realization → relief の 3 段階が音の起伏で識別できるか
- [ ] hedge（"あ、" "..."）が 1 つ以上自然に入っているか
- [ ] CTA がつぶやき調を維持しているか
