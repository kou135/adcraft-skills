/**
 * Remotion 共通ヘルパー（フォーマット定義のみ）。
 *
 * 【責務の境界】
 * Remotion API（useCurrentFrame, interpolate, Sequence, Composition 等）の
 * 使い方そのものは `remotion-dev/skills` の知識に従う。
 * このモジュールは「フォーマット種別ごとの寸法・尺の定数」だけを定義する。
 */

export interface FormatPreset {
  id: string;
  width: number;
  height: number;
  fps: number;
  defaultDurationSec: number;
}

export const FORMAT_PRESETS = {
  reel_9x16: {
    id: "reel_9x16",
    width: 1080,
    height: 1920,
    fps: 30,
    defaultDurationSec: 25,
  },
  horizontal_16x9: {
    id: "horizontal_16x9",
    width: 1920,
    height: 1080,
    fps: 30,
    defaultDurationSec: 25,
  },
  slide_1x1: {
    id: "slide_1x1",
    width: 1080,
    height: 1080,
    fps: 30,
    defaultDurationSec: 0,
  },
  slide_4x5: {
    id: "slide_4x5",
    width: 1080,
    height: 1350,
    fps: 30,
    defaultDurationSec: 0,
  },
} as const satisfies Record<string, FormatPreset>;

export function durationFrames(
  preset: FormatPreset,
  durationSec?: number,
): number {
  const sec = durationSec ?? preset.defaultDurationSec;
  return Math.max(1, Math.round(sec * preset.fps));
}
