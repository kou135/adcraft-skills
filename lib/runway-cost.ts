/**
 * Runway cost / credit estimation for the create-advertisement-with-runway skill.
 *
 * 本 skill は **(A) hosted MCP（https://mcp.runwayml.com/mcp、OAuth）** で接続し、課金は
 * **Runway の Web サブスク・クレジット枠**から引かれる（Higgsfield と同型）。hosted MCP は
 * 残高 / per-call コストを返さない可能性が高いため、消費はクライアント側で **クレジット単位**に推定する (R-R6)。
 *
 * ⚠️ 下記テーブルの credit 値は **Developer API の pricing（2026-05）から得た best-known 推定**。
 *    hosted（web-app サブスク）の実消費はモデルにより異なりうる（例：gen4.5 は web-app 25cr/s vs API 12cr/s。
 *    seedance2 / gpt_image_2 の web-app 消費は未確認）。**接続テストで balance / library の前後差を実測して校正すること。**
 *    USD 換算（CREDIT_USD）は概算 proxy。サブスク運用では「真のハードキャップ = 月次クレジット枠（Standard 625/月 等）」。
 *
 * 対応: lib/cost-tracker.ts の reserve(tracker, estimateRunwayXxxCost(...), {...})
 */

/** 1 credit あたりの USD 換算（概算 proxy。Dev API は $0.01、hosted サブスクでは厳密な $/cr は無い）。 */
export const CREDIT_USD = 0.01;

/**
 * この価格表を docs.dev.runwayml.com/guides/pricing で最後に検証した日付。
 * R-R10 の cost-report.json `notes` に埋め込み、どの価格スナップショットで推定したかを監査可能にする。
 */
export const PRICING_TABLE_VERIFIED = "2026-05-31";

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
  // Kling 3.0（Kuaishou）: Runway 自社 Gen-4.5 超の品質 + seedance2 より大幅に安い。本 skill の動画 1st。
  // ⚠️ model ID literal は **接続時に /mcp で実機確認**（"kling3.0_pro" 等は暫定。Runway の実 ID に合わせる）。
  "kling3.0_pro": { audio: 17, no_audio: 12 },
  "kling3.0_std": { audio: 13, no_audio: 9 },
};

/**
 * 画像モデルの credits/image（2026-05 検証値）。
 * gen4_image: 5(720p)/8(1080p)、gen4_image_turbo: 2、gpt_image_2: 1〜41（品質/解像度で変動。
 * conservative 既定 20）、gemini_image3_pro: 20(1k/2k)/40(4k)、gemini_2.5_flash: 5
 */
export const RUNWAY_IMAGE_CREDITS_PER_IMAGE: Record<string, Tiered> = {
  gen4_image: { "720p": 5, "1080p": 8 },
  gen4_image_turbo: 2,
  // gpt_image_2 は 1〜41 cr と品質/解像度で大きく変動し、resolution を pin しない呼び方では
  // "auto" が 4K 相当で課金されうる。cost guard は過小見積で上限を踏み抜くより premature abort の方が
  // 安全なので、worst case = 41 cr を既定とする（FALLBACK_IMAGE_CREDITS=41 と一貫）。
  gpt_image_2: 41,
  gemini_image3_pro: { "1k": 20, "2k": 20, "4k": 40 },
  "gemini_2.5_flash": 5,
};

// 未知モデルへの fallback（cost guard を安全側に倒すため、既知最大 40(veo3) より上に設定）
const FALLBACK_VIDEO_CREDITS_PER_SEC = 50;
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

/** 動画 1 本（durationSec 秒）の推定消費クレジット（hosted/A 運用の主単位）。 */
export function estimateRunwayVideoCredits(
  model: string,
  durationSec: number,
  opts?: { resolution?: string },
): number {
  const rate = RUNWAY_VIDEO_CREDITS_PER_SEC[model];
  const creditsPerSec =
    rate === undefined ? FALLBACK_VIDEO_CREDITS_PER_SEC : resolveTier(rate, opts?.resolution);
  return creditsPerSec * durationSec;
}

/** 画像 1 枚の推定消費クレジット（hosted/A 運用の主単位）。 */
export function estimateRunwayImageCredits(
  model: string,
  opts?: { resolution?: string },
): number {
  const rate = RUNWAY_IMAGE_CREDITS_PER_IMAGE[model];
  return rate === undefined ? FALLBACK_IMAGE_CREDITS : resolveTier(rate, opts?.resolution);
}

