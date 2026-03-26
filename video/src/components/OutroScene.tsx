import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from '../theme';
import { Background } from './Background';

export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title entrance
  const titleProgress = spring({
    frame: frame - 10,
    fps,
    config: { damping: 60, stiffness: 180, mass: 0.6 },
  });

  // Tagline
  const tagProgress = spring({
    frame: frame - 25,
    fps,
    config: { damping: 80, stiffness: 200, mass: 0.6 },
  });

  // Stats
  const statsProgress = spring({
    frame: frame - 40,
    fps,
    config: { damping: 80, stiffness: 200, mass: 0.6 },
  });

  // Divider
  const divProgress = spring({
    frame: frame - 35,
    fps,
    config: { damping: 60, stiffness: 180, mass: 0.4 },
  });

  const stats = [
    { value: '8', label: 'Data Sources', color: theme.colors.primaryHover },
    { value: '12', label: 'Analysis Tabs', color: theme.colors.success },
    { value: '5', label: 'Visualizations', color: '#7EC8E3' },
    { value: '6', label: 'Export Formats', color: theme.colors.warning },
  ];

  // Decorative rings (like intro but calmer)
  const ringRotation = interpolate(frame, [0, 600], [0, 180]);

  return (
    <AbsoluteFill>
      <Background />

      {/* Decorative rings */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 500,
          height: 500,
          marginLeft: -250,
          marginTop: -250,
          borderRadius: '50%',
          border: `1.5px solid ${theme.colors.primaryHover}`,
          opacity: 0.08,
          transform: `rotate(${ringRotation}deg)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 650,
          height: 650,
          marginLeft: -325,
          marginTop: -325,
          borderRadius: '50%',
          border: `1px solid ${theme.colors.primaryHover}`,
          opacity: 0.04,
          transform: `rotate(${-ringRotation * 0.5}deg)`,
        }}
      />

      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 32,
          zIndex: 10,
        }}
      >
        {/* DNA + Title */}
        <div
          style={{
            textAlign: 'center',
            opacity: interpolate(titleProgress, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(titleProgress, [0, 1], [40, 0])}px) scale(${interpolate(titleProgress, [0, 1], [0.9, 1])})`,
          }}
        >
          <div
            style={{
              fontSize: 60,
              marginBottom: 16,
              filter: `drop-shadow(0 4px 20px ${theme.colors.primaryHover}44)`,
            }}
          >
            🧬
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <span
              style={{
                fontSize: 64,
                fontWeight: 700,
                fontFamily: theme.fonts.heading,
                color: theme.colors.white,
                textShadow: '0 4px 20px rgba(0,0,0,0.3)',
              }}
            >
              Gene
            </span>
            <span
              style={{
                fontSize: 64,
                fontWeight: 700,
                fontFamily: theme.fonts.heading,
                color: theme.colors.primaryHover,
                textShadow: `0 4px 20px ${theme.colors.primaryHover}33`,
              }}
            >
              Xplor
            </span>
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 500,
              fontFamily: theme.fonts.body,
              color: theme.colors.ocean200,
              marginTop: 14,
              opacity: interpolate(tagProgress, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(tagProgress, [0, 1], [15, 0])}px)`,
            }}
          >
            Your complete genomics research platform
          </div>
        </div>

        {/* Animated divider */}
        <div
          style={{
            width: interpolate(divProgress, [0, 1], [0, 200]),
            height: 1,
            background: `linear-gradient(90deg, transparent, ${theme.colors.primaryHover}66, transparent)`,
          }}
        />

        {/* Stats row */}
        <div
          style={{
            display: 'flex',
            gap: 56,
            opacity: interpolate(statsProgress, [0, 1], [0, 1]),
          }}
        >
          {stats.map((stat, i) => {
            const p = spring({
              frame: frame - 45 - i * 6,
              fps,
              config: { damping: 50, stiffness: 200, mass: 0.4 },
            });

            // Count-up animation for the number
            const countFrame = Math.max(0, frame - 45 - i * 6);
            const countProgress = Math.min(1, countFrame / 20);
            const displayValue = Math.round(parseInt(stat.value) * countProgress);

            return (
              <div
                key={stat.label}
                style={{
                  textAlign: 'center',
                  opacity: interpolate(p, [0, 1], [0, 1]),
                  transform: `translateY(${interpolate(p, [0, 1], [25, 0])}px) scale(${interpolate(p, [0, 1], [0.8, 1])})`,
                }}
              >
                <div
                  style={{
                    fontSize: 48,
                    fontWeight: 700,
                    fontFamily: theme.fonts.heading,
                    color: stat.color,
                    textShadow: `0 2px 16px ${stat.color}33`,
                  }}
                >
                  {displayValue}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: theme.fonts.body,
                    color: theme.colors.ocean200,
                    marginTop: 6,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {stat.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA button */}
        <div
          style={{
            opacity: interpolate(
              spring({ frame: frame - 80, fps, config: { damping: 80, stiffness: 200, mass: 0.6 } }),
              [0, 1],
              [0, 1]
            ),
            transform: `scale(${interpolate(
              spring({ frame: frame - 80, fps, config: { damping: 60, stiffness: 200, mass: 0.5 } }),
              [0, 1],
              [0.9, 1]
            )})`,
            padding: '16px 44px',
            borderRadius: 14,
            background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryHover})`,
            fontSize: 20,
            fontWeight: 700,
            fontFamily: theme.fonts.body,
            color: theme.colors.white,
            boxShadow: `0 8px 32px ${theme.colors.primary}66, 0 0 0 1px ${theme.colors.primaryHover}44`,
            letterSpacing: '0.01em',
          }}
        >
          Thanks for watching
        </div>

        {/* URL */}
        <div
          style={{
            opacity: interpolate(
              spring({ frame: frame - 100, fps, config: { damping: 80, stiffness: 200, mass: 0.6 } }),
              [0, 1],
              [0, 0.5]
            ),
            fontSize: 14,
            fontFamily: theme.fonts.mono,
            color: theme.colors.ocean200,
            letterSpacing: '0.05em',
          }}
        >
          genexplor.app
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
