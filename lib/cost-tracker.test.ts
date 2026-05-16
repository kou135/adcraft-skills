import { describe, it, expect, beforeEach } from "vitest";
import {
  createCostTracker,
  estimateImageCost,
  estimateVideoCost,
  estimateTtsCost,
  reserve,
  commit,
  cancel,
  shouldAbort,
  toReport,
  type CostTracker,
} from "./cost-tracker";

describe("cost-tracker: pricing estimators", () => {
  it("estimateImageCost: gpt-image-2 returns $0.08", () => {
    expect(estimateImageCost("gpt-image-2")).toBeCloseTo(0.08, 4);
  });

  it("estimateImageCost: unknown model falls back to $0.10", () => {
    expect(estimateImageCost("future-unknown-model")).toBeCloseTo(0.10, 4);
  });

  it("estimateVideoCost: seedance2 charges $0.10/sec", () => {
    expect(estimateVideoCost("seedance2", 5)).toBeCloseTo(0.50, 4);
  });

  it("estimateVideoCost: seedance2-fast charges $0.05/sec", () => {
    expect(estimateVideoCost("seedance2-fast", 5)).toBeCloseTo(0.25, 4);
  });

  it("estimateTtsCost: 1000 chars = $0.30", () => {
    expect(estimateTtsCost(1000)).toBeCloseTo(0.30, 4);
  });

  it("estimateTtsCost: 500 chars = $0.15", () => {
    expect(estimateTtsCost(500)).toBeCloseTo(0.15, 4);
  });
});

describe("cost-tracker: lifecycle", () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = createCostTracker({
      limit_usd: 10.0,
      safety_margin: 0.95,
    });
  });

  it("createCostTracker: initial state", () => {
    expect(tracker.spent_usd).toBe(0);
    expect(tracker.reserved_usd).toBe(0);
    expect(tracker.limit_usd).toBe(10.0);
    expect(tracker.safety_margin).toBe(0.95);
    expect(tracker.aborted).toBe(false);
    expect(tracker.history).toEqual([]);
  });

  it("reserve increases reserved_usd, commit moves to spent_usd", () => {
    reserve(tracker, 0.5, { step: "generate_video", model: "seedance2" });
    expect(tracker.reserved_usd).toBeCloseTo(0.5, 4);
    expect(tracker.spent_usd).toBe(0);

    commit(tracker, "req_abc");
    expect(tracker.reserved_usd).toBe(0);
    expect(tracker.spent_usd).toBeCloseTo(0.5, 4);
    expect(tracker.history).toHaveLength(1);
    expect(tracker.history[0]?.request_id).toBe("req_abc");
    expect(tracker.history[0]?.spent_running_usd).toBeCloseTo(0.5, 4);
  });

  it("cancel removes reservation without touching spent_usd", () => {
    reserve(tracker, 0.5, { step: "generate_image", model: "gpt-image-2" });
    cancel(tracker);
    expect(tracker.reserved_usd).toBe(0);
    expect(tracker.spent_usd).toBe(0);
    expect(tracker.history).toEqual([]);
  });

  it("multiple commits accumulate spent and history", () => {
    reserve(tracker, 0.08, { step: "generate_image", model: "gpt-image-2" });
    commit(tracker, "req_1");
    reserve(tracker, 0.50, { step: "generate_video", model: "seedance2" });
    commit(tracker, "req_2");

    expect(tracker.spent_usd).toBeCloseTo(0.58, 4);
    expect(tracker.history).toHaveLength(2);
    expect(tracker.history[1]?.spent_running_usd).toBeCloseTo(0.58, 4);
  });
});

describe("cost-tracker: abort judgement", () => {
  it("shouldAbort: predicted <= limit * margin → false", () => {
    const t = createCostTracker({ limit_usd: 10, safety_margin: 0.95 });
    t.spent_usd = 5.0;
    // limit*margin = 9.5、予測 5.0 + 0 + 3.0 = 8.0 → safe
    expect(shouldAbort(t, 3.0)).toBe(false);
  });

  it("shouldAbort: predicted > limit * margin → true", () => {
    const t = createCostTracker({ limit_usd: 10, safety_margin: 0.95 });
    t.spent_usd = 8.0;
    // limit*margin = 9.5、予測 8.0 + 0 + 2.0 = 10.0 → abort
    expect(shouldAbort(t, 2.0)).toBe(true);
  });

  it("shouldAbort considers reserved_usd too", () => {
    const t = createCostTracker({ limit_usd: 10, safety_margin: 0.95 });
    t.spent_usd = 7.0;
    t.reserved_usd = 2.0;
    // 7 + 2 + 1 = 10 > 9.5 → abort
    expect(shouldAbort(t, 1.0)).toBe(true);
  });

  it("once aborted=true, stays aborted", () => {
    const t = createCostTracker({ limit_usd: 10, safety_margin: 0.95 });
    t.aborted = true;
    expect(shouldAbort(t, 0.01)).toBe(true);
  });
});

describe("cost-tracker: report", () => {
  it("toReport: serializes provider breakdown and history", () => {
    const t = createCostTracker({ limit_usd: 10, safety_margin: 0.95 });
    reserve(t, 0.08, {
      step: "generate_image",
      model: "gpt-image-2",
      shot_index: 0,
      provider: "higgsfield",
    });
    commit(t, "req_img_0");
    reserve(t, 0.30, {
      step: "tts",
      model: "eleven_turbo_v2_5",
      provider: "elevenlabs",
    });
    commit(t, "req_tts");

    const report = toReport(t, {
      session_started_at: "2026-05-16T22:00:00+09:00",
      session_ended_at: "2026-05-16T22:15:00+09:00",
    });

    expect(report.limit_usd).toBe(10);
    expect(report.spent_usd).toBeCloseTo(0.38, 4);
    expect(report.aborted_by_cost).toBe(false);
    expect(report.by_provider["higgsfield"]).toBeCloseTo(0.08, 4);
    expect(report.by_provider["elevenlabs"]).toBeCloseTo(0.30, 4);
    expect(report.history).toHaveLength(2);
    expect(report.session_started_at).toBe("2026-05-16T22:00:00+09:00");
  });
});