/** 動画 1 本の推定コスト（USD 概算 proxy。cost-tracker 連携用）。 */
export function estimateRunwayVideoCost(
  model: string,
  durationSec: number,
  opts?: { resolution?: string },
): number {
  return estimateRunwayVideoCredits(model, durationSec, opts) * CREDIT_USD;
}

/** 画像 1 枚の推定コスト（USD 概算 proxy。cost-tracker 連携用）。 */
export function estimateRunwayImageCost(
  model: string,
  opts?: { resolution?: string },
): number {
  return estimateRunwayImageCredits(model, opts) * CREDIT_USD;
}

/** クレジット数を直接 USD に変換するユーティリティ。 */
export function creditsToUsd(credits: number): number {
  return credits * CREDIT_USD;
}

// ---- pre-flight 検証ヘルパ（R-R2 / R-R19、Step 2/3/5/6 で API 呼び出し前に使う）----

/** 価格テーブルが populate されているか（lib 破損 / 空テーブルの早期検出、R-R2）。 */
export function isPricingTablePopulated(): boolean {
  return (
    Object.keys(RUNWAY_VIDEO_CREDITS_PER_SEC).length > 0 &&
    Object.keys(RUNWAY_IMAGE_CREDITS_PER_IMAGE).length > 0
  );
}

/** 既知の動画モデル ID か（config preference 検証用、R-R2）。 */
export function isKnownVideoModel(model: string): boolean {
  return model in RUNWAY_VIDEO_CREDITS_PER_SEC;
}

/** 既知の画像モデル ID か（config preference 検証用、R-R2）。 */
export function isKnownImageModel(model: string): boolean {
  return model in RUNWAY_IMAGE_CREDITS_PER_IMAGE;
}

/**
 * ratio が Runway の pixel 文字列形式（"W:H"、各 3〜4 桁）か（R-R19）。
 * "9:16" のような比率表記（1〜2 桁）は false を返す。例: "720:1280" → true。
 */
export function isValidRatio(ratio: string): boolean {
  return /^\d{3,4}:\d{3,4}$/.test(ratio);
}

/**
 * モデル別の許容 duration enum（R-R19.5、固定 enum を持つモデルのみ列挙）。
 * ここに**無い**モデル（seedance2 は 4〜15s の柔軟な範囲、happyhorse_1_0 は 3〜15s 等）は
 * 丸めず pass-through する。enum を持たないモデルに [5,10] を強制すると有効な値を
 * 誤って丸めてしまう（旧実装のバグ）。
 */
export const RUNWAY_VIDEO_DURATION_ENUM: Record<string, number[]> = {
  gen4_turbo: [5, 10],
  "gen4.5": [5, 10],
  gen3a_turbo: [5, 10],
};

/** model の固定 duration enum を返す。柔軟（丸め不要）なモデルは null。 */
export function allowedDurationsFor(model: string): number[] | null {
  return RUNWAY_VIDEO_DURATION_ENUM[model] ?? null;
}

/**
 * duration を許容 enum の最も近い値に丸める（R-R19）。固定 enum を持つモデルにのみ使う
 * （`allowedDurationsFor(model)` が null のモデルには適用しない）。丸めが発生したら呼び出し側で
 * issues.json に `duration_rounded` を記録すること。
 */
export function roundDuration(sec: number, allowed: number[] = [5, 10]): number {
  if (!Array.isArray(allowed) || allowed.length === 0) {
    throw new Error("roundDuration: allowed は非空配列でなければならない");
  }
  if (!Number.isFinite(sec)) {
    throw new Error(`roundDuration: sec は有限数でなければならない (got ${sec})`);
  }
  return allowed.reduce((a, b) => (Math.abs(b - sec) < Math.abs(a - sec) ? b : a));
}

/**
 * 生バイト数を base64 data URI 化したときに Runway の referenceImages 16MB 制約に収まるか
 * （R-R3 / R-R19.6）。base64 は約 4/3 に膨張するため、生ファイルの 16MB チェックだけでは不十分
 * （例：13MB の生ファイル → ~17.3MB の data URI で超過）。reference を base64 で渡す前にこれで判定する。
 */
export function fitsBase64Limit(rawBytes: number, limitBytes: number = 16 * 1024 * 1024): boolean {
  const encodedBytes = Math.ceil(rawBytes / 3) * 4; // base64 膨張（data: prefix 分は誤差範囲）
  return encodedBytes <= limitBytes;
}
