/**
 * Cost Tracker for create-advertisement-with-higgsfield skill.
 *
 * MCP呼び出しごとに reserve → API実行 → commit/cancel のライフサイクルで
 * 累計推定コストをトラッキングし、shouldAbort() で上限超過を判定する。
 *
 * spec §3.4 / rule R-H6 と対応。
 */

// 単価テーブル（list_models() が pricing を返さない場合の fallback）
export const HIGGSFIELD_PRICING = {
  "gpt-image-2": { per_image_usd: 0.08 },
  "nano-banana-2": { per_image_usd: 0.05 },
  "seedance2": { per_second_usd: 0.10 },
  "seedance2-fast": { per_second_usd: 0.05 },
} as const;

export const ELEVENLABS_PRICING = {
  per_1000_chars_usd: 0.30,
} as const;

// 未知モデルへの fallback
const FALLBACK_IMAGE_USD = 0.10;
const FALLBACK_VIDEO_PER_SEC_USD = 0.10;

export function estimateImageCost(model: string): number {
  const entry = (HIGGSFIELD_PRICING as Record<string, { per_image_usd?: number }>)[model];
  return entry?.per_image_usd ?? FALLBACK_IMAGE_USD;
}

export function estimateVideoCost(model: string, durationSec: number): number {
  const entry = (HIGGSFIELD_PRICING as Record<string, { per_second_usd?: number }>)[model];
  const rate = entry?.per_second_usd ?? FALLBACK_VIDEO_PER_SEC_USD;
  return rate * durationSec;
}

export function estimateTtsCost(charCount: number): number {
  return (charCount / 1000) * ELEVENLABS_PRICING.per_1000_chars_usd;
}

export type CostHistoryEntry = {
  ts: string;
  step: string;
  shot_index?: number;
  model: string;
  provider?: "higgsfield" | "elevenlabs";
  request_id?: string;
  cost_usd: number;
  spent_running_usd: number;
};

export type CostTracker = {
  spent_usd: number;
  reserved_usd: number;
  limit_usd: number;
  safety_margin: number;
  aborted: boolean;
  history: CostHistoryEntry[];
  // 内部: 進行中の reservation。commit/cancel で消える
  _pending: {
    cost: number;
    step: string;
    shot_index?: number;
    model: string;
    provider?: "higgsfield" | "elevenlabs";
  } | null;
};

export function createCostTracker(opts: {
  limit_usd: number;
  safety_margin?: number;
}): CostTracker {
  return {
    spent_usd: 0,
    reserved_usd: 0,
    limit_usd: opts.limit_usd,
    safety_margin: opts.safety_margin ?? 0.95,
    aborted: false,
    history: [],
    _pending: null,
  };
}

export function reserve(
  t: CostTracker,
  cost: number,
  meta: {
    step: string;
    model: string;
    shot_index?: number;
    provider?: "higgsfield" | "elevenlabs";
  }
): void {
  if (t._pending !== null) {
    throw new Error(
      `CostTracker: cannot reserve while a previous reservation is pending. ` +
        `Call commit() or cancel() first.`
    );
  }
  t._pending = { cost, ...meta };
  t.reserved_usd += cost;
}

export function commit(t: CostTracker, request_id?: string): void {
  if (t._pending === null) {
    throw new Error("CostTracker: commit() called with no active reservation.");
  }
  const p = t._pending;
  t.reserved_usd -= p.cost;
  t.spent_usd += p.cost;
  const entry: CostHistoryEntry = {
    ts: new Date().toISOString(),
    step: p.step,
    model: p.model,
    cost_usd: p.cost,
    spent_running_usd: t.spent_usd,
    ...(p.shot_index !== undefined ? { shot_index: p.shot_index } : {}),
    ...(p.provider !== undefined ? { provider: p.provider } : {}),
    ...(request_id !== undefined ? { request_id } : {}),
  };
  t.history.push(entry);
  t._pending = null;
}

export function cancel(t: CostTracker): void {
  if (t._pending === null) return;
  t.reserved_usd -= t._pending.cost;
  t._pending = null;
}

/**
 * 次の呼び出しを実行した場合に上限超過するかを判定する。
 * 一度 aborted=true になったら以降常に true を返す。
 */
export function shouldAbort(t: CostTracker, nextCallCost: number): boolean {
  if (t.aborted) return true;
  const predicted = t.spent_usd + t.reserved_usd + nextCallCost;
  const ceiling = t.limit_usd * t.safety_margin;
  return predicted > ceiling;
}

export type CostReport = {
  limit_usd: number;
  spent_usd: number;
  aborted_by_cost: boolean;
  session_started_at: string;
  session_ended_at: string;
  by_provider: Record<string, number>;
  history: CostHistoryEntry[];
};

export function toReport(
  t: CostTracker,
  session: { session_started_at: string; session_ended_at: string }
): CostReport {
  const by_provider: Record<string, number> = {};
  for (const e of t.history) {
    const key = e.provider ?? "unknown";
    by_provider[key] = (by_provider[key] ?? 0) + e.cost_usd;
  }
  return {
    limit_usd: t.limit_usd,
    spent_usd: t.spent_usd,
    aborted_by_cost: t.aborted,
    session_started_at: session.session_started_at,
    session_ended_at: session.session_ended_at,
    by_provider,
    history: t.history,
  };
}
