# create-advertisement-with-higgsfield Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Higgsfield MCP (GPT Image 2 + Seedance 2.0) と ElevenLabs MCP を組み合わせて、`products/<name>/` のマーケ方針から実写級の広告動画（MVP: 1本/20秒/4カット/9:16）を生成する新skill `create-advertisement-with-higgsfield` を、既存 `create-advertisement` と完全併存する形で追加する。

**Architecture:** Hybrid 二段skill — 新skillは「ショット計画 + Higgsfield 画像/動画生成 + ElevenLabs TTS + 既存共通コンポーネントでの Remotion 合成 + 既存 R7 検証ループ + render + manifest 書き出し」までを直接担う。既存 `lib/` (manifest atomic write / validators / format presets) と `remotion/src/shared/*` (IPhoneFrame / TextOverlay / transitions) を最大限流用。新規ユーティリティ `lib/cost-tracker.ts` で $10/run のハードガードを実装。R-H1〜R-H13 の不変ルールは `rules/create-advertisement-with-higgsfield-rules.md` に分離。

**Tech Stack:** TypeScript (strict, ES2022) / pnpm / Remotion 4.x / vitest (新規追加) / Higgsfield MCP (公式OAuth) / ElevenLabs MCP (公式)

**Spec:** `docs/superpowers/specs/2026-05-16-create-advertisement-with-higgsfield-design.md` (commit 5491174)

---

## File Structure（実装で touch する全ファイル）

### 新規作成
| Path | Responsibility |
|---|---|
| `lib/cost-tracker.ts` | CostTracker 型 / 単価テーブル / abort 判定 / history 管理 |
| `lib/cost-tracker.test.ts` | cost-tracker のユニットテスト（vitest） |
| `lib/higgsfield-checklist.ts` | `HIGGSFIELD_IMAGE_CHECKLIST` 定義（画像段階の検証観点） |
| `rules/create-advertisement-with-higgsfield-rules.md` | R-H1〜R-H13 の不変ルール |
| `skills/create-advertisement-with-higgsfield/SKILL.md` | メインskill（手続き記述） |
| `vitest.config.ts` | vitest 設定（必要なら） |

### 既存修正
| Path | Change |
|---|---|
| `package.json` | devDependencies に `vitest`、scripts に `test`/`test:run` 追加 |
| `lib/validators.ts` | （任意）`HIGGSFIELD_IMAGE_CHECKLIST` を re-export |
| `templates/config.yaml.template` | `higgsfield:` セクション追記 |
| `.gitignore` | `output/**/.assets/` 追記 |

### ユーザー手動操作（コードではない）
| Path | Action |
|---|---|
| `products/taskflow/config.yaml` | `higgsfield:` セクション追記（E2E用） |
| `products/taskflow/assets/reference/*` | 商品リファレンス画像配置 |
| `products/taskflow/assets/bgm/*.mp3` | BGM 配置 |
| Claude Code MCP 設定 | Higgsfield と ElevenLabs を `claude mcp add` |

---

## Commit Strategy（コミット単位の方針）

**基本:** 1タスク = 1commit。テストと実装が同じビルドに必要な場合（TDDの red→green→commit）は 1commit にまとめる。リファクタは別 commit。

**Prefix統一（Conventional Commits風）:**
- `feat:` 新機能 / 新ファイル / 新セクション追加
- `fix:` バグ修正
- `docs:` ドキュメント / spec / rules / plan
- `chore:` ビルド設定 / .gitignore / 依存追加
- `test:` テストの追加・修正
- `refactor:` 振る舞いを変えない整理

**Co-Authored-By trailer:** 既存コミット (commit 5491174 等) と同じ形式：

```
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

**コミット禁止対象:**
- `git push` / `gh pr create` / `gh release` は `.claude/settings.local.json` で deny 済み。実装者も実行しない（R10/R-H11踏襲）
- E2E 実行結果（`output/<product>/<date>/` 配下）は `.gitignore` 済み → commit 対象外

---

## Task Dependency Graph

```
Task 0 (chore: vitest)
  ↓
Task 1 (chore: .gitignore) ─┐
Task 2 (feat: checklist)   ─┼─→ Task 4 (docs: rules)
Task 3 (feat: cost-tracker)─┘    ↓
                                Task 5 (docs: config template)
                                  ↓
                                Task 6 (feat: SKILL.md)
                                  ↓
                                Task 7 (chore: product setup, 手動)
                                  ↓
                                Task 8 (chore: MCP接続, 手動)
                                  ↓
                                Task 9 (E2E: MVP 1本生成, 実機)
                                  ↓
                                Task 10 (docs: 検証レポート)
```

**並列可能:** Task 1 / 2 / 3 / 4 / 5 はTask 0 完了後、互いに独立して並行作業可。Task 6 はそれらすべて完了後。

---

## Task 0: vitest を devDependency に追加

**目的:** Task 3 の TDD に必要な test runner を整える。

**Files:**
- Modify: `package.json` (devDependencies + scripts)
- Create: `vitest.config.ts`

**完了条件:**
- `pnpm test:run` が「No test files found, exiting with code 0」程度で正常終了する（テスト未配置でもエラーなく抜ける）
- `pnpm typecheck` が通る

**Steps:**

- [ ] **Step 0.1: vitest 追加**

Run:
```bash
pnpm add -D vitest@^1.6.0
```

Expected: `package.json` の `devDependencies` に `"vitest": "^1.6.0"` が追記され、`pnpm-lock.yaml` も更新。

- [ ] **Step 0.2: `package.json` の scripts に test コマンド追加**

Edit `package.json` の `scripts`:
```json
  "scripts": {
    "typecheck": "tsc --noEmit",
    "remotion:studio": "remotion studio remotion/src/Root.tsx",
    "remotion:still": "remotion still",
    "remotion:render": "remotion render",
    "test": "vitest",
    "test:run": "vitest run"
  },
```

- [ ] **Step 0.3: `vitest.config.ts` を作成**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
    globals: false,
  },
});
```

- [ ] **Step 0.4: scripts が動くか確認**

Run:
```bash
pnpm test:run
```

Expected: `No test files found` で exit 0 になる（または `RUN v1.6.x` の後 0 tests）。

- [ ] **Step 0.5: typecheck が通るか確認**

Run:
```bash
pnpm typecheck
```

Expected: エラーなしで終了（exit 0）。

- [ ] **Step 0.6: commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts
git commit -m "$(cat <<'EOF'
chore: add vitest as dev dependency for TDD

cost-tracker と将来追加するユーティリティの単体テスト用に vitest を導入。
依存は dev のみ、production には影響なし。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 1: `.gitignore` に中間素材ディレクトリを追加

**目的:** `output/**/.assets/` を git に乗せないようにする（巨大バイナリ排除、R-H9）。

**Files:**
- Modify: `.gitignore`

**完了条件:**
- `.gitignore` の output 関連セクションに `output/**/.assets/` 行が追記されている
- `git check-ignore output/test/2026-05-16/.assets/foo.png` が exit 0（ignore対象として認識される）

**Steps:**

- [ ] **Step 1.1: 現在の `.gitignore` を確認**

Read `.gitignore` し、`output/` 関連の既存行を確認。

- [ ] **Step 1.2: `output/**/.assets/` を追記**

Edit `.gitignore`、output セクションの末尾に追加：
```gitignore
# Higgsfield skill 中間素材（生成画像/動画/TTS）
output/**/.assets/
```

