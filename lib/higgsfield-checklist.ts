/**
 * Higgsfield 画像段階の視覚検証チェックリスト。
 *
 * Skill `create-advertisement-with-higgsfield` の Step 5 で、Claude が
 * GPT Image 2 出力 PNG を読み、ここに定義された各観点で構造化判定する。
 *
 * 各 key は判定項目、value はその観点の説明文（プロンプト的に使う）。
 *
 * spec §3.2 / rule R-H4 と対応。
 */
export const HIGGSFIELD_IMAGE_CHECKLIST = {
  product_consistency:
    "商品が参照画像と同一に見える（色・形・ロゴ）",
  composition:
    "構図が motion_prompt と矛盾しない（後の動きが破綻しない）",
  text_legibility:
    "焼き込みテキストがある場合、読める / 誤字なし",
  no_nsfw_false_positive:
    "NSFW判定で返ってきていない（state != nsfw）",
  no_anatomical_break:
    "手足・指・顔の破綻がない（人物カットのみ。商品単体カットは N/A）",
  brand_safety:
    "core.md の「避けたい表現」と矛盾しない",
} as const;

export type HiggsfieldImageCheckKey = keyof typeof HIGGSFIELD_IMAGE_CHECKLIST;

export type HiggsfieldImageCheckResult = {
  [K in HiggsfieldImageCheckKey]: "pass" | "fail" | "n/a";
};

export type HiggsfieldImageIssue = {
  check: HiggsfieldImageCheckKey;
  severity: "error" | "warning";
  message: string;
};
