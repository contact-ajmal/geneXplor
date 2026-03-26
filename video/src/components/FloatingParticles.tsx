import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { theme } from '../theme';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  delay: number;
  color: string;
}

// Deterministic pseudo-random from seed
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

// Generate particles once
const PARTICLE_COUNT = 35;
const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
  const r = seededRandom;
  const colors = [
    theme.colors.primaryHover,
    theme.colors.success,
    theme.colors.ocean200,
    '#7EC8E3',
  ];
  return {
    id: i,
    x: r(i * 7 + 1) * 100,
    y: r(i * 13 + 2) * 100,
    size: 2 + r(i * 3 + 3) * 4,
    speed: 0.3 + r(i * 5 + 4) * 0.7,
    opacity: 0.1 + r(i * 11 + 5) * 0.25,
    delay: r(i * 17 + 6) * 200,
    color: colors[Math.floor(r(i * 19 + 7) * colors.length)],
  };
});

export const FloatingParticles: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 1 }}>
      {particles.map((p) => {
        const t = (frame + p.delay) * p.speed * 0.015;
        // Gentle floating motion
        const floatX = Math.sin(t * 0.7 + p.id) * 30;
        const floatY = Math.cos(t * 0.5 + p.id * 0.3) * 25;
        // Pulse opacity
        const pulse = interpolate(
          Math.sin(t * 1.2 + p.id * 0.5),
          [-1, 1],
          [p.opacity * 0.5, p.opacity]
        );

        return (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              background: p.color,
              opacity: pulse,
              transform: `translate(${floatX}px, ${floatY}px)`,
              boxShadow: p.size > 4 ? `0 0 ${p.size * 3}px ${p.color}44` : 'none',
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