- [ ] **Step 1.3: 検証**

Run:
```bash
git check-ignore -v "output/test/2026-05-16/.assets/foo.png"
```

Expected: stdout に `.gitignore:NN:output/**/.assets/ ...` のように表示され、exit 0。

- [ ] **Step 1.4: commit**

```bash
git add .gitignore
git commit -m "$(cat <<'EOF'
chore(gitignore): exclude higgsfield intermediate assets dir

create-advertisement-with-higgsfield が output/<product>/<date>/.assets/
に保存する shot-N.png / shot-N.mp4 / narration.mp3 等の中間素材を
git管理対象外にする（巨大バイナリ排除、R-H9）。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `lib/higgsfield-checklist.ts` を新規作成

**目的:** Higgsfield 画像段階の検証チェックリストをコードに落とす。spec §3.2 をそのまま型化。

**Files:**
- Create: `lib/higgsfield-checklist.ts`

**完了条件:**
- TypeScript として `HIGGSFIELD_IMAGE_CHECKLIST` がexport されている
- `pnpm typecheck` 通過

**Steps:**

- [ ] **Step 2.1: ファイル作成**

Create `lib/higgsfield-checklist.ts`:
```ts
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
```

- [ ] **Step 2.2: typecheck**

Run:
```bash
pnpm typecheck
```

Expected: エラーなし、exit 0。

- [ ] **Step 2.3: commit**

```bash
git add lib/higgsfield-checklist.ts
git commit -m "$(cat <<'EOF'
feat(lib): add HIGGSFIELD_IMAGE_CHECKLIST

Higgsfield 画像段階の検証チェックリストを定義。
spec §3.2 / R-H4 の 6 観点（product_consistency / composition /
text_legibility / no_nsfw_false_positive / no_anatomical_break /
brand_safety）を型付きで export。SKILL.md 内で Claude が PNG を読
んだ際の構造化判定に使う。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `lib/cost-tracker.ts` を TDD で実装

**目的:** $10/run コストガードの中核。単価テーブル、累計トラッキング、abort 判定、history 管理を提供する。

**Files:**
- Create: `lib/cost-tracker.ts`
- Create: `lib/cost-tracker.test.ts`

**完了条件:**
- `pnpm test:run lib/cost-tracker.test.ts` がすべて pass
- `pnpm typecheck` 通過
- 関数: `createCostTracker(opts)` / `estimateImageCost(model)` / `estimateVideoCost(model, durationSec)` / `estimateTtsCost(charCount)` / `reserve(tracker, cost, meta)` / `commit(tracker, requestId?)` / `cancel(tracker)` / `shouldAbort(tracker, nextCost)` / `toReport(tracker)` をエクスポート

**Steps:**

- [ ] **Step 3.1: テストファイル先に作成（failing tests）**

Create `lib/cost-tracker.test.ts`:
```ts
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
```

- [ ] **Step 3.2: テストが失敗することを確認（red）**

Run:
```bash
pnpm test:run
```

Expected: `Cannot find module './cost-tracker'` または相当のエラーで全テストfail。

- [ ] **Step 3.3: `lib/cost-tracker.ts` 実装**

Create `lib/cost-tracker.ts`:
```ts
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
```

- [ ] **Step 3.4: テストが通ることを確認（green）**

Run:
```bash
pnpm test:run
```

Expected: 全テスト (18件前後) が pass、exit 0。

- [ ] **Step 3.5: typecheck**

Run:
```bash
pnpm typecheck
```

Expected: エラーなし。

- [ ] **Step 3.6: commit（test と impl を同時に）**

