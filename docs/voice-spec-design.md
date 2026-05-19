# voice-spec の書き方ガイド

> `assets/voice-spec/{category}.md` を新規プロダクト用に書き起こすときの実践ガイド。
> 前提: [`content-category-framework.md`](./content-category-framework.md) のカテゴリ概念を理解していること。

## 全体像

各 `voice-spec/{category}.md` は **音声執行の単一の真実源**。skill C は起動時にこれを読み、TTS 呼び出しの voice / settings / SSML / 後処理を **literal で** 採用する（R-H14 / R-H15）。

ハードコード厳禁。spec を変えれば挙動が変わる。spec を変えなければ挙動は固定（autonomous 運用に必要な「再現性」を担保）。

## 必須 6 セクション（欠けると fail-fast）

各 spec ファイルには以下 6 セクションが**必ず** 含まれている必要がある（R-H14 検証対象）:

1. `Voice Persona`
2. `Tone Keywords`
3. `Pace Target`
4. `Prosody Patterns`
5. `Taboos`
6. `Recommended ElevenLabs Voices`

順に解説する。

### 1. Voice Persona — 「誰が話しているか」を擬人化

人間味のある記述で 4 項目を埋める:

| 項目 | 例（worldview） | 例（feature） | 例（persona） |
|---|---|---|---|
| **年齢感** | 30 代後半〜40 代前半 | 30 代前半〜半ば | viewer ペルソナと同世代 |
| **性別感** | 穏やかな女性 / gender-neutral | 穏やかな女性 / gender-neutral | variation ごとに切替可 |
| **関係性** | 信頼できる年上の友人 / 兄姉 | UX に詳しい同僚 / ガイド役 | viewer 自身の内的モノローグの代弁者 |
| **距離感** | マイクから 15-30cm（intimate） | 肩越しに覗く距離 | 耳元（最近接） |

書き方のコツ:
- 抽象語（「優しい」「親しみやすい」）禁止 → 具体的（「Calm の Tamara Levitt の almost-whisper」）にする
- 比喩（「年上の友人」）を入れて Claude / 人間レビュアーが映像化しやすくする

### 2. Tone Keywords — max 5 個

```
intimate / slow-paced / almost-whispering / slightly-breathy / reassuring
```

ルール:
- **5 個以内**（多すぎると焦点ぼやける）
- 各語が **audio quality に直接翻訳可能** であること
- ❌ NG: 「優しい」「素敵な」「ナチュラル」（解釈が広すぎる）
- ✅ OK: `breathy` / `crisp-articulation` / `slightly-faster-than-X`

### 3. Pace Target — 数値で固定する

4 つの指標を数値で:

| 指標 | 何を制御するか | 単位 |
|---|---|---|
| `chars/min` | 発話速度 | 280-380 (JP narration) |
| `talk-time ratio` | 動画尺に対する発話比率 | 40-65% |
| `pause budget` | shot あたり break 数の下限 | 1 shot あたり N 個以上 |
| `1 文の長さ` | 句点ごとの文字数 | 12-28 chars |

例:

| カテゴリ | chars/min | talk-time | pause | 1 文長 |
|---|---|---|---|---|
| worldview | 280-320（遅め） | 40-50% | 0.8s 以上 × 1+ | 15-22 chars |
| feature | 340-380（中庸） | 55-65%（密度高） | 0.4s 以上 × 1 | 18-28 chars |
| persona | 300-350 | 50-60% | 0.5s 以上 × 2+ | 12-22 chars |

