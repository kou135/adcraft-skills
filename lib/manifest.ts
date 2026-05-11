import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type ItemType = "reel" | "slide" | "horizontal" | "blog";

export interface ValidationIssue {
  code: string;
  message: string;
  frame?: number;
  severity: "error" | "warning";
}

export interface ValidationResult {
  passed: boolean;
  iterations: number;
  issues: ValidationIssue[];
}

export interface ManifestItem {
  type: ItemType;
  id: string;
  file: string;
  preview: string;
  copy?: string;
  duration_sec?: number;
  validation: ValidationResult;
  variation_note: string;
}

export interface Manifest {
  product: string;
  generated_at: string;
  rules_version: string;
  items: ManifestItem[];
}

/**
 * manifest.json を atomic に書き出す。
 * 一時ファイルに書いてから rename することで、中断時の partial write を防ぐ。
 */
export async function writeManifestAtomic(
  outputDir: string,
  manifest: Manifest,
): Promise<string> {
  const finalPath = join(outputDir, "manifest.json");
  const tmpPath = `${finalPath}.tmp-${process.pid}-${Date.now()}`;

  await mkdir(dirname(finalPath), { recursive: true });
  const json = JSON.stringify(manifest, null, 2) + "\n";

  await writeFile(tmpPath, json, "utf8");
  await rename(tmpPath, finalPath);

  return finalPath;
}

/**
 * 中断・修正不能な動画があった場合の issues.json を atomic に書き出す。
 */
export interface IssuesFile {
  product: string;
  generated_at: string;
  skipped: Array<{
    id: string;
    type: ItemType;
    reason: string;
    last_iteration: number;
    last_issues: ValidationIssue[];
  }>;
}

export async function writeIssuesAtomic(
  outputDir: string,
  issues: IssuesFile,
): Promise<string> {
  const finalPath = join(outputDir, "issues.json");
  const tmpPath = `${finalPath}.tmp-${process.pid}-${Date.now()}`;

  await mkdir(dirname(finalPath), { recursive: true });
  const json = JSON.stringify(issues, null, 2) + "\n";

  await writeFile(tmpPath, json, "utf8");
  await rename(tmpPath, finalPath);

  return finalPath;
}