```bash
git add lib/cost-tracker.ts lib/cost-tracker.test.ts
git commit -m "$(cat <<'EOF'
feat(lib): add cost-tracker for higgsfield skill

$10/run のハードコストガードを担う CostTracker と関連ユーティリティを
TDD で実装。reserve → commit/cancel のライフサイクルで進行中の予約と
確定済支出を分離管理し、shouldAbort() で safety_margin (default 0.95)
込みで予測判定する。単価テーブルは fallback として hardcode、Higgsfield
の list_models() が pricing を返すなら呼び出し側で上書き可能。

vitest 18件すべて pass。

spec §3.4 / R-H6 対応。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `rules/create-advertisement-with-higgsfield-rules.md` を新規作成

**目的:** R-H1〜R-H13 の不変ルールを spec §4 から rules ファイルに転記。skill が実行時に Read する正本。

**Files:**
- Create: `rules/create-advertisement-with-higgsfield-rules.md`

**完了条件:**
- ファイル先頭に version (`1.0.0`) とゴール記述
- R-H1〜R-H13 がすべて記載
- 「受入基準」「アンチパターン」セクションを含む
- 既存 `rules/create-advertisement-rules.md` と同じスタイル（見出し階層、表記）

**Steps:**

- [ ] **Step 4.1: 既存 rules ファイルの構造を参照**

Read `rules/create-advertisement-rules.md` し、構造（ゴール / 不変ルール / 受入基準 / アンチパターン）を踏襲する。

- [ ] **Step 4.2: ファイル作成**

Create `rules/create-advertisement-with-higgsfield-rules.md`:

````markdown
# create-advertisement-with-higgsfield Rules

> **Skill `create-advertisement-with-higgsfield` の不変ルール（v1.0.0）**
>
> Skill は実行のたびに**まず**このファイルを読み込み、内容に従って動画生成を行う。
> 既存 `create-advertisement-rules.md` の R1-R13 とは独立した R-H 系統を採用。
> 本ファイルの version は `manifest.json` の `higgsfield_rules_version` に記録される。

## ゴール

- Higgsfield MCP（GPT Image 2 + Seedance 2.0）と ElevenLabs MCP を用いて、
  `products/<name>/core.md` のマーケ方針に基づく実写級の広告動画を生成する。
- MVP は **1 本 / 20 秒 / 4 カット / 9:16**。
- 1 run のコストは `config.yaml.higgsfield.cost_limit_usd`（デフォルト $10）を絶対遵守する。
- 既存 `create-advertisement` skill / R1-R13 ルール / output 構造を壊さず併存する。
- 配信は本 skill の責務外（既存 R10 を継承）。

## 不変ルール

### R-H1. MCP 疎通確認（起動時）

skill 起動時に以下を順に確認し、1 つでも失敗したら停止する：

1. Higgsfield MCP の `list_models()` を呼ぶ → 200 OK & モデル 1 個以上返る
2. ElevenLabs MCP の lightweight call（例: `list_voices()`）→ 200 OK
3. `products/<name>/assets/reference/*.{png,jpg,jpeg,webp}` が 1 枚以上存在
4. `products/<name>/assets/bgm/*.mp3` が 1 枚以上存在（`bgm.required: true` のとき）

停止時は `MCP_NOT_CONNECTED` / `REFERENCE_IMAGE_MISSING` / `BGM_MISSING` 等の明確な reason を stdout に出し、ユーザーに `claude mcp add` 手順を案内する。

### R-H2. モデル ID は動的解決、ハードコード禁止

- `list_models()` の結果から `config.yaml.higgsfield.image.model_preference` と `.video.model_preference` の優先順で照合し、最初に存在する ID を使う。
- preference に書かれた全モデルが list 結果に存在しないなら停止。
- 選択結果は `output/<product>/<date>/.assets/<id>/assets-manifest.json` にキャッシュし、同セッション中は再問い合わせ不要。

### R-H3. 商品リファレンス画像の一貫性参照

- skill 起動後最初に `upload_image()` で `products/<name>/assets/reference/*` を Higgsfield にホスト。
- 返却 URL を `assets-manifest.json` にキャッシュ。
- **全カットの `generate_image()` 呼び出しで同じ参照 URL を渡す**（商品一貫性のため）。
- リファレンス画像が複数なら全 upload、各カットで関連するものを選んでプロンプトで indicate。

### R-H4. 画像段階は厳格検証 / 動画段階は 1 発主義

| 段階 | リトライ予算 | 失敗時の挙動 |
|---|---|---|
| 画像（GPT Image 2） | 初回 + リトライ最大 2 回（合計 3 回まで） | そのカットの動画化を中止、`issues.json` 記録、次カットへ |
| 動画（Seedance 2.0） | 1 回のみ | **静止画フォールバック**（R-H5） |
| 合成（既存 R7） | 既存 R7 踏襲、最大 3 回 | 動画スキップ（既存 R8） |

`config.yaml.higgsfield.video.one_shot: false` にした場合のみ動画再生成を許容（明示オプトイン、デフォルト true）。

### R-H5. 動画 NG 時の静止画フォールバック

- 動画生成失敗 / `state: failed` / `state: nsfw` / 動画段階軽量検証 NG の場合
- `.tsx` 内で当該カットは `<Video src=...mp4>` の代わりに **`<Img src=...png>` + `<ZoomIn>` (Ken Burns 効果)** を使う
- `issues.json` に `type: "video_fallback_to_image"` を info レベルで記録
- これは「失敗扱いではなく許容済み挙動」

### R-H6. コスト上限の絶対遵守

- `config.yaml.higgsfield.cost_limit_usd`（未指定なら $10）を `cost_tracker.limit_usd` に反映。
- 各 `generate_image` / `generate_video` / TTS 呼び出し**前**に予測判定：

  ```
  if (spent_usd + reserved_usd + next_call_cost > limit_usd * safety_margin) → abort
  ```

- `safety_margin` のデフォルトは `0.95`（$10 上限なら $9.50 で stop）。
- abort 時：
  - `issues.json` に `cost_limit_reached`（at_step / at_shot / predicted_cost）を記録
  - **生成済カットだけで最終 Remotion 合成を試行**（部分成果でも出す）
  - 全カット未着なら manifest を items 空で書いて終了
- headless 時もユーザー確認なしで即 abort（既存 R12 を継承）。

### R-H7. 直列実行

- 同一カット内：画像 → 動画は直列。
- カット間：カット 0 → 1 → 2 → 3 直列。
- 例外：ElevenLabs TTS は画像/動画生成と並列 OK（別 MCP）。
- 並列化は MVP 範囲外。`config.yaml.higgsfield.parallel: false`（デフォルト）。

### R-H8. エラーバックオフ

- HTTP 429 → 指数 backoff `5s → 15s → 45s` 後諦め
- HTTP 5xx → 指数 backoff `2s → 6s → 18s` 後諦め
- `subscribe()` long-poll タイムアウトは 3 分
- バックオフ中の wait は cost_tracker 非加算（呼び出し成功時のみ加算）

### R-H9. 中間素材の永続化 & クリーンアップ

- `output/<product>/<date>/.assets/<id>/` に `shot-plan.yaml` / `shot-N.png` / `shot-N.mp4`（または fallback 時なし）/ `narration.mp3` / `assets-manifest.json` を保存。
- abort / crash 時も**残す**（再開・デバッグ用）。
- `config.yaml.validation.strict_mode: true` のときのみ最終 render 後に削除。
- `.gitignore` に `output/**/.assets/` を追加（巨大バイナリ排除）。

### R-H10. cost-report.json は必ず出力

- 成功 / 失敗 / abort いずれの終了でも `cost-report.json` を atomic write。
- 内訳：`by_provider` / `history` 配列 / `aborted_by_cost` フラグ。
- ユーザーが課金を後から検証できる証跡として機能。

### R-H11. 既存 R10 / R11 / R12 を継承

- **R10（配信責務外）**: そのまま継承。git push / SNS API / Slack 通知等は実装しない。
- **R11（整合性チェック）**: core.md placeholder / config 不正 / formats 全 false / **assets/reference 空 / assets/bgm 空（required時）** を停止条件に加える。
- **R12（headless 時のユーザー確認スキップ）**: そのまま継承。`headless` / `自律実行` / `承認不要` / `auto` / `そのまま生成` 等のキーワードで自動承認。

### R-H12. 投稿コピー（R13）の継承

- 既存 R13 そのまま継承：`<id>.md`（フロントマター + フック + 本文 + ハッシュタグ 5 本）。
- 違いは `variation_note` に「Higgsfield 版 / 生成 AI による差別化軸」が反映される点。

### R-H13. ファイル命名でエンジン識別

- 動画 ID 命名規則：`<product>-hf-<type>-<index>`（例：`taskflow-hf-reel-1`）。
- `-hf-` プレフィックスで既存 skill 出力（`taskflow-reel-1`）と衝突回避。
- Composition id（`remotion/src/Root.tsx`）も同じ命名。

## 受入基準

1. `output/<product>/<date>/` に MP4 1 本（MVP 想定）、`.preview.png`、`.md`、`manifest.json`、`issues.json`、`cost-report.json` が揃う
2. `manifest.json` の `engine: "higgsfield"`、`cost.aborted_by_cost: false`（正常完了時）、各 `models_used` 記載
3. `pnpm exec tsc --noEmit` がエラーなく通る
4. 視覚チェック pass（または `issues.json` で明示的説明）
5. `cost.spent_usd ≤ cost.limit_usd`
6. `<id>.md` が R13 フォーマット準拠
7. 中間素材 `.assets/<id>/` に `shot-plan.yaml` / `shot-N.png` / `shot-N.mp4`（または fallback 記録）/ `narration.mp3` が揃う

## アンチパターン

- ❌ モデル ID をハードコードする（必ず `list_models()` で解決）
- ❌ 商品リファレンス画像なしで `generate_image` する
- ❌ 動画を複数回再生成する（コスト爆発）
- ❌ cost guard を無視 / `cost_limit_usd: 0` で実質無制限化する設定を許容する
- ❌ 並列化でレート制限を踏み抜く（MVP は直列）
- ❌ `.assets/<id>/` を生成途中で削除する（crash 後再開不能になる）
- ❌ `cost-report.json` を出さずに終了する
- ❌ Higgsfield 側の `state: nsfw` を握り潰して通す
- ❌ R10 違反（配信処理を「ついでに」実装）
- ❌ 既存 `create-advertisement` 出力ファイルと衝突する命名
````

- [ ] **Step 4.3: commit**

```bash
git add rules/create-advertisement-with-higgsfield-rules.md
git commit -m "$(cat <<'EOF'
docs(rules): add R-H1..R-H13 for higgsfield skill

Skill `create-advertisement-with-higgsfield` の不変ルールを定義。
既存 create-advertisement-rules.md (R1-R13) とは独立した R-H 系統で、
MCP疎通確認 / モデルID動的解決 / 商品一貫性 / 画像厳格&動画1発主義 /
静止画フォールバック / コスト上限絶対遵守 / 直列実行 / バックオフ /
中間素材永続化 / cost-report必須出力 / 既存R10-R13継承 / 命名規約 を網羅。

