import React from 'react';
import {
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
} from 'remotion';
import type { SceneConfig } from '../scenes/config';
import { theme } from '../theme';

interface ScreenshotProps {
  src: string;
  zoomTarget?: SceneConfig['zoomTarget'];
  panDirection?: SceneConfig['panDirection'];
}

export const Screenshot: React.FC<ScreenshotProps> = ({ src, zoomTarget, panDirection = 'none' }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Fade in
  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Entrance: scale down from slightly larger with spring
  const entranceScale = spring({
    frame,
    fps,
    config: { damping: 80, stiffness: 180, mass: 0.5 },
  });
  const baseScale = interpolate(entranceScale, [0, 1], [1.06, 1]);

  // Ken Burns zoom if target specified
  let scale = baseScale;
  let translateX = 0;
  let translateY = 0;

  if (zoomTarget) {
    const zoomProgress = interpolate(
      frame,
      [20, durationInFrames - 20],
      [0, 1],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );
    scale = interpolate(zoomProgress, [0, 1], [1, zoomTarget.scale]);
    translateX = interpolate(zoomProgress, [0, 1], [0, -(zoomTarget.x - 50) * (zoomTarget.scale - 1) * 0.3]);
    translateY = interpolate(zoomProgress, [0, 1], [0, -(zoomTarget.y - 50) * (zoomTarget.scale - 1) * 0.3]);
  } else if (panDirection === 'down') {
    const panProgress = interpolate(
      frame,
      [30, durationInFrames - 15],
      [0, 1],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );
    scale = 1.12;
    translateY = interpolate(panProgress, [0, 1], [3, -5]);
  } else if (panDirection === 'up') {
    const panProgress = interpolate(
      frame,
      [30, durationInFrames - 15],
      [0, 1],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );
    scale = 1.12;
    translateY = interpolate(panProgress, [0, 1], [-5, 3]);
  } else {
    // Subtle float for static scenes
    const floatY = interpolate(
      frame,
      [0, durationInFrames / 2, durationInFrames],
      [0, -2, 0]
    );
    translateY = floatY;
  }

  // Animated border glow
  const glowPulse = interpolate(
    Math.sin(frame * 0.04),
    [-1, 1],
    [0.15, 0.35]
  );

  // Entrance slide
  const slideY = interpolate(entranceScale, [0, 1], [30, 0]);

  return (
    <div
      style={{
        position: 'absolute',
        top: '5%',
        left: '4%',
        width: '92%',
        height: '78%',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: `
          0 25px 80px rgba(0,0,0,0.5),
          0 8px 24px rgba(0,0,0,0.3),
          0 0 40px ${theme.colors.primaryHover}${Math.round(glowPulse * 255).toString(16).padStart(2, '0')},
          inset 0 0 0 1px ${theme.colors.primaryHover}22
        `,
        opacity,
        transform: `translateY(${slideY}px)`,
      }}
    >
      {/* Browser chrome */}
      <div
        style={{
          height: 36,
          background: 'linear-gradient(180deg, #2a2a2a 0%, #1e1e1e 100%)',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 14,
          gap: 7,
        }}
      >
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }} />
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ffbd2e' }} />
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }} />
        <div
          style={{
            marginLeft: 20,
            flex: 1,
            maxWidth: 480,
            height: 24,
            borderRadius: 7,
            background: '#363636',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 12,
            gap: 6,
          }}
        >
          {/* Lock icon */}
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="2" y="4.5" width="6" height="4.5" rx="1" stroke="#888" strokeWidth="1" />
            <path d="M3.5 4.5V3a1.5 1.5 0 0 1 3 0v1.5" stroke="#888" strokeWidth="1" fill="none" />
          </svg>
          <span
            style={{
              fontSize: 11,
              color: '#aaa',
              fontFamily: 'system-ui',
              letterSpacing: '0.01em',
            }}
          >
            genexplor.app
          </span>
        </div>
      </div>

      {/* Screenshot image */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 'calc(100% - 36px)',
          overflow: 'hidden',
          background: '#F0F4F8',
        }}
      >
        <Img
          src={staticFile(`screenshots/${src}`)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'top center',
            transform: `scale(${scale}) translate(${translateX}%, ${translateY}%)`,
            transformOrigin: zoomTarget
              ? `${zoomTarget.x}% ${zoomTarget.y}%`
              : 'center top',
          }}
        />

        {/* Subtle top reflection */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 60,
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.04), transparent)',
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
};
