---
description: products/<name>/ の設定とコンポーネントを使って、Remotion で広告動画を生成・視覚検証・自己修正・MP4 出力する。
argument-hint: <product-name> [count]
---

`adcraft:create-advertisement` skill を起動してください。

入力：
- 対象商品名: $1
- 生成本数（任意、未指定なら config.yaml の count に従う）: $2

skill の SKILL.md と `rules/create-advertisement-rules.md` に書かれた手順に厳密に従ってください。

実行時の前提：
- このコマンドが手動で呼び出された場合でも、計画提示後の確認待ちはせず、**そのまま生成ループに入って最後まで自律実行**してください（ヘッドレス互換）
- Remotion 固有の API 使用方法は `remotion-best-practices` skill のルールに委譲してください
- 配信処理（git push / SNS API / 管理画面連携等）は本 skill の責務外。実装しないでください
- 成果物は `./output/$1/<YYYY-MM-DD>/` に配置してください（カレントワーキングディレクトリ基準の `./output/`）