higgsfield_rules_version: 1.0.0

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `templates/config.yaml.template` に `higgsfield:` セクション追記

**目的:** 新しい商品セットアップ時に higgsfield 用のフィールドが自動で雛形に入るようにする。

**Files:**
- Modify: `templates/config.yaml.template`

**完了条件:**
- 既存フィールド（formats, output, validation, variation）はそのまま
- 末尾に `higgsfield:` セクションが追記され、コメント付きでデフォルト値が記載されている
- YAML としてパース可能（インデント整合）

**Steps:**

- [ ] **Step 5.1: 既存 template を確認**

Read `templates/config.yaml.template` し、末尾を確認。

- [ ] **Step 5.2: `higgsfield:` セクションを追記**

Edit `templates/config.yaml.template`、末尾に追加：

```yaml

# create-advertisement-with-higgsfield skill 用設定
# 使わない場合は higgsfield.enabled: false にすればOK（既存 create-advertisement のみ動く）
higgsfield:
  enabled: false              # true にすると新skillが起動可能になる
  cost_limit_usd: 10.00       # 1run あたりのハードコスト上限（USD）
  cost_safety_margin: 0.95    # 実停止しきい値（limit_usd * safety_margin で abort）
  shots_per_video: 4          # 1動画あたりカット数
  shot_duration_sec: 5        # 1カット秒数（合計 = formats.reel.duration と一致させる）
  parallel: false             # MVP は直列固定
  image:
    model_preference:
      - "gpt-image-2"         # 第一優先
      - "nano-banana-2"       # fallback
    max_iterations_per_shot: 3  # 初回 + リトライ最大2回
  video:
    model_preference:
      - "seedance2"
      - "seedance2-fast"
    one_shot: true            # true: 動画失敗時は静止画fallback、再生成しない
    fallback_to_static: true
  tts:
    provider: "elevenlabs"
    voice_id: ""              # ElevenLabs voice ID を貼る（未設定なら起動時停止）
    model_id: "eleven_turbo_v2_5"
  bgm:
    required: true            # false なら BGM 配置なしでも動く（無音）
    selection: "auto"         # auto / explicit。explicit なら下の explicit_file 指定
    # explicit_file: "energetic-01.mp3"
```

- [ ] **Step 5.3: YAML パーステスト**

Run:
```bash
node -e "const yaml=require('js-yaml'); const fs=require('fs'); console.log(JSON.stringify(yaml.load(fs.readFileSync('templates/config.yaml.template','utf8')), null, 2))"
```

Expected: JSON でダンプされ、`higgsfield` キーが含まれる。エラーなし。

（`js-yaml` が未導入なら `pnpm add -D js-yaml @types/js-yaml` で導入、または `python -c "import yaml; yaml.safe_load(open('templates/config.yaml.template'))"` で代替）

- [ ] **Step 5.4: commit**

```bash
git add templates/config.yaml.template
git commit -m "$(cat <<'EOF'
feat(templates): add higgsfield section to config.yaml.template

新商品の config.yaml 雛形に higgsfield: セクションを追加。デフォルトは
enabled: false で、既存 create-advertisement skill 動作には影響なし。
cost_limit_usd / model_preference / one_shot / bgm 等の設定項目を
コメント付きで明示。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `skills/create-advertisement-with-higgsfield/SKILL.md` を新規作成

**目的:** メインskillの手続き記述。Claude が実行時に Read して指示通りに動く正本。

**Files:**
- Create: `skills/create-advertisement-with-higgsfield/SKILL.md`

**完了条件:**
- `name` / `description` フロントマターが既存 `create-advertisement/SKILL.md` と同じスタイル
- Step 0〜10 が記述されている
- 各 Step で参照する R-H 番号を明示
- 既存 `create-advertisement/SKILL.md` で参照されている `remotion-best-practices` への委譲を維持
- ヘッドレス実行コマンド例を含む

**Steps:**

- [ ] **Step 6.1: 既存 SKILL.md の構造を参照**

Read `skills/create-advertisement/SKILL.md` し、文体・節構成・ヘッドレス例を踏襲する。

- [ ] **Step 6.2: ファイル作成**

Create `skills/create-advertisement-with-higgsfield/SKILL.md`:

````markdown
---
name: create-advertisement-with-higgsfield
description: products/<name>/ の core.md と config.yaml.higgsfield: を入力に、Higgsfield MCP (GPT Image 2 + Seedance 2.0) で実写級の画像/動画を生成し、ElevenLabs MCP でナレーション TTS を作って Remotion で時系列合成、視覚検証ループを経て output/<product>/<YYYY-MM-DD>/ に MP4 等を配置する。MVPは1本/20秒/4カット/9:16。コスト上限 $10/run を絶対遵守。配信は責務外。トリガー例：「higgsfield版で広告動画を作って」「create-advertisement-with-higgsfield」「<商品名> をHiggsfieldで生成」。
---

# create-advertisement-with-higgsfield

商品ごとのマーケ方針（`core.md`）と機械設定（`config.yaml`）を入力に、Higgsfield MCP と ElevenLabs MCP で素材を生成し、Remotion で合成する Skill。既存 `create-advertisement` と完全併存する。

## 依存

このSkillは以下に依存する。**事前に確認**すること：

- **`remotion-dev/skills`（remotion-best-practices）**：Remotion API（`useCurrentFrame`, `interpolate`, `Sequence`, `Composition` 等）の正しい使い方を提供する公式 Skill。本 Skill は Remotion 固有の実装方法を**再定義しない**。
  - 未インストールの場合：`npx skills add remotion-dev/skills` の実行を案内し、停止する。
- **Higgsfield MCP**: 公式リモートMCP `https://mcp.higgsfield.ai/mcp` (OAuth, Higgsfield Team plan以上)。未接続なら停止し `claude mcp add` 手順を案内。
- **ElevenLabs MCP**: 公式 (APIキー要)。未接続なら停止し案内。
- **`lib/cost-tracker.ts`** / **`lib/higgsfield-checklist.ts`**: 本skill実装で利用する内部ユーティリティ。
- **`rules/create-advertisement-with-higgsfield-rules.md`**: 不変ルール（R-H1〜R-H13）。skill起動時に必ず読む。

## 実行モード

- **対話モード**：Claude Code UI から手動呼び出し。生成計画を立てたら実行前に確認を求める。
- **headless モード**：`claude -p "create-advertisement-with-higgsfield で …"` から起動。`--permission-mode bypassPermissions` 前提で自動承認して進む。

R-H11（既存R12継承）により、プロンプトに `headless` / `自律実行` / `承認不要` / `auto` / `そのまま生成` 等のキーワード、または「最後まで」「停止せず」「全自動で」等の連続実行表現があれば、対話モードでも確認をスキップする。

## 入力

ユーザーが指定する：

1. **対象商品名**（1つ、MVPは複数同時不可）
2. （任意）特定フォーマット指定（MVPは `reel` のみ対応）
3. （任意）方向性指示（「クリーンめで」等、ショット計画に反映）

## 処理フロー

### Step 0. ルール読み込み（必須） — R-H1