⚠️ **break の合計が shot 尺の 30% を超えると LUFS 問題発生** （[後述](#lufs-設計)）。

### 4. Prosody Patterns — SSML テンプレート

ブランドキーワード / 感情キーワードに当てる SSML を **具体的に書く**:

```xml
<!-- 普遍パターン -->
<prosody pitch="+1st" rate="0.92">{{BRAND_NAME}}</prosody>
<prosody pitch="+1st" rate="0.90">{{KEY_VERB_1}}</prosody>
<prosody rate="0.88" pitch="-1st">{{KEY_VERB_2}}</prosody>

<!-- 文構造 -->
- 「、」直後は <break time="0.2-0.3s"/>
- 「。」直後は <break time="0.4-0.6s"/>
- 文末は必ず <break> で締める
```

ElevenLabs voice_settings の推奨値も spec に書く（R-H15 で literal 読み込みされる）:

```json
{
  "stability": 0.70,        // worldview 高め、persona 低め
  "similarity_boost": 0.75, // 共通
  "style": 0.30,            // worldview 0.30 / persona 0.40
  "use_speaker_boost": true // 共通
}
```

### 5. Taboos — 避けるべき声色 / 表現

カテゴリ固有の NG パターン:

| カテゴリ | Taboo の例 |
|---|---|
| worldview | 早口・energetic な抑揚 / 「!」「?」の語気強調 / 「すごい」「最高」 |
| feature | 「業界初」「最強」「圧倒的」/ 「絶対」「必ず」/ ためらいと早口の混在 |
| persona | アナウンサー口調 / 「ぜひ」「みなさん」/ 過剰な感情演技 |

`core.md` の「避けたい表現」を継承しつつ、**カテゴリ別の追加 taboo** を明記する。

### 6. Recommended ElevenLabs Voices — 優先順位リスト

最低 3 段階で voice 優先順位を書く:

| 優先 | voice | 提供 | 備考 |
|---|---|---|---|
| 1st | Sara (`l7ME2dcqpdvq6E8sCS24`) | Professional | calm, mature, deeply soothing。paid 必須 |
| 2nd | Harune | Voice Library | JP-native、calm clarity |
| 3rd | Shin | Voice Library | 男性 variation で使用 |
| fallback | Sarah | premade | 緊急時、EN-trained 非推奨 |

skill C は 1st から順に試行（R-H15）、402 や 5xx で次へフォールバック、結果を cost-report.json の `notes` に記録。

## LUFS 設計

### break 過多の罠

`<break>` を多く入れすぎると **integrated LUFS が極端に下がり、ffmpeg post-master でも持ち上げきれない**。

理由: integrated LUFS は時間平均。break = 無音区間 = -∞ dB が平均値を引き下げる。

**経験則**:

```
1 shot あたりの break 合計 / shot 尺 ≤ 0.30 (30%)
```

例: 5 秒 shot なら break 合計は **1.5 秒以下**。

### 実例（Minima reel-2 shot 1 の失敗）

```xml
<speak>
  <break time="0.3s"/>1日、
  <break time="0.3s"/><prosody>1語</prosody>
  <break time="0.3s"/>。
  <break time="0.4s"/>たった
  <break time="0.2s"/>3問だけ
  <break time="0.6s"/>。
</speak>
```

→ break 合計 2.1s / shot 5s = **42% silence** → raw -38.74 LUFS → mastered -19.73 LUFS（target -16 に届かず）。

修正案:

```xml
<speak>
  <break time="0.3s"/>1日、1語<break time="0.4s"/>。
  たった3問だけ<break time="0.5s"/>。
</speak>
```

→ break 合計 1.2s / shot 5s = 24% silence → target に到達可能。

### Voice settings と LUFS の関係

raw mp3 が極端に小さい場合の対策:

1. **voice_settings.style を上げる** (0.30 → 0.40) — 発話表現幅が広がり、声量も若干上がる
2. **break を減らす** — silence ratio を 30% 以下に
3. **shot 尺を短く** — 5 秒 → 4 秒に詰めて、break ratio を相対的に下げる

## SSML 早見表

ElevenLabs `eleven_turbo_v2_5` で確実に効くタグ:

| タグ | 用途 | 例 |
|---|---|---|
| `<break time="0.5s"/>` | 指定秒数の沈黙 | `今夜も、<break time="0.4s"/>ダラダラ。` |
| `<prosody rate="0.9">テキスト</prosody>` | 読み速度（1.0=標準） | `<prosody rate="0.9">刻んだ</prosody>` |
| `<prosody pitch="+1st">テキスト</prosody>` | 音程 (st=semitone) | `<prosody pitch="+1st">永遠</prosody>` |
| `<prosody volume="loud">テキスト</prosody>` | 音量（silent/soft/medium/loud） | あまり使わない |
| `<emphasis level="strong">テキスト</emphasis>` | アクセント強さ | `<emphasis level="strong">Minima</emphasis>` |
| `<phoneme alphabet="ipa" ph="...">テキスト</phoneme>` | 発音矯正 | 固有名詞の誤読対策 |
| `<say-as interpret-as="date">2025/05/19</say-as>` | 数字/日付の読み方 | TTS の読み間違い対策 |

⚠️ `<break>` を 1 ファイル内に**多用しすぎると安定性が低下**（ElevenLabs 公式注意）。1 shot 5 個以内に留めるのが安全。

## Validation hints（spec の末尾に書く）

各 spec の末尾に、レンダリング後の試聴チェックリストを **5-7 項目** で書く:

```markdown
## Validation hints

レンダリング後の試聴で以下を確認:

- [ ] 冒頭 0.5s 以内に何らかの音が成立しているか
- [ ] 句点後の break が 0.4s 以上あるか
- [ ] ブランドキーワードに他より明らかな抑揚があるか
- [ ] 「announcer」っぽさが出ていないか（試聴者の 2/3 以上が "intimate" と評価）
- [ ] non-native アクセントが感情キーワードに乗っていないか
```

人間 QA / Claude の自動視聴の両方で使える形にする。

## 完成 spec の例

実例として [`/products/minima/assets/voice-spec/worldview.md`](../products/minima/assets/voice-spec/worldview.md) を参考にする（Minima 公開済み）。

新規 product 用には [`/templates/assets/voice-spec/*.md.template`](../templates/assets/voice-spec/) を雛形にして、`{{PLACEHOLDER}}` を置換する形で書き起こすのが最速。

## 関連ドキュメント

- [`content-category-framework.md`](./content-category-framework.md) — カテゴリの考え方
- [`higgsfield-skill-guide.md`](./higgsfield-skill-guide.md) — skill 運用ガイド
- [`../rules/create-advertisement-with-higgsfield-rules.md`](../rules/create-advertisement-with-higgsfield-rules.md) — R-H14 / R-H15 / R-H16 / R-H17
