import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface SceneTransitionProps {
  children: React.ReactNode;
  /** Transition style variant */
  variant?: 'fade' | 'slide-left' | 'slide-up' | 'zoom' | 'fade-slide';
}

/**
 * Enhanced scene transitions with multiple styles.
 */
export const SceneTransition: React.FC<SceneTransitionProps> = ({
  children,
  variant = 'fade-slide',
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const fadeInFrames = 12;
  const fadeOutFrames = 10;

  // Fade envelope
  const opacity = interpolate(
    frame,
    [0, fadeInFrames, durationInFrames - fadeOutFrames, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Spring entrance
  const enterSpring = spring({
    frame,
    fps,
    config: { damping: 80, stiffness: 180, mass: 0.6 },
  });

  let transform = '';
  let scale = 1;

  switch (variant) {
    case 'slide-left':
      transform = `translateX(${interpolate(enterSpring, [0, 1], [60, 0])}px)`;
      break;
    case 'slide-up':
      transform = `translateY(${interpolate(enterSpring, [0, 1], [40, 0])}px)`;
      break;
    case 'zoom':
      scale = interpolate(enterSpring, [0, 1], [0.95, 1]);
      transform = `scale(${scale})`;
      break;
    case 'fade-slide':
      transform = `translateY(${interpolate(enterSpring, [0, 1], [20, 0])}px)`;
      break;
    case 'fade':
    default:
      break;
  }

  return (
    <AbsoluteFill style={{ opacity, transform }}>
      {children}
    </AbsoluteFill>
  );
};
