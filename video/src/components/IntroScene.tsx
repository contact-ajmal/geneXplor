import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from '../theme';
import { Background } from './Background';

export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Multiple decorative rings with different timings
  const ring1 = spring({ frame: frame - 5, fps, config: { damping: 40, stiffness: 100, mass: 1 } });
  const ring2 = spring({ frame: frame - 12, fps, config: { damping: 50, stiffness: 80, mass: 1.2 } });
  const ring3 = spring({ frame: frame - 18, fps, config: { damping: 60, stiffness: 60, mass: 1.5 } });
  const ringRotation = interpolate(frame, [0, 300], [0, 360]);

  // DNA icon with bounce
  const iconProgress = spring({
    frame: frame - 15,
    fps,
    config: { damping: 50, stiffness: 200, mass: 0.6 },
  });
  const iconScale = interpolate(iconProgress, [0, 1], [0, 1]);
  // Gentle continuous rotation
  const iconRotate = interpolate(frame, [0, 300], [0, 15]);

  // Title reveal — split Gene / Xplor
  const geneProgress = spring({
    frame: frame - 28,
    fps,
    config: { damping: 60, stiffness: 200, mass: 0.5 },
  });
  const xplorProgress = spring({
    frame: frame - 35,
    fps,
    config: { damping: 60, stiffness: 200, mass: 0.5 },
  });

  // Tagline
  const taglineProgress = spring({
    frame: frame - 48,
    fps,
    config: { damping: 80, stiffness: 200, mass: 0.6 },
  });

  // Subtitle
  const subProgress = spring({
    frame: frame - 62,
    fps,
    config: { damping: 80, stiffness: 200, mass: 0.6 },
  });

  // Divider line
  const dividerProgress = spring({
    frame: frame - 55,
    fps,
    config: { damping: 60, stiffness: 180, mass: 0.4 },
  });

  // Data sources
  const dataSources = ['Ensembl', 'ClinVar', 'gnomAD', 'UniProt', 'PubMed', 'AlphaFold', 'STRING', 'Reactome'];

  return (
    <AbsoluteFill>
      <Background />

      {/* Multiple decorative rings */}
      {[
        { size: 400, progress: ring1, opacity: 0.12, speed: 1, border: 2 },
        { size: 550, progress: ring2, opacity: 0.08, speed: -0.6, border: 1.5 },
        { size: 700, progress: ring3, opacity: 0.05, speed: 0.3, border: 1 },
      ].map((ring, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: ring.size,
            height: ring.size,
            marginLeft: -ring.size / 2,
            marginTop: -ring.size / 2,
            borderRadius: '50%',
            border: `${ring.border}px solid ${theme.colors.primaryHover}`,
            opacity: interpolate(ring.progress, [0, 1], [0, ring.opacity]),
            transform: `scale(${interpolate(ring.progress, [0, 1], [0.5, 1])}) rotate(${ringRotation * ring.speed}deg)`,
          }}
        />
      ))}

      {/* Dashed accent ring */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 480,
          height: 480,
          marginLeft: -240,
          marginTop: -240,
          borderRadius: '50%',
          border: `1px dashed ${theme.colors.success}44`,
          opacity: interpolate(ring2, [0, 1], [0, 0.3]),
          transform: `rotate(${-ringRotation * 0.4}deg)`,
        }}
      />

      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          zIndex: 10,
        }}
      >
        {/* DNA icon */}
        <div
          style={{
            fontSize: 80,
            transform: `scale(${iconScale}) rotate(${iconRotate}deg)`,
            marginBottom: 12,
            filter: `drop-shadow(0 4px 20px ${theme.colors.primaryHover}44)`,
          }}
        >
          🧬
        </div>

        {/* Title — Gene slides from left, Xplor from right */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 6,
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              fontSize: 88,
              fontWeight: 700,
              fontFamily: theme.fonts.heading,
              color: theme.colors.white,
              letterSpacing: '-0.03em',
              opacity: interpolate(geneProgress, [0, 1], [0, 1]),
              transform: `translateX(${interpolate(geneProgress, [0, 1], [-40, 0])}px)`,
              textShadow: '0 4px 20px rgba(0,0,0,0.3)',
            }}
          >
            Gene
          </span>
          <span
            style={{
              fontSize: 88,
              fontWeight: 700,
              fontFamily: theme.fonts.heading,
              color: theme.colors.primaryHover,
              letterSpacing: '-0.03em',
              opacity: interpolate(xplorProgress, [0, 1], [0, 1]),
              transform: `translateX(${interpolate(xplorProgress, [0, 1], [40, 0])}px)`,
              textShadow: `0 4px 20px ${theme.colors.primaryHover}33`,
            }}
          >
            Xplor
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            fontFamily: theme.fonts.mono,
            color: theme.colors.primaryHover,
            textTransform: 'uppercase',
            letterSpacing: '0.25em',
            opacity: interpolate(taglineProgress, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(taglineProgress, [0, 1], [15, 0])}px) scaleX(${interpolate(taglineProgress, [0, 1], [0.8, 1])})`,
          }}
        >
          Comprehensive Gene Intelligence Platform
        </div>

        {/* Animated divider */}
        <div
          style={{
            width: interpolate(dividerProgress, [0, 1], [0, 120]),
            height: 2,
            background: `linear-gradient(90deg, transparent, ${theme.colors.primaryHover}88, transparent)`,
            marginTop: 6,
            marginBottom: 6,
          }}
        />

        {/* Subtitle */}
        <div
          style={{
            fontSize: 24,
            fontWeight: 500,
            fontFamily: theme.fonts.body,
            color: theme.colors.ocean200,
            opacity: interpolate(subProgress, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(subProgress, [0, 1], [20, 0])}px)`,
            textAlign: 'center',
            maxWidth: 700,
            lineHeight: 1.5,
          }}
        >
          Search any human gene — get a comprehensive dashboard
          <br />
          aggregating data from 8 major genomics databases
        </div>

        {/* Data sources strip */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            marginTop: 28,
            flexWrap: 'wrap',
            justifyContent: 'center',
            maxWidth: 820,
          }}
        >
          {dataSources.map((source, i) => {
            const chipProgress = spring({
              frame: frame - 80 - i * 4,
              fps,
              config: { damping: 50, stiffness: 220, mass: 0.3 },
            });
            const chipHover = interpolate(
              Math.sin((frame - i * 8) * 0.06),
              [-1, 1],
              [-2, 2]
            );
            return (
              <div
                key={source}
                style={{
                  padding: '8px 18px',
                  borderRadius: 10,
                  background: `linear-gradient(135deg, ${theme.colors.primary}88, ${theme.colors.ocean800}88)`,
                  border: `1px solid ${theme.colors.primaryHover}44`,
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: theme.fonts.mono,
                  color: theme.colors.primaryHover,
                  opacity: interpolate(chipProgress, [0, 1], [0, 1]),
                  transform: `scale(${interpolate(chipProgress, [0, 1], [0.5, 1])}) translateY(${interpolate(chipProgress, [0, 1], [15, chipHover])}px)`,
                  boxShadow: `0 4px 12px ${theme.colors.primary}33`,
                }}
              >
                {source}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
