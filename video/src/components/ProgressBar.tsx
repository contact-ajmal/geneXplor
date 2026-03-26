import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from '../theme';
import { SCENES } from '../scenes/config';

interface ProgressBarProps {
  currentScene: number;
  totalScenes: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ currentScene, totalScenes }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const sceneProgress = (currentScene / totalScenes) * 100;
  const frameProgress = interpolate(frame, [0, durationInFrames], [0, 100 / totalScenes], {
    extrapolateRight: 'clamp',
  });
  const totalProgress = sceneProgress + frameProgress;

  // Pulse on the active dot
  const pulseScale = interpolate(
    Math.sin((frame * 0.15)),
    [-1, 1],
    [0.8, 1.2]
  );

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 36,
        background: 'linear-gradient(to top, rgba(11,29,46,0.9) 0%, transparent 100%)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-end',
        padding: '0 36px 8px',
      }}
    >
      {/* Track */}
      <div
        style={{
          flex: 1,
          height: 3,
          background: `${theme.colors.ocean800}88`,
          borderRadius: 2,
          position: 'relative',
        }}
      >
        {/* Fill */}
        <div
          style={{
            height: '100%',
            width: `${totalProgress}%`,
            background: `linear-gradient(90deg, ${theme.colors.primaryHover}, ${theme.colors.success})`,
            borderRadius: 2,
            transition: 'width 0.1s linear',
            boxShadow: `0 0 8px ${theme.colors.primaryHover}44`,
          }}
        />

        {/* Scene dots */}
        {SCENES.map((_, i) => {
          if (i === 0) return null;
          const dotPos = (i / totalScenes) * 100;
          const isActive = i === currentScene;
          const isPast = i < currentScene;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${dotPos}%`,
                top: '50%',
                width: isActive ? 6 : 3,
                height: isActive ? 6 : 3,
                borderRadius: '50%',
                background: isPast || isActive
                  ? theme.colors.primaryHover
                  : `${theme.colors.ocean200}44`,
                transform: `translate(-50%, -50%) scale(${isActive ? pulseScale : 1})`,
                transition: 'all 0.2s ease',
              }}
            />
          );
        })}
      </div>

      {/* Time indicator */}
      <div
        style={{
          marginLeft: 16,
          fontSize: 11,
          fontWeight: 600,
          fontFamily: theme.fonts.mono,
          color: `${theme.colors.ocean200}88`,
          minWidth: 45,
          textAlign: 'right',
        }}
      >
        {currentScene + 1}/{totalScenes}
      </div>
    </div>
  );
};
