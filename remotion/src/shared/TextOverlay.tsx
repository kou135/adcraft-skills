import type { CSSProperties } from "react";
import { interpolate, useCurrentFrame } from "remotion";

interface TextOverlayProps {
  children: React.ReactNode;
  /** いつアニメーションを開始するか（フレーム） */
  startAt?: number;
  /** フェードイン尺（フレーム） */
  fadeInFrames?: number;
  /** 表示終了するか（指定しなければ最後まで表示） */
  endAt?: number;
  /** フェードアウト尺（フレーム） */
  fadeOutFrames?: number;
  /** 進入方向 */
  enterFrom?: "bottom" | "top" | "none";
  /** 文字色 */
  color?: string;
  /** フォントサイズ（px） */
  fontSize?: number;
  /** font-weight */
  fontWeight?: number;
  /** 配置位置（CSS の position 系プロパティを直接指定する場合） */
  style?: CSSProperties;
}

/**
 * テキストの fade-in / slide-in / fade-out をまとめたオーバーレイ。
 * 動画の「オリジナル紹介画面」シーン用。
 */
export const TextOverlay: React.FC<TextOverlayProps> = ({
  children,
  startAt = 0,
  fadeInFrames = 12,
  endAt,
  fadeOutFrames = 10,
  enterFrom = "bottom",
  color = "#fafafa",
  fontSize = 64,
  fontWeight = 700,
  style,
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startAt;

  const opacityIn = interpolate(localFrame, [0, fadeInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacityOut =
    endAt !== undefined
      ? interpolate(
          frame,
          [endAt - fadeOutFrames, endAt],
          [1, 0],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          },
        )
      : 1;

  const opacity = Math.min(opacityIn, opacityOut);

  const slideOffset = interpolate(localFrame, [0, fadeInFrames], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const transform =
    enterFrom === "bottom"
      ? `translateY(${slideOffset}px)`
      : enterFrom === "top"
      ? `translateY(${-slideOffset}px)`
      : "none";

  const baseStyle: CSSProperties = {
    color,
    fontSize,
    fontWeight,
    fontFamily: "Inter, system-ui, -apple-system, sans-serif",
    letterSpacing: -0.5,
    lineHeight: 1.2,
    opacity,
    transform,
    ...style,
  };

  return <div style={baseStyle}>{children}</div>;
};
