import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from '../theme';

interface DetailPanelProps {
  details: string[];
  delayFrames?: number;
}

export const DetailPanel: React.FC<DetailPanelProps> = ({ details, delayFrames = 30 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Panel slide-in
  const panelProgress = spring({
    frame: frame - delayFrames,
    fps,
    config: { damping: 80, stiffness: 150, mass: 0.7 },
  });
  const panelX = interpolate(panelProgress, [0, 1], [100, 0]);
  const panelOpacity = interpolate(panelProgress, [0, 1], [0, 1]);

  if (panelProgress <= 0) return null;

  // Subtle glow pulse
  const glowPulse = interpolate(
    Math.sin(frame * 0.04),
    [-1, 1],
    [0.2, 0.4]
  );

  return (
    <div
      style={{
        position: 'absolute',
        right: 32,
        top: '12%',
        width: 320,
        maxHeight: '68%',
        overflow: 'hidden',
        borderRadius: 16,
        background: 'rgba(11, 29, 46, 0.9)',
        backdropFilter: 'blur(20px)',
        border: `1px solid ${theme.colors.primaryHover}33`,
        boxShadow: `0 16px 48px rgba(0,0,0,0.4), 0 0 30px ${theme.colors.primaryHover}${Math.round(glowPulse * 30).toString(16).padStart(2, '0')}`,
        padding: '22px 20px',
        transform: `translateX(${panelX}px)`,
        opacity: panelOpacity,
        zIndex: 20,
      }}
    >
      {/* Header gradient line */}
      <div
        style={{
          width: 40,
          height: 2,
          background: `linear-gradient(90deg, ${theme.colors.primaryHover}, ${theme.colors.success})`,
          borderRadius: 1,
          marginBottom: 14,
        }}
      />
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          fontFamily: theme.fonts.body,
          color: theme.colors.ocean200,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: 16,
        }}
      >
        What You Get
      </div>

      {/* Bullet items with staggered entrance */}
      {details.map((detail, i) => {
        const itemProgress = spring({
          frame: frame - delayFrames - 12 - i * 7,
          fps,
          config: { damping: 60, stiffness: 200, mass: 0.4 },
        });
        const itemOpacity = interpolate(itemProgress, [0, 1], [0, 1]);
        const itemX = interpolate(itemProgress, [0, 1], [25, 0]);

        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              marginBottom: 12,
              opacity: itemOpacity,
              transform: `translateX(${itemX}px)`,
            }}
          >
            {/* Animated dot with gradient */}
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${theme.colors.primaryHover}, ${theme.colors.success})`,
                marginTop: 6,
                flexShrink: 0,
                boxShadow: `0 0 6px ${theme.colors.primaryHover}44`,
              }}
            />
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                fontFamily: theme.fonts.body,
                color: theme.colors.ocean100,
                lineHeight: 1.55,
              }}
            >
              {detail}
            </span>
          </div>
        );
      })}
    </div>
  );
};
