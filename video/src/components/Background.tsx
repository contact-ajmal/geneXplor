import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { theme } from '../theme';
import { FloatingParticles } from './FloatingParticles';

export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const gridOpacity = interpolate(frame % 300, [0, 150, 300], [0.03, 0.06, 0.03]);

  // Slow rotating gradient spotlight
  const spotAngle = interpolate(frame, [0, 900], [0, 360]);
  const spotX = 50 + Math.sin(spotAngle * (Math.PI / 180)) * 20;
  const spotY = 50 + Math.cos(spotAngle * (Math.PI / 180)) * 15;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${theme.colors.ocean900} 0%, ${theme.colors.ocean800} 40%, ${theme.colors.primary} 100%)`,
      }}
    >
      {/* Moving radial spotlight */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 600px 400px at ${spotX}% ${spotY}%, ${theme.colors.primaryHover}12, transparent 70%)`,
        }}
      />

      {/* Subtle animated grid pattern */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: gridOpacity,
          backgroundImage: `
            linear-gradient(${theme.colors.primaryHover}22 1px, transparent 1px),
            linear-gradient(90deg, ${theme.colors.primaryHover}22 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Floating particles */}
      <FloatingParticles />

      {/* Vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.3) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};