1. `rules/create-advertisement-with-higgsfield-rules.md` を Read で読み込む。R-H1〜R-H13 を**必ず適用**する。
2. Higgsfield MCP の `list_models()` を呼ぶ → 200 OK & モデル ≥ 1 を確認。失敗なら `MCP_NOT_CONNECTED: higgsfield` で停止し、`claude mcp add` 手順を案内。
3. ElevenLabs MCP の lightweight call → 200 OK 確認。失敗なら停止。

### Step 1. 商品設定の読み込みと整合性チェック — R-H11

各対象商品について：

1. `products/<name>/core.md` を読む（プレースホルダのままならエラー停止）
2. `products/<name>/config.yaml` を読む（`yaml` パッケージで parse）
   - `higgsfield.enabled: true` でない場合は「`config.yaml.higgsfield.enabled` を true にしてください」で停止
3. `products/<name>/assets/reference/*.{png,jpg,jpeg,webp}` が 1 枚以上あること → なければ `REFERENCE_IMAGE_MISSING` で停止
4. `products/<name>/assets/bgm/*.mp3` が 1 枚以上あること（`bgm.required: true` のとき）→ なければ `BGM_MISSING` で停止
5. `formats.reel.enabled == true && count >= 1` を確認

### Step 2. モデル ID 動的解決 + Cost Tracker 初期化 — R-H2, R-H6

```ts
import { createCostTracker } from "../../lib/cost-tracker";

const models = await mcp.higgsfield.list_models();
const image_model_id = pickByPreference(models, cfg.higgsfield.image.model_preference);
const video_model_id = pickByPreference(models, cfg.higgsfield.video.model_preference);
// 全 preference に該当なしなら停止

const cost_tracker = createCostTracker({
  limit_usd: cfg.higgsfield.cost_limit_usd ?? 10.00,
  safety_margin: cfg.higgsfield.cost_safety_margin ?? 0.95,
});
```

選択結果は後で `assets-manifest.json` にキャッシュする。

### Step 3. ショット計画

`core.md` の訴求軸とブランドトーンから、Claude が 4 カット構成を立案：

- 各カットの `purpose` / `duration_sec` / `visual_prompt`（GPT Image 2 用）/ `motion_prompt`（Seedance 用）/ `narration_text`（ElevenLabs 用、空可）
- 合計 duration が `formats.reel.duration` と一致するように
- R-H11（R12継承）に従い、対話モードでは計画を提示してユーザー確認、headless ならそのまま実行

計画は `output/<product>/<YYYY-MM-DD>/.assets/<id>/shot-plan.yaml` に保存。

### Step 4. 商品リファレンス画像の upload — R-H3

1. `products/<name>/assets/reference/*` を `upload_image()` でホスト
2. 返却 URL を `.assets/<id>/assets-manifest.json` にキャッシュ
3. 以降の全 `generate_image()` でこの URL を参照に渡す

### Step 5. 画像生成ループ（カット単位、直列） — R-H4, R-H7, R-H8

各カット index 0..3 について：

1. **cost guard**：`shouldAbort(tracker, next_call_cost)` を呼ぶ。true なら abort → Step 8 へジャンプ（生成済カットだけで合成試行）
2. `reserve(tracker, estimateImageCost(image_model_id), { step: "generate_image", model: image_model_id, shot_index, provider: "higgsfield" })`
3. `generate_image(model_id, prompt, reference_url)` → `request_id`
4. `subscribe(request_id)`（タイムアウト 3 分）→ 完了 URL 取得
5. 画像をダウンロード → `output/<product>/<date>/.assets/<id>/shot-N.png`
6. **画像視覚チェック**：PNG を Read tool で読み、`HIGGSFIELD_IMAGE_CHECKLIST`（`lib/higgsfield-checklist.ts`）で構造化判定
7. 判定 OK なら `commit(tracker, request_id)`。NG なら `commit` した上で次の反復へ（最大 3 回 = 初回 + リトライ 2）
8. 3 回 NG → そのカットをスキップ、`issues.json` に `image_validation_failed` 記録、次カットへ
9. **エラー時**：HTTP 429/5xx は R-H8 のバックオフ、`state: nsfw` はプロンプト微調整 1 回リトライ、`state: failed` は 1 回リトライ、それでも失敗なら `cancel(tracker)` してそのカットスキップ

### Step 6. 動画生成ループ（カット単位、1 発主義） — R-H4, R-H5

画像 OK だったカットだけ：

1. **cost guard**
2. `reserve(tracker, estimateVideoCost(video_model_id, shot.duration_sec), { step: "generate_video", model: video_model_id, shot_index, provider: "higgsfield" })`
3. `generate_video(model_id, image_url=uploaded_shot_N, prompt=motion_prompt, duration=shot.duration_sec)`
4. `subscribe()` → 完了
5. ダウンロード → `.assets/<id>/shot-N.mp4`
6. **動画段階軽量検証**：致命的破綻のみ（途中切れ / 黒画面 / 1 秒未満）。NG なら：
   - mp4 を残さず、`issues.json` に `video_fallback_to_image` を info で記録
   - Step 8 で `<Img src=shot-N.png>` + `<ZoomIn>` を使う
7. `commit(tracker, request_id)`（成功時のみ）/ `cancel(tracker)`（致命破綻時のみ）

### Step 7. ナレーション TTS 生成（ElevenLabs、Step 5/6 と並列実行可）— R-H7

1. **cost guard**：`shouldAbort(tracker, estimateTtsCost(全narration合計char数))`
2. 全カットの `narration_text` を結合 → 全体スクリプト
3. `reserve(tracker, estimateTtsCost(chars), { step: "tts", model: cfg.higgsfield.tts.model_id, provider: "elevenlabs" })`
4. ElevenLabs MCP の TTS ツールに渡す（`voice_id`, `model_id` は config から）
5. mp3 ダウンロード → `.assets/<id>/narration.mp3`
6. `commit(tracker)`
7. **失敗時**：`cancel(tracker)`、無音で続行、`issues.json` に `tts_failed` 記録

### Step 8. Remotion `.tsx` 生成

Claude が `output/<product>/<date>/<id>.tsx` を直接書く。命名は R-H13 に従い `<product>-hf-reel-<index>`（例：`taskflow-hf-reel-1`）。

骨子：

```tsx
import { AbsoluteFill, Audio, Sequence, Video, Img, staticFile } from "remotion";
import { ZoomIn } from "../../remotion/src/shared/transitions";
import { TextOverlay } from "../../remotion/src/shared/TextOverlay";

export const TaskflowHfReel1 = () => (
  <AbsoluteFill>
    <Audio src={staticFile("products/taskflow/assets/bgm/<chosen>.mp3")} volume={0.2} />
    <Audio src={staticFile("output/taskflow/2026-05-16/.assets/taskflow-hf-reel-1/narration.mp3")} />
    {/* カット0: 0〜5sec */}
    <Sequence from={0} durationInFrames={150}>
      <Video src={staticFile("output/taskflow/2026-05-16/.assets/taskflow-hf-reel-1/shot-0.mp4")} />
      <TextOverlay text="..." startAt={15} endAt={120} />
    </Sequence>
    {/* カット2: 静止画フォールバック例 */}
    <Sequence from={300} durationInFrames={150}>
      <ZoomIn>
        <Img src={staticFile("output/taskflow/2026-05-16/.assets/taskflow-hf-reel-1/shot-2.png")} />
      </ZoomIn>
    </Sequence>
  </AbsoluteFill>
);
```

`remotion/src/Root.tsx` に Composition を登録：

