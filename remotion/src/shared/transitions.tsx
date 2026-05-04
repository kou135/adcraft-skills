import type { CSSProperties, ReactNode } from "react";
import { interpolate, useCurrentFrame } from "remotion";

interface ZoomInProps {
  children: ReactNode;
  /** ズーム開始フレーム */
  startAt?: number;
  /** ズーム完了フレーム（startAt + duration を想定） */
  duration?: number;
  /** 開始倍率 */
  fromScale?: number;
  /** 終了倍率 */
  toScale?: number;
  /** トランスフォーム原点（CSS transform-origin） */
  origin?: string;
  style?: CSSProperties;
}

/**
 * 子要素を徐々にズームインする。実プロダクト画面の特定箇所をフォーカスしたい時に使う。
 */
export const ZoomIn: React.FC<ZoomInProps> = ({
  children,
  startAt = 0,
  duration = 30,
  fromScale = 1,
  toScale = 1.4,
  origin = "center center",
  style,
}) => {
  const frame = useCurrentFrame();
  const local = frame - startAt;
  const scale = interpolate(local, [0, duration], [fromScale, toScale], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        transform: `scale(${scale})`,
        transformOrigin: origin,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

interface FadeProps {
  children: ReactNode;
  startAt?: number;
  duration?: number;
  direction?: "in" | "out";
  style?: CSSProperties;
}

export const Fade: React.FC<FadeProps> = ({
  children,
  startAt = 0,
  duration = 15,
  direction = "in",
  style,
}) => {
  const frame = useCurrentFrame();
  const local = frame - startAt;
  const range: [number, number] = direction === "in" ? [0, 1] : [1, 0];
  const opacity = interpolate(local, [0, duration], range, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return <div style={{ opacity, ...style }}>{children}</div>;
};

interface ClickRippleProps {
  /** クリック発火フレーム */
  at: number;
  /** リップルが完了する尺（フレーム） */
  duration?: number;
  /** 位置（親要素に対して absolute 配置） */
  x: number;
  y: number;
  /** 最終的な直径（px） */
  size?: number;
  /** リップルカラー */
  color?: string;
}

/**
 * 「クリックされた」演出のためのリップルアニメーション。
 * 親要素は position: relative にしておくこと。
 */
export const ClickRipple: React.FC<ClickRippleProps> = ({
  at,
  duration = 18,
  x,
  y,
  size = 120,
  color = "rgba(255, 255, 255, 0.5)",
}) => {
  const frame = useCurrentFrame();
  const local = frame - at;

  if (local < 0 || local > duration) {
    return null;
  }

  const scale = interpolate(local, [0, duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(local, [0, duration], [0.9, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        transform: `scale(${scale})`,
        opacity,
        pointerEvents: "none",
        zIndex: 10,
      }}
    />
  );
};

interface ScrollSimProps {
  children: ReactNode;
  /** スクロール開始フレーム */
  startAt?: number;
  /** スクロール尺（フレーム） */
  duration?: number;
  /** スクロール量（px。負方向なら下から上へ） */
  distance?: number;
  style?: CSSProperties;
}

/**
 * 「画面をスクロールしている」風の演出。children は縦に長いコンテンツを想定。
 */
export const ScrollSim: React.FC<ScrollSimProps> = ({
  children,
  startAt = 0,
  duration = 60,
  distance = -400,
  style,
}) => {
  const frame = useCurrentFrame();
  const local = frame - startAt;
  const offset = interpolate(local, [0, duration], [0, distance], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        transform: `translateY(${offset}px)`,
        willChange: "transform",
        ...style,
      }}
    >
      {children}
    </div>
  );
};
