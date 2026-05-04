import { Composition } from "remotion";
import { DemoSquare } from "./shared/_DemoSquare";

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
