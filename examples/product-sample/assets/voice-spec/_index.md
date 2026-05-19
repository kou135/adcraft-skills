# TaskFlow voice-spec index

`core.md` の `## コンテンツカテゴリ` で定義された 3 カテゴリの音声執行レイヤ。
各 spec は **autonomous run 中は read-only**（R-H17）。

## カテゴリ一覧

| category | file | 一言サマリ | 主訴求軸 |
|---|---|---|---|
| `worldview` | `worldview.md` | 「カオスから解放された朝」の世界観 | 第一訴求軸（1 画面俯瞰） |
| `feature` | `feature.md` | 「30 秒導入 + 1 ボード」の体感実演 | 第二訴求軸（導入の手軽さ） |
| `persona` | `persona.md` | フリーランスの混乱 pain 直撃 | 第一・第二訴求軸ミックス |

## 共通制約

- 言語：日本語。固有名詞は英語のまま（"TaskFlow"）
- TTS engine：ElevenLabs `eleven_turbo_v2_5`
- 出力後処理：ffmpeg post-master 必須（HPF + presence boost + compression + -16 LUFS）
- BGM：feature では soft ambient 許容、worldview/persona は禁止（静謐優先）
- 競合実名（Notion / Asana / Trello 等）の言及禁止
