import { Composition } from 'remotion';
import { GeneXplorDemo } from './GeneXplorDemo';
import { SCENES } from './scenes/config';

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;

// Calculate total duration from all scenes
const totalDuration = SCENES.reduce((sum, s) => sum + s.durationInSeconds, 0);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="GeneXplorDemo"
        component={GeneXplorDemo}
        durationInFrames={Math.ceil(totalDuration * FPS)}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
