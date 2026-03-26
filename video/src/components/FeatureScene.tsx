import React from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import type { SceneConfig } from '../scenes/config';
import { Background } from './Background';
import { Screenshot } from './Screenshot';
import { TitleCard } from './TitleCard';
import { DetailPanel } from './DetailPanel';

interface FeatureSceneProps {
  scene: SceneConfig;
}

export const FeatureScene: React.FC<FeatureSceneProps> = ({ scene }) => {
  const { fps } = useVideoConfig();
  const hasDetails = scene.details && scene.details.length > 0;

  return (
    <AbsoluteFill>
      <Background />

      {/* App screenshot — narrower when detail panel is present */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          ...(hasDetails ? { right: 360 } : {}),
        }}
      >
        <Screenshot
          src={scene.screenshotFile}
          zoomTarget={scene.zoomTarget}
          panDirection={scene.panDirection}
        />
      </div>

      {/* Detail panel on the right */}
      {hasDetails && (
        <DetailPanel
          details={scene.details!}
          delayFrames={Math.round(1.5 * fps)}
        />
      )}

      {/* Title bar at bottom */}
      <TitleCard title={scene.title} subtitle={scene.subtitle} tags={scene.tags} />
    </AbsoluteFill>
  );
};
