import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from '../theme';

interface SceneIndicatorProps {
  sceneNumber: number;
  totalScenes: number;
  label: string;
}

export const SceneIndicator: React.FC<SceneIndicatorProps> = ({
  sceneNumber,
  totalScenes,
  label,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterProgress = spring({
    frame: frame - 5,
    fps,
    config: { damping: 80, stiffness: 200, mass: 0.5 },
  });
  const opacity = interpolate(enterProgress, [0, 1], [0, 1]);
  const slideX = interpolate(enterProgress, [0, 1], [-30, 0]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 28,
        left: 36,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        opacity,
        transform: `translateX(${slideX}px)`,
        zIndex: 50,
      }}
    >
      {/* Scene number badge */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryHover})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 700,
          fontFamily: theme.fonts.mono,
          color: theme.colors.white,
          boxShadow: `0 4px 12px ${theme.colors.primary}66`,
        }}
      >
        {sceneNumber}
      </div>

      {/* Divider */}
      <div
        style={{
          width: 1,
          height: 20,
          background: `${theme.colors.ocean200}33`,
        }}
      />

      {/* Label */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          fontFamily: theme.fonts.body,
          color: `${theme.colors.ocean200}aa`,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </div>

      {/* Counter */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 500,
          fontFamily: theme.fonts.mono,
          color: `${theme.colors.ocean200}55`,
        }}
      >
        {sceneNumber}/{totalScenes}
      </div>
    </div>
  );
};
