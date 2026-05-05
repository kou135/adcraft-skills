---
description: 実プロダクトのソースコードから動画用 UI コンポーネントを抽出する。商品の新規追加時 / UI 大型更新時に使う。
argument-hint: <product-source-path> <product-name>
---

`adcraft:extract-product-ui` skill を起動してください。

入力：
- 対象プロジェクトのパス: $1
- 商品名（kebab-case）: $2

skill の SKILL.md に書かれた手順に厳密に従い、特に以下を遵守してください：

- 対象画面の選択は**必ずユーザーに確認**する（自動推論で勝手に進めない）
- 既存の `core.md` と `config.yaml` は**絶対に上書きしない**（再実行安全性）
- API 呼び出しや認証ガードは置換し、`// TODO: replaced with mock data` コメントを残す
- Tailwind / globals.css が見つからない場合は templates のデフォルトをコピー

引数が不足している場合はユーザーに質問してから進めてください。
