import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from '../theme';

interface TagStripProps {
  tags: string[];
  delayFrames?: number;
}

export const TagStrip: React.FC<TagStripProps> = ({ tags, delayFrames = 20 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
      }}
    >
      {tags.map((tag, i) => {
        const progress = spring({
          frame: frame - delayFrames - i * 3,
          fps,
          config: { damping: 50, stiffness: 220, mass: 0.3 },
        });
        const opacity = interpolate(progress, [0, 1], [0, 1]);
        const scale = interpolate(progress, [0, 1], [0.7, 1]);
        const y = interpolate(progress, [0, 1], [8, 0]);

        return (
          <div
            key={tag}
            style={{
              padding: '4px 12px',
              borderRadius: 6,
              background: `${theme.colors.primary}66`,
              border: `1px solid ${theme.colors.primaryHover}44`,
              fontSize: 11,
              fontWeight: 600,
              fontFamily: theme.fonts.mono,
              color: theme.colors.primaryHover,
              opacity,
              transform: `scale(${scale}) translateY(${y}px)`,
              whiteSpace: 'nowrap',
            }}
          >
            {tag}
          </div>
        );
      })}
    </div>
  );
};
