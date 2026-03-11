import { useMemo } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  dx: number;
  dy: number;
  duration: number;
  delay: number;
  color: string;
}

export default function ParticleField() {
  const particles = useMemo<Particle[]>(() => {
    const colors = ['#00d4ff', '#ff3366', '#00ff88', '#ffaa00'];
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      dx: (Math.random() - 0.5) * 200,
      dy: -(Math.random() * 300 + 100),
      duration: Math.random() * 15 + 15,
      delay: Math.random() * 20,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[1] overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            opacity: 0,
            '--dx': `${p.dx}px`,
            '--dy': `${p.dy}px`,
            animation: `particle-drift ${p.duration}s linear ${p.delay}s infinite`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
