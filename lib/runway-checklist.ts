/**
 * Runway 画像段階の視覚検証チェックリスト。
 *
 * Skill `create-advertisement-with-runway` の Step 5 で、Claude が
 * gpt_image_2 / gen4_image 出力 PNG を Read tool で読み、ここに定義された各観点で
 * 構造化判定する。
 *
 * 各 key は判定項目、value はその観点の説明文（プロンプト的に使う）。
 * lib/higgsfield-checklist.ts と同型（rule R-R4 と対応）。
 */
export const RUNWAY_IMAGE_CHECKLIST = {
  product_consistency:
    "商品が参照画像と同一に見える（色・形・ロゴ）。referenceImages / @mention タグが効いているか",
  composition:
    "構図が motion_prompt と矛盾しない（後の image_to_video で動きが破綻しない）",
  text_legibility:
    "焼き込みテキストがある場合、読める / 誤字なし",
  no_moderation_block:
    "コンテンツモデレーションで弾かれていない（task が FAILED / moderation 由来でない）",
  no_anatomical_break:
    "手足・指・顔の破綻がない（人物カットのみ。商品単体カットは N/A）",
  brand_safety:
    "core.md の「避けたい表現」と矛盾しない",
} as const;

export type RunwayImageCheckKey = keyof typeof RUNWAY_IMAGE_CHECKLIST;

export type RunwayImageCheckResult = {
  [K in RunwayImageCheckKey]: "pass" | "fail" | "n/a";
};

export type RunwayImageIssue = {
  check: RunwayImageCheckKey;
  severity: "error" | "warning";
  message: string;
};
