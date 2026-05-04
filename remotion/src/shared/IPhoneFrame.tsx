import type { CSSProperties, ReactNode } from "react";

interface IPhoneFrameProps {
  children: ReactNode;
  /**
   * フレーム外側の幅（px）。デフォルトは 9:16 動画想定で 720px。
   * 動画のアスペクト比に合わせて調整する。
   */
  width?: number;
  /**
   * フレーム本体の色。デフォルトは黒（実機ライク）。
   */
  bezelColor?: string;
  /**
   * 内側スクリーンの背景色。コンテンツが透ける場合に使う。
   */
  screenBackground?: string;
  /**
   * 全体の追加スタイル（位置調整など）。
   */
  style?: CSSProperties;
}

/**
 * 広告動画でユーザー UI を表示するための共通 iPhone フレーム。
 *
 * - 縦長（9:16）動画では中央に配置するのが基本
 * - 内側 children は `overflow: hidden` で角丸クリップされる
 * - 実機の正確な比率ではなく、動画映え重視の簡略化したベゼル
 */
export const IPhoneFrame: React.FC<IPhoneFrameProps> = ({
  children,
  width = 720,
  bezelColor = "#0a0a0a",
  screenBackground = "#ffffff",
  style,
}) => {
  const aspectRatio = 19.5 / 9;
  const height = width * aspectRatio;
  const bezel = Math.round(width * 0.025);
  const radius = Math.round(width * 0.08);

  const containerStyle: CSSProperties = {
    width,
    height,
    backgroundColor: bezelColor,
    borderRadius: radius,
    padding: bezel,
    boxShadow: "0 30px 80px rgba(0, 0, 0, 0.45)",
    position: "relative",
    ...style,
  };

  const screenStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    backgroundColor: screenBackground,
    borderRadius: radius - bezel,
    overflow: "hidden",
    position: "relative",
  };

  const notchWidth = Math.round(width * 0.32);
  const notchHeight = Math.round(width * 0.04);
  const notchStyle: CSSProperties = {
    position: "absolute",
    top: bezel + Math.round(width * 0.018),
    left: "50%",
    transform: "translateX(-50%)",
    width: notchWidth,
    height: notchHeight,
    backgroundColor: bezelColor,
    borderRadius: notchHeight,
    zIndex: 2,
  };

  return (
    <div style={containerStyle}>
      <div style={screenStyle}>{children}</div>
      <div style={notchStyle} />
    </div>
  );
};
