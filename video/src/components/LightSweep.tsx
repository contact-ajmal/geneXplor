import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

/**
 * A subtle diagonal light sweep that moves across the scene once.
 * Creates a polished, premium feel.
 */
export const LightSweep: React.FC<{ delay?: number }> = ({ delay = 20 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const sweepDuration = Math.min(90, durationInFrames - delay);
  const progress = interpolate(
    frame - delay,
    [0, sweepDuration],
    [-100, 200],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const opacity = interpolate(
    frame - delay,
    [0, sweepDuration * 0.3, sweepDuration * 0.7, sweepDuration],
    [0, 0.06, 0.06, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden', zIndex: 2 }}>
      <div
        style={{
          position: 'absolute',
          top: '-50%',
          left: `${progress}%`,
          width: '15%',
          height: '200%',
          background:
            'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)',
          transform: 'skewX(-15deg)',
          opacity,
        }}
      />
    </AbsoluteFill>
  );
};
