import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, interpolate } from 'remotion';
import { SCENES } from './scenes/config';
import { IntroScene } from './components/IntroScene';
import { OutroScene } from './components/OutroScene';
import { FeatureScene } from './components/FeatureScene';
import { SceneTransition } from './components/SceneTransition';
import { ProgressBar } from './components/ProgressBar';
import { SceneIndicator } from './components/SceneIndicator';
import { LightSweep } from './components/LightSweep';

const FPS = 30;

// Transition variants cycle through different styles
const TRANSITION_VARIANTS: Array<'fade' | 'slide-left' | 'slide-up' | 'zoom' | 'fade-slide'> = [
  'fade',        // intro
  'fade-slide',  // homepage
  'slide-left',
  'zoom',
  'fade-slide',
  'slide-up',
  'slide-left',
  'zoom',
  'fade-slide',
  'slide-up',
  'slide-left',
  'fade-slide',
  'zoom',
  'slide-left',
  'fade-slide',
  'slide-up',
  'zoom',
  'slide-left',
  'fade-slide',
  'zoom',
  'slide-up',
  'fade-slide',
  'slide-left',
  'fade',        // outro
];

// Pre-calculate scene frame ranges
const sceneFrames = SCENES.map((scene) => {
  return Math.ceil(scene.durationInSeconds * FPS);
});

const sceneStarts: number[] = [];
let acc = 0;
for (const dur of sceneFrames) {
  sceneStarts.push(acc);
  acc += dur;
}

const totalFrames = acc;

function SceneIndex() {
  const frame = useCurrentFrame();
  let idx = 0;
  for (let i = sceneStarts.length - 1; i >= 0; i--) {
    if (frame >= sceneStarts[i]) {
      idx = i;
      break;
    }
  }
  return <ProgressBar currentScene={idx} totalScenes={SCENES.length} />;
}

export const GeneXplorDemo: React.FC = () => {
  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#0B1D2E' }}>
      {SCENES.map((scene, i) => {
        const startFrame = currentFrame;
        const durationInFrames = sceneFrames[i];
        currentFrame += durationInFrames;

        const isIntro = scene.id === 'intro';
        const isOutro = scene.id === 'outro';
        const isFeature = !isIntro && !isOutro;
        // Feature scenes are numbered 1..N (excluding intro/outro)
        const featureIndex = isFeature
          ? SCENES.slice(0, i).filter((s) => s.id !== 'intro' && s.id !== 'outro').length + 1
          : 0;
        const totalFeatures = SCENES.filter((s) => s.id !== 'intro' && s.id !== 'outro').length;

        let content: React.ReactNode;
        if (isIntro) {
          content = <IntroScene />;
        } else if (isOutro) {
          content = <OutroScene />;
        } else {
          content = <FeatureScene scene={scene} />;
        }

        const variant = TRANSITION_VARIANTS[i % TRANSITION_VARIANTS.length];

        return (
          <Sequence
            key={scene.id}
            from={startFrame}
            durationInFrames={durationInFrames}
            name={scene.title || scene.id}
          >
            <SceneTransition variant={variant}>{content}</SceneTransition>

            {/* Light sweep effect on feature scenes */}
            {isFeature && <LightSweep delay={15} />}

            {/* Scene indicator for feature scenes */}
            {isFeature && (
              <SceneIndicator
                sceneNumber={featureIndex}
                totalScenes={totalFeatures}
                label={scene.title}
              />
            )}

            {/* Narration audio — starts 0.5s into each scene */}
            {scene.audioFile && (
              <Sequence from={15}>
                <Audio
                  src={staticFile(`audio/${scene.audioFile}.mp3`)}
                  volume={1}
                />
              </Sequence>
            )}
          </Sequence>
        );
      })}

      {/* Background music — plays throughout the entire video */}
      <Audio
        src={staticFile('audio/background-music.mp3')}
        volume={(f) =>
          interpolate(
            f,
            [0, FPS * 2, totalFrames - FPS * 3, totalFrames],
            [0, 0.08, 0.08, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          )
        }
        loop
      />

      {/* Global progress bar */}
      <SceneIndex />
    </AbsoluteFill>
  );
};
