/**
 * Runway cost estimation for the create-advertisement-with-runway skill.
 *
 * Runway の MCP (runwayml/runway-api-mcp-server) / Developer API は higgsfield の
 * balance() に相当する残高 / transactions tool を提供しない。そのため各生成コストは
 * model + duration + resolution からクライアント側で算出する必要がある (R-R6)。
 *
 * 価格は Developer API のクレジット制（1 credit = $0.01、2026-05 時点）。
 * クレジット単価・モデル ID は頻繁に変わるため、本テーブルはあくまで fallback 既定値。
 * 重要な run の前には docs.dev.runwayml.com/guides/pricing を確認すること。
 *
 * 対応: lib/cost-tracker.ts の reserve(tracker, estimateRunwayXxxCost(...), {...})
 */

/** 1 credit あたりの USD 単価（Developer API）。 */
export const CREDIT_USD = 0.01;

/** 数値（固定）または解像度/オプション別のクレジット数。 */
type Tiered = number | Record<string, number>;

/**
 * 動画モデルの credits/sec（2026-05 検証値）。
 * seedance2: 36(480/720p) / 40(1080p)、gen4_turbo: 5、gen4.5: 12、gen4_aleph: 15、
 * act_two: 5、gen3a_turbo: 5、veo3: 40、veo3.1: 40(audio)/20(no_audio)、
 * veo3.1_fast: 15/10、happyhorse_1_0: 15(720p)/30(1080p)
 */
export const RUNWAY_VIDEO_CREDITS_PER_SEC: Record<string, Tiered> = {
  seedance2: { "480p": 36, "720p": 36, "1080p": 40 },
  "gen4.5": 12,
  gen4_turbo: 5,
  gen3a_turbo: 5,
  gen4_aleph: 15,
  act_two: 5,
  veo3: 40,
  "veo3.1": { audio: 40, no_audio: 20 },
  "veo3.1_fast": { audio: 15, no_audio: 10 },
  happyhorse_1_0: { "720p": 15, "1080p": 30 },
};

/**
 * 画像モデルの credits/image（2026-05 検証値）。
 * gen4_image: 5(720p)/8(1080p)、gen4_image_turbo: 2、gpt_image_2: 1〜41（品質/解像度で変動。
 * conservative 既定 20）、gemini_image3_pro: 20(1k/2k)/40(4k)、gemini_2.5_flash: 5
 */
export const RUNWAY_IMAGE_CREDITS_PER_IMAGE: Record<string, Tiered> = {
  gen4_image: { "720p": 5, "1080p": 8 },
  gen4_image_turbo: 2,
  gpt_image_2: 20, // 1〜41 cr と幅が広い。cost guard 安全側の conservative 既定値
  gemini_image3_pro: { "1k": 20, "2k": 20, "4k": 40 },
  "gemini_2.5_flash": 5,
};

// 未知モデルへの fallback（cost guard を安全側に倒すため高めに設定）
const FALLBACK_VIDEO_CREDITS_PER_SEC = 40;
const FALLBACK_IMAGE_CREDITS = 41;

/**
 * Tiered なクレジット定義から実クレジット数を解決する。
 * tier 指定が無い / 該当しない場合は最大値を返す（cost guard 安全側）。
 */
function resolveTier(rate: Tiered, tier?: string): number {
  if (typeof rate === "number") return rate;
  if (tier && tier in rate) return rate[tier];
  return Math.max(...Object.values(rate));
}

/** 動画 1 本（durationSec 秒）の推定コスト（USD）。 */
export function estimateRunwayVideoCost(
  model: string,
  durationSec: number,
  opts?: { resolution?: string },
): number {
  const rate = RUNWAY_VIDEO_CREDITS_PER_SEC[model];
  const creditsPerSec =
    rate === undefined ? FALLBACK_VIDEO_CREDITS_PER_SEC : resolveTier(rate, opts?.resolution);
  return creditsPerSec * durationSec * CREDIT_USD;
}

/** 画像 1 枚の推定コスト（USD）。 */
export function estimateRunwayImageCost(
  model: string,
  opts?: { resolution?: string },
): number {
  const rate = RUNWAY_IMAGE_CREDITS_PER_IMAGE[model];
  const credits =
    rate === undefined ? FALLBACK_IMAGE_CREDITS : resolveTier(rate, opts?.resolution);
  return credits * CREDIT_USD;
}

/** クレジット数を直接 USD に変換するユーティリティ。 */
export function creditsToUsd(credits: number): number {
  return credits * CREDIT_USD;
}