```tsx
<Composition
  id="taskflow-hf-reel-1"
  component={TaskflowHfReel1}
  durationInFrames={20 * 30}
  fps={30}
  width={1080}
  height={1920}
/>
```

> Remotion API の使い方（`useCurrentFrame`, `interpolate`, `Sequence`, `Composition` の宣言場所、`spring` の使いどころ等）は `remotion-dev/skills` のルールに従う。本 Skill 内で再定義しない。

### Step 9. 既存 R7 検証ループ + render

ここからは既存 `create-advertisement` パイプラインと同じ：

1. `pnpm exec remotion still <entry> <id> <png-path> --frame=N` で 3 フレーム抽出（frame=0 / mid / end）
2. Claude が PNG を Read で視覚チェック（既存 `VISUAL_CHECKLIST`、`lib/validators.ts`）
3. `pnpm exec tsc --noEmit` で型チェック
4. 問題あれば `.tsx` 修正（**素材は再生成しない、合成だけ調整**）→ 最大 3 回（`config.yaml.validation.max_iteration`）
5. OK なら `pnpm exec remotion render <entry> <id> <output-mp4>` で MP4 出力
6. `<id>.preview.png` として frame 0 をコピー
7. `<id>.validation.json` に構造化結果を atomic write

### Step 10. 投稿コピー + manifest + cost-report — R-H10, R-H12

1. **投稿コピー（R-H12 = R13継承）**：`<id>.md` を生成（フロントマター + フック + 本文 + ハッシュタグ 5 本）。`lib/manifest.ts` の writeManifestAtomic と同じ atomic 書き込みを使う。
2. **manifest.json**（atomic write）：`engine: "higgsfield"`、`rules_version: "1.0.0"`、`higgsfield_rules_version: "1.0.0"`、`cost.{limit_usd, spent_usd, aborted_by_cost}`、`items[].models_used` を含む。
3. **cost-report.json**（atomic write）：`toReport(tracker, {session_started_at, session_ended_at})` の戻り値をそのまま書く。**成功 / 失敗 / abort のいずれでも必ず出力**（R-H10）。
4. **issues.json**：途中で記録した issue がある場合のみ書く。
5. **中間ファイル**：`.assets/<id>/` は basic 残す。`strict_mode: true` のみ削除。

### Step 11. stdout 終了サマリ

```
✅ create-advertisement-with-higgsfield 完了

product:    <name>
output:     output/<name>/<date>/
duration:   <分秒>
cost:       $<spent> / $<limit> (<%>)

動画:
  ✅ <id>.mp4 (<duration>秒, <shots>カット, validation pass)
     ※ 必要なら shot[N] の fallback 等を併記

issues:     <件数>件
詳細:       output/<name>/<date>/{manifest,issues,cost-report}.json
```

## アンチパターン（やらないこと）

R-H に書かれた禁則に加えて：

- ❌ Composition id を `<product>-hf-` プレフィックスなしで作る（既存と衝突）
- ❌ `output/` の外にファイルを書く
- ❌ 視覚チェックなしで render する
- ❌ 1 カット失敗で全体停止する（次カットへ進む）
- ❌ 配信処理（git / gh / curl で SNS API、Slack 通知等）を「便利だから」追加する
- ❌ `core.md` を読まずに config だけで生成する
- ❌ Remotion 実装の細かい使い方を本 Skill 内で考え込む（→ remotion-best-practices に委譲）
- ❌ Higgsfield の `state: nsfw` を無視する

## ヘッドレス実行コマンド（cron 用）

```bash
cd /path/to/adcraft && \
  unset ANTHROPIC_API_KEY && \
  claude -p "create-advertisement-with-higgsfield skill で taskflow の動画を1本生成して。承認不要、最後まで自律実行して。" \
    --permission-mode bypassPermissions \
    --max-turns 200 \
    --output-format stream-json --verbose \
    >> logs/$(date +%Y%m%d-%H%M%S).log 2>&1
```

**ヘッドレス実行で詰まらないためのポイント**：
- `bypassPermissions` を使う（`acceptEdits` だと `pnpm exec remotion still` 等の Bash で止まる）
- プロンプトに「承認不要、自律実行して」等を含める（R-H11 のユーザー確認をスキップさせる）
- `--output-format stream-json --verbose` で無音状態を回避

## エラーハンドリング

| 状況 | 対応 |
|---|---|
| Higgsfield MCP 未接続 | 起動時停止、`claude mcp add` 手順を案内 |
| ElevenLabs MCP 未接続 | 起動時停止 |
| `core.md` がプレースホルダのまま | 停止、ユーザーに記入を促す |
| `config.yaml.higgsfield.enabled: false` | 停止、有効化を案内 |
| `assets/reference/` 空 | 停止、商品画像配置を案内 |
| `assets/bgm/` 空 + `bgm.required: true` | 停止、BGM 配置を案内 |
| 画像 3 回 NG | カット動画化中止、`issues.json` 記録、次カットへ |
| 動画 1 発 NG | 静止画フォールバック、`issues.json` 記録、続行 |
| TTS 失敗 | 無音で続行、`issues.json` 記録 |
| cost 上限到達 | 即 abort、生成済カットで合成試行 |
| Remotion R7 検証 3 回 NG | 動画スキップ（既存 R8） |
| Claude Code トークン切れ | プロセス終了、外側スケジューラに任せる |
| `output/` 書き込み権限なし | 即停止、ユーザー通知 |
````

- [ ] **Step 6.3: commit**

