import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from '../theme';
import { TagStrip } from './TagStrip';

interface TitleCardProps {
  title: string;
  subtitle: string;
  tags?: string[];
}

export const TitleCard: React.FC<TitleCardProps> = ({ title, subtitle, tags }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!title && !subtitle) return null;

  // Background panel slide up
  const bgProgress = spring({
    frame: frame - 3,
    fps,
    config: { damping: 80, stiffness: 180, mass: 0.6 },
  });
  const bgY = interpolate(bgProgress, [0, 1], [120, 0]);
  const bgOpacity = interpolate(bgProgress, [0, 1], [0, 1]);

  // Title animation — character stagger
  const titleProgress = spring({
    frame: frame - 8,
    fps,
    config: { damping: 80, stiffness: 200, mass: 0.6 },
  });
  const titleY = interpolate(titleProgress, [0, 1], [25, 0]);
  const titleOpacity = interpolate(titleProgress, [0, 1], [0, 1]);

  // Subtitle animation
  const subtitleProgress = spring({
    frame: frame - 16,
    fps,
    config: { damping: 80, stiffness: 200, mass: 0.6 },
  });
  const subtitleY = interpolate(subtitleProgress, [0, 1], [15, 0]);
  const subtitleOpacity = interpolate(subtitleProgress, [0, 1], [0, 1]);

  // Accent line with gradient sweep
  const lineWidth = spring({
    frame: frame - 5,
    fps,
    config: { damping: 60, stiffness: 200, mass: 0.4 },
  });

  // Subtle glow behind the accent line
  const glowOpacity = interpolate(
    Math.sin(frame * 0.05),
    [-1, 1],
    [0.3, 0.6]
  );

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        transform: `translateY(${bgY}px)`,
        opacity: bgOpacity,
      }}
    >
      {/* Gradient backdrop */}
      <div
        style={{
          background: 'linear-gradient(to top, rgba(11,29,46,0.97) 0%, rgba(11,29,46,0.88) 50%, rgba(11,29,46,0.4) 80%, transparent 100%)',
          padding: '56px 52px 36px',
        }}
      >
        {/* Accent line with glow */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <div
            style={{
              position: 'absolute',
              width: interpolate(lineWidth, [0, 1], [0, 72]),
              height: 8,
              background: `linear-gradient(90deg, ${theme.colors.primaryHover}, ${theme.colors.success})`,
              borderRadius: 4,
              filter: 'blur(6px)',
              opacity: glowOpacity,
              top: -2,
            }}
          />
          <div
            style={{
              width: interpolate(lineWidth, [0, 1], [0, 72]),
              height: 3,
              background: `linear-gradient(90deg, ${theme.colors.primaryHover}, ${theme.colors.success})`,
              borderRadius: 2,
            }}
          />
        </div>

        {/* Title with subtle letter spacing animation */}
        <div
          style={{
            fontSize: 40,
            fontWeight: 700,
            fontFamily: theme.fonts.heading,
            color: theme.colors.white,
            transform: `translateY(${titleY}px)`,
            opacity: titleOpacity,
            letterSpacing: '-0.02em',
            marginBottom: 8,
            textShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          {title}
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 20,
            fontWeight: 500,
            fontFamily: theme.fonts.body,
            color: theme.colors.ocean200,
            transform: `translateY(${subtitleY}px)`,
            opacity: subtitleOpacity,
            maxWidth: '60%',
            lineHeight: 1.5,
            marginBottom: tags && tags.length > 0 ? 16 : 0,
          }}
        >
          {subtitle}
        </div>

        {/* Tags */}
        {tags && tags.length > 0 && <TagStrip tags={tags} delayFrames={22} />}
      </div>
    </div>
  );
};
