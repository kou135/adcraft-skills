import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ValidationIssue, ValidationResult } from "./manifest.ts";

/**
 * 視覚検証の構造化チェックリスト。
 * 実際の判定はメイン Claude が PNG を Read tool で読んで行う。
 * このモジュールは「チェック項目の定義」と「結果保存」を担当する。
 */
export const VISUAL_CHECKLIST: ReadonlyArray<{
  code: string;
  description: string;
}> = [
  {
    code: "frame_overflow",
    description: "全要素が想定アスペクト比（例: 9:16）の枠内に収まっているか",
  },
  {
    code: "text_clipped",
    description: "テキストが見切れていない / 改行崩れがないか",
  },
  {
    code: "z_index_misorder",
    description: "z-index の重なり順が想定通りか",
  },
  {
    code: "element_offscreen",
    description: "アニメーション中に要素が画面外に飛んでいないか",
  },
  {
    code: "iphone_frame_overflow",
    description: "iPhone フレーム使用時、内側にすべての UI が収まっているか",
  },
  {
    code: "general_layout",
    description: "明らかなレイアウト崩れ / 重なりミス / 色のバグがないか",
  },
] as const;

export interface FrameCheck {
  frame_label: string;
  frame_index: number;
  png_path: string;
  passed: boolean;
  issues: ValidationIssue[];
}

export interface PerItemValidationLog {
  id: string;
  iteration: number;
  frames: FrameCheck[];
  overall: ValidationResult;
}

export async function writeValidationLog(
  validationJsonPath: string,
  log: PerItemValidationLog,
): Promise<void> {
  await mkdir(dirname(validationJsonPath), { recursive: true });
  const json = JSON.stringify(log, null, 2) + "\n";
  await writeFile(validationJsonPath, json, "utf8");
}

export function summarizeIssues(frames: FrameCheck[]): ValidationResult {
  const issues = frames.flatMap((f) => f.issues);
  const hasError = issues.some((i) => i.severity === "error");
  return {
    passed: !hasError,
    iterations: 0,
    issues,
  };
}
