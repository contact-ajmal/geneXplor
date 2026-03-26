import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from '../theme';

interface CalloutProps {
  text: string;
  x: number;
  y: number;
  delayFrames: number;
}

export const Callout: React.FC<CalloutProps> = ({ text, x, y, delayFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delayFrames,
    fps,
    config: { damping: 60, stiffness: 200, mass: 0.5 },
  });

  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const scale = interpolate(progress, [0, 1], [0.8, 1]);

  if (progress <= 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) scale(${scale})`,
        opacity,
        zIndex: 10,
      }}
    >
      {/* Callout pill */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 16px',
          borderRadius: 10,
          background: 'rgba(27, 73, 101, 0.92)',
          backdropFilter: 'blur(12px)',
          border: `1px solid ${theme.colors.primaryHover}66`,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        }}
      >
        {/* Arrow dot */}
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: theme.colors.primaryHover,
            boxShadow: `0 0 8px ${theme.colors.primaryHover}88`,
          }}
        />
        <span
          style={{
            fontSize: 15,
            fontWeight: 600,
            fontFamily: theme.fonts.body,
            color: theme.colors.white,
            whiteSpace: 'nowrap',
          }}
        >
          {text}
        </span>
      </div>
    </div>
  );
};
