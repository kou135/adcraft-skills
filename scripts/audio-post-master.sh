#!/usr/bin/env bash
# audio-post-master.sh — ナレーション mp3 を配信向けにマスタリングする
#
# 使用法:
#   ./scripts/audio-post-master.sh <input.mp3> <output.mastered.mp3>
#
# ふるまい:
#   - 標準 ffmpeg がインストールされていれば、フル 4 段チェーンで処理:
#       highpass=85Hz → equalizer 2.5kHz +2dB → acompressor → loudnorm -16 LUFS
#   - Remotion 同梱 ffmpeg だけしか無ければ、loudnorm のみで処理（部分マスタリング）
#   - どちらも無ければ失敗
#
# 副作用:
#   - stdout に処理経路を 1 行で出力（"full" / "partial" / "failed"）
#   - stderr に loudness の前後比較 JSON を出力
#
# 関連: R-H16（rules/create-advertisement-with-higgsfield-rules.md）

set -euo pipefail

INPUT="${1:-}"
OUTPUT="${2:-}"
TARGET_LUFS="${3:--16}"  # voice-spec 側で -14 等にオーバーライド可（R-H16 default -16）

if [[ -z "$INPUT" || -z "$OUTPUT" ]]; then
  echo "usage: $0 <input.mp3> <output.mastered.mp3> [target_lufs=-16]" >&2
  exit 1
fi

if [[ ! -f "$INPUT" ]]; then
  echo "error: input not found: $INPUT" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT")"

# Remotion 同梱 ffmpeg のパス（macOS arm64 想定）
REMOTION_FFMPEG_DIR="$(pwd)/node_modules/.pnpm/@remotion+compositor-darwin-arm64@4.0.457/node_modules/@remotion/compositor-darwin-arm64"
REMOTION_FFMPEG="$REMOTION_FFMPEG_DIR/ffmpeg"

# フル ffmpeg を優先（brew 等でインストール済み）
if command -v ffmpeg >/dev/null 2>&1; then
  MODE="full"
  FILTER="highpass=f=85,equalizer=f=2500:t=q:w=1.4:g=2,acompressor=threshold=-18dB:ratio=3:attack=5:release=80,loudnorm=I=${TARGET_LUFS}:TP=-1.5:LRA=11"
  ffmpeg -hide_banner -loglevel error -i "$INPUT" -af "$FILTER" -y "$OUTPUT"
elif [[ -x "$REMOTION_FFMPEG" ]]; then
  MODE="partial"
  # Remotion bundled: loudnorm のみ
  export DYLD_FALLBACK_LIBRARY_PATH="$REMOTION_FFMPEG_DIR"
  "$REMOTION_FFMPEG" -hide_banner -loglevel error -i "$INPUT" -af "loudnorm=I=${TARGET_LUFS}:TP=-1.5:LRA=11" -y "$OUTPUT"
else
  echo "failed"
  echo "error: no ffmpeg available (neither system nor Remotion bundled)" >&2
  exit 2
fi

echo "$MODE"

# loudness 計測（処理前後）
measure_lufs() {
  local file="$1"
  local ffmpeg_bin
  if command -v ffmpeg >/dev/null 2>&1; then
    ffmpeg_bin="ffmpeg"
  else
    ffmpeg_bin="$REMOTION_FFMPEG"
    export DYLD_FALLBACK_LIBRARY_PATH="$REMOTION_FFMPEG_DIR"
  fi
  # loudnorm の analyze pass で integrated LUFS を取得
  "$ffmpeg_bin" -hide_banner -nostats -i "$file" -af "loudnorm=I=${TARGET_LUFS}:TP=-1.5:LRA=11:print_format=json" -f null - 2>&1 \
    | awk '/"input_i"/ { gsub(/[",]/, ""); print $2 }' \
    | head -1
}

RAW_LUFS=$(measure_lufs "$INPUT" || echo "n/a")
MASTERED_LUFS=$(measure_lufs "$OUTPUT" || echo "n/a")

cat >&2 <<EOF
{
  "input": "$INPUT",
  "output": "$OUTPUT",
  "mode": "$MODE",
  "raw_integrated_lufs": $RAW_LUFS,
  "mastered_integrated_lufs": $MASTERED_LUFS,
  "target_lufs": ${TARGET_LUFS}.0
}
EOF