```bash
git add skills/create-advertisement-with-higgsfield/SKILL.md
git commit -m "$(cat <<'EOF'
feat(skills): add create-advertisement-with-higgsfield SKILL.md

Higgsfield MCP (GPT Image 2 + Seedance 2.0) と ElevenLabs MCP を用いて
広告動画を生成する新skillの手続き記述を追加。Step 0(ルール/MCP疎通) から
Step 11(stdoutサマリ) までフロー、エラーハンドリング表、ヘッドレス実行
コマンドを完備。既存 create-advertisement と完全併存。

実装ファイル参照: rules/create-advertisement-with-higgsfield-rules.md
(R-H1..R-H13), lib/cost-tracker.ts, lib/higgsfield-checklist.ts。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 商品 `taskflow` のリファレンス画像 / BGM / config 設定（手動作業を含む）

**目的:** E2E 実行のための商品セットアップ。`taskflow` を実機 MVP の対象とする。

**Files:**
- Create (user manual): `products/taskflow/assets/reference/*.{png,jpg}`（商品画像 1枚以上）
- Create (user manual): `products/taskflow/assets/bgm/*.mp3`（BGM 1曲以上）
- Modify: `products/taskflow/config.yaml`（`higgsfield:` セクション追記）

**完了条件:**
- `ls products/taskflow/assets/reference/` で 1 枚以上のpngまたはjpgがある
- `ls products/taskflow/assets/bgm/` で 1 つ以上の mp3 がある
- `products/taskflow/config.yaml` の `higgsfield.enabled: true`、`tts.voice_id` が有効値で埋まっている

**Steps:**

- [ ] **Step 7.1: assets ディレクトリ作成**

Run:
```bash
mkdir -p products/taskflow/assets/reference products/taskflow/assets/bgm
```

- [ ] **Step 7.2: ユーザー手動アクション — リファレンス画像配置**

ユーザーへの指示：「TaskFlow の商品スクリーンショットや UI を表現する画像を 1〜3 枚、`products/taskflow/assets/reference/` に配置してください（png/jpg、各 < 5MB 推奨、横長 / 縦長どちらでも可）」。

完了後 `ls -la products/taskflow/assets/reference/` で確認。

- [ ] **Step 7.3: ユーザー手動アクション — BGM 配置**

ユーザーへの指示：「ロイヤリティフリーまたは商用利用可能な BGM mp3 を 1 曲以上、`products/taskflow/assets/bgm/` に配置してください（20 秒以上の長さがあるもの推奨）」。

完了後 `ls -la products/taskflow/assets/bgm/` で確認。

- [ ] **Step 7.4: ユーザー手動アクション — ElevenLabs voice_id 取得**

ユーザーへの指示：「ElevenLabs ダッシュボード（https://elevenlabs.io/app/voice-library）から使いたい voice の ID をコピーしてください（28 文字程度の英数字文字列）」。

- [ ] **Step 7.5: `products/taskflow/config.yaml` に higgsfield: 追記**

Edit `products/taskflow/config.yaml`、末尾に：

```yaml

higgsfield:
  enabled: true
  cost_limit_usd: 10.00
  cost_safety_margin: 0.95
  shots_per_video: 4
  shot_duration_sec: 5
  parallel: false
  image:
    model_preference:
      - "gpt-image-2"
      - "nano-banana-2"
    max_iterations_per_shot: 3
  video:
    model_preference:
      - "seedance2"
      - "seedance2-fast"
    one_shot: true
    fallback_to_static: true
  tts:
    provider: "elevenlabs"
    voice_id: "<ユーザーがStep 7.4で取得した値>"
    model_id: "eleven_turbo_v2_5"
  bgm:
    required: true
    selection: "auto"
```

また既存の `formats.reel.duration` を `20`（MVP）に揃える（既存値が異なる場合）。

- [ ] **Step 7.6: 検証**

Run:
```bash
ls -la products/taskflow/assets/reference/ products/taskflow/assets/bgm/
cat products/taskflow/config.yaml | grep -A 2 "higgsfield:"
```

Expected: 画像 / BGM ファイルが各 1 つ以上存在、`higgsfield.enabled: true`。

- [ ] **Step 7.7: commit（config だけ、画像/音声は .gitignore 検討の余地あり）**

```bash
git add products/taskflow/config.yaml
git commit -m "$(cat <<'EOF'
feat(products): enable higgsfield in taskflow config

taskflow の E2E テスト用に higgsfield: セクションを追加し
enabled: true に設定。MVP 構成（4カット×5秒、cost_limit_usd: 10）。

リファレンス画像 / BGM は products/taskflow/assets/ にユーザー手動配置
（バイナリは別途扱い、必要なら別 commit）。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

> **NOTE:** `products/taskflow/assets/` のバイナリを git に乗せるかは**ユーザー判断**。乗せる場合は `git add products/taskflow/assets/` を別 commit で。乗せない場合は `.gitignore` に `products/*/assets/reference/` `products/*/assets/bgm/` を追加（ただし他商品の同様アセットも除外される点に注意）。

---

## Task 8: MCP接続のセットアップ確認（手動作業）

**目的:** Higgsfield と ElevenLabs の MCP を Claude Code に接続し、実行時に呼び出せる状態にする。

**Files:** （コード変更なし、Claude Code 設定の更新）

**完了条件:**
- `claude mcp list` で `higgsfield` と `elevenlabs` が listed
- 両方とも疎通 OK（`list_models` / `list_voices` 相当が成功）

**Steps:**

- [ ] **Step 8.1: Higgsfield MCP の OAuth 接続**

ユーザーへの指示：

1. Claude Code を起動し、Settings → Connectors → "Add custom connector"
2. Name: `higgsfield`、URL: `https://mcp.higgsfield.ai/mcp`
3. "Connect" を押し OAuth 認証画面で Higgsfield アカウント（Team plan 以上）にログイン
4. 権限を "Always Allow" に設定

代替（CLI）：
```bash
claude mcp add --transport http higgsfield https://mcp.higgsfield.ai/mcp
```

- [ ] **Step 8.2: ElevenLabs MCP の追加**

ユーザーへの指示：

1. ElevenLabs API キーを取得（https://elevenlabs.io/app/settings/api-keys）
2. Claude Code 設定に追加：

```bash
claude mcp add elevenlabs uvx -- elevenlabs-mcp \
  --env ELEVENLABS_API_KEY=<your_key>
```

または `~/.claude.json` を直接編集（ユーザー判断）。

- [ ] **Step 8.3: 疎通確認**

Run（Claude Code 内から）:
```
/mcp
```

Expected: `higgsfield` と `elevenlabs` の両方が "connected" 状態。

- [ ] **Step 8.4: lightweight call テスト**

Claude Code セッション内で：

```
higgsfield の list_models を呼んで結果を3件だけ見せて
```

Expected: モデル ID が複数返ってくる（gpt-image-2, seedance2 等が含まれることを目視確認）。

```
elevenlabs の voice list を3件だけ見せて
```

Expected: voice 一覧が返る。

- [ ] **Step 8.5: モデル ID の存在確認（Open Question §8-1 への回答取得）**

Run（Claude Code 内）:
```
higgsfield list_models の結果から "gpt-image-2" と "seedance2" の正確なIDをコピペして
```

控えた ID を `products/taskflow/config.yaml.higgsfield.image.model_preference` / `.video.model_preference` の先頭に入れる（既に該当 ID なら変更なし）。

> **NOTE:** この Task はコード変更を伴わないため commit なし。ただし Step 8.5 で `config.yaml` を修正した場合は Task 7 の commit に amend するか、`fix(products): use correct higgsfield model ids for taskflow` で別 commit。

---

## Task 9: E2E 実行 — MVP 1 本生成

**目的:** 実機で Higgsfield/ElevenLabs を叩いて 1 本生成する。設計のバリデーション + コスト実測。

**Files:** （コード変更なし、output 生成のみ）

**完了条件:**
- `output/taskflow/2026-05-16/taskflow-hf-reel-1.mp4` が生成される
- `manifest.json` / `issues.json` / `cost-report.json` が出力される
- `cost.spent_usd ≤ $10` かつ `aborted_by_cost: false`
- 動画を再生して概ね意図通りの広告になっている

**Steps:**

- [ ] **Step 9.1: Pre-flight チェック**

Run:
```bash
pnpm typecheck && \
  ls -la products/taskflow/assets/reference/ products/taskflow/assets/bgm/ && \
  cat products/taskflow/config.yaml | grep -A 1 "enabled" | head -10
```

Expected: typecheck pass、reference/bgm に各 1 ファイル以上、`higgsfield.enabled: true`。

- [ ] **Step 9.2: skill 実行（対話モード推奨、初回はコストモニタリング目的）**

Claude Code セッション内で：

```
create-advertisement-with-higgsfield skill で taskflow を1本作って。途中で計画と各カット生成のコスト報告を見せて
```

Step 3 でショット計画が提示されたら**注意深くレビュー**。問題なければ承認して続行。

- [ ] **Step 9.3: 実行ログを観察**

Step 5/6 で各カットの画像 → 動画生成が直列に走る。各 commit 時のログで `spent_running_usd` が増えていくのを確認。

途中で `cost_limit_reached` が出たら spec §3.4 通り abort される。

- [ ] **Step 9.4: 完了時の stdout サマリを確認**

Expected:
```
✅ create-advertisement-with-higgsfield 完了
product:    taskflow
output:     output/taskflow/2026-05-16/
duration:   <X>分<Y>秒
cost:       $<spent> / $10.00 (X%)
動画:
  ✅ taskflow-hf-reel-1.mp4 (20秒, 4カット, validation pass)
issues:     <N>件
```

- [ ] **Step 9.5: 出力ファイル検証**

Run:
```bash
ls -la output/taskflow/2026-05-16/
cat output/taskflow/2026-05-16/manifest.json | head -50
cat output/taskflow/2026-05-16/cost-report.json | head -30
cat output/taskflow/2026-05-16/issues.json 2>/dev/null || echo "(no issues)"
```

Expected:
- `taskflow-hf-reel-1.mp4` 存在 & ファイルサイズ > 0
- `taskflow-hf-reel-1.preview.png` 存在
- `taskflow-hf-reel-1.md` 存在 & R13 フォーマット準拠
- `manifest.json` の `engine: "higgsfield"`、`cost.aborted_by_cost: false`
- `cost-report.json` の `by_provider` に higgsfield と elevenlabs の両方が出ている

- [ ] **Step 9.6: 動画再生確認**

Run:
```bash
open output/taskflow/2026-05-16/taskflow-hf-reel-1.mp4
```

Expected: macOS の QuickTime で再生され、20 秒の 9:16 動画で、4 カット + BGM + ナレーションが乗っている。

- [ ] **Step 9.7: 出力に関する commit はなし、ただし設定 fix が必要なら別 commit**

`output/` は `.gitignore` 済みなので commit 不要。

E2E で発覚した SKILL.md / rules / cost-tracker の修正が必要なら：

```bash
git add <修正したファイル>
git commit -m "fix(higgsfield): <発覚した問題と修正内容>"
```

---

## Task 10: E2E 結果レポートを spec に追記

**目的:** 初回 E2E のコスト・所要時間・気付きを spec の Open Questions セクションに追記して将来の参照に残す。

**Files:**
- Modify: `docs/superpowers/specs/2026-05-16-create-advertisement-with-higgsfield-design.md`（§8 Open Questions の解消 / §10 として新規 "E2E 1回目の実測結果" 追加）

**完了条件:**
- spec §8 のうち実機で確認された項目（モデル単価、upload_image の TTL、URL 直参照可否、NSFW 誤検知頻度）に答えが書かれる
- 新規 §10 セクションに 1 回目 E2E のサマリ（コスト・所要時間・成功カット数 / fallback 数）が記載される

**Steps:**

- [ ] **Step 10.1: Open Questions の答えを spec に書き戻す**

Edit `docs/superpowers/specs/2026-05-16-create-advertisement-with-higgsfield-design.md`、§8 の各項目に `### 実機確認結果（2026-05-16）` サブセクションを追記し、`cost-report.json` / 体感 / 試行ログから判明したことを書く。

- [ ] **Step 10.2: §10 を追加**

セクション末尾に新規 §10：

```markdown
## §10. E2E 1 回目の実測結果（2026-05-16）

| 項目 | 値 |
|---|---|
| 所要時間 | <X>分<Y>秒 |
| 合計コスト | $<spent> / $10 上限 |
| 画像生成成功 | <N>/4 カット |
| 動画生成成功 | <N>/4 カット（うち静止画 fallback <M>） |
| TTS 成功 | yes/no |
| Remotion R7 反復回数 | <N> |
| 主な気付き | <フリーテキスト> |
| 次に詰めるべき点 | <フリーテキスト> |
```

- [ ] **Step 10.3: commit**

```bash
git add docs/superpowers/specs/2026-05-16-create-advertisement-with-higgsfield-design.md
git commit -m "$(cat <<'EOF'
docs(spec): record first E2E run results for higgsfield skill

§8 の Open Questions に実機で確認された値を追記、新規 §10 で1回目E2Eの
所要時間/コスト/成功率/気付きをサマリ。今後の改善方針の起点に。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Summary

**Spec coverage check:**

| Spec section | Implemented in |
|---|---|
| §1 Architecture | Task 2, 3, 4, 6 |
| §2 Data Flow Step 0-10 | Task 6 (SKILL.md内に手続き全記述) |
| §3 検証 / Cost Guard / Error Handling | Task 2, 3, 4, 6 |
| §3.9 出力ファイルスキーマ | Task 6 (Step 10 内) |
| §3.10 stdout サマリ | Task 6 (Step 11) |
| §4 R-H1〜R-H13 | Task 4 |
| §5 config.yaml 拡張 | Task 5 + Task 7 |
| §6 受入基準 | Task 4 + Task 9 (E2E検証) |
| §7 アンチパターン | Task 4 + Task 6 |
| §8 Open Questions | Task 8, 9 で実機確認、Task 10 でspec反映 |
| §9 Implementation files | Task 0, 1, 2, 3, 4, 5, 6 |

**Placeholder scan:** "TBD" や「適切な〜」の表現は plan 内になし（確認済）。ユーザー手動アクション（画像配置・voice_id 取得・MCP 接続）は明示的に user task として記述、自動化はしない（性質上できない）。

**Type consistency:**
- `CostTracker` / `CostHistoryEntry` / `CostReport` の型名は Task 3 と Task 6 で一致
- 関数名 `createCostTracker` / `reserve` / `commit` / `cancel` / `shouldAbort` / `toReport` / `estimateImageCost` / `estimateVideoCost` / `estimateTtsCost` は Task 3 のテストと実装、Task 6 の SKILL.md 例で一貫
- `HIGGSFIELD_IMAGE_CHECKLIST` / `HiggsfieldImageCheckKey` / `HiggsfieldImageCheckResult` / `HiggsfieldImageIssue` は Task 2 と Task 6 で一致

---

## Commit Summary（先頭から末尾までの全 commit 一覧）

| # | Prefix | 概要 | Task |
|---|---|---|---|
| 1 | `chore` | vitest 追加 + test script | Task 0 |
| 2 | `chore(gitignore)` | `output/**/.assets/` 除外 | Task 1 |
| 3 | `feat(lib)` | `HIGGSFIELD_IMAGE_CHECKLIST` 追加 | Task 2 |
| 4 | `feat(lib)` | cost-tracker.ts + tests (TDD で同一 commit) | Task 3 |
| 5 | `docs(rules)` | R-H1..R-H13 ルール定義 | Task 4 |
| 6 | `feat(templates)` | config.yaml.template に higgsfield セクション | Task 5 |
| 7 | `feat(skills)` | SKILL.md 本体 | Task 6 |
| 8 | `feat(products)` | taskflow config.yaml に higgsfield 追記 | Task 7 |
| 9 | （任意）`fix(higgsfield)` | E2E で発覚した修正 | Task 9 |
| 10 | `docs(spec)` | E2E 結果を spec に追記 | Task 10 |

各 commit に `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer を含める。`git push` は禁止（`.claude/settings.local.json` で deny 済、本 plan でも明示）。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-16-create-advertisement-with-higgsfield-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task で実装し、各タスク後にレビュー。実装の独立性が高い Task 0-5 を並列処理できるため最も速い。

**2. Inline Execution** — このセッション内で `superpowers:executing-plans` skill を使って逐次実装。checkpoint で確認しながら進む。

**Which approach?**
