import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

/**
 * Phase 1.5 で「PNG を出して Claude が読めるか」を検証するための最小コンポジション。
 * 視覚検証フローが成立することを確認したら削除/置き換え可。
 */
export const DemoSquare: React.FC = () => {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [0, 89], [0, 600], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(frame, [0, 30, 60, 89], [0, 1, 1, 0.6]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0a",
        justifyContent: "center",
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          marginLeft: 200,
          width: 280,
          height: 280,
          backgroundColor: "#ef4444",
          borderRadius: 24,
          transform: `translateX(${x}px)`,
          opacity,
          boxShadow: "0 0 60px rgba(239, 68, 68, 0.6)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 200,
          width: "100%",
          textAlign: "center",
          color: "#fafafa",
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: 64,
          fontWeight: 700,
          letterSpacing: -1,
        }}
      >
        adcraft demo
      </div>
    </AbsoluteFill>
  );
};
