import { Composition } from "remotion";
import { DemoSquare } from "./shared/_DemoSquare";

/**
 * Remotion のエントリ Root。
 *
 * Skill `create-advertisement` は実行時にこの Root.tsx を編集して、
 * `output/<product>/<date>/<id>.tsx` で定義した Composition を登録する。
 * このファイルにデフォルトで載っているのは視覚検証フローの動作確認用 `DemoSquare` のみ。
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DemoSquare"
        component={DemoSquare}
        durationInFrames={90}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{}}
      />
    </>
  );
};
