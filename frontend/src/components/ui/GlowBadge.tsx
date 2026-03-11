import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

type BadgeColor = 'cyan' | 'magenta' | 'green' | 'amber' | 'muted';

interface GlowBadgeProps {
  children: ReactNode;
  color?: BadgeColor;
  onClick?: () => void;
  className?: string;
  pulse?: boolean;
}

const colorMap: Record<BadgeColor, string> = {
  cyan: 'bg-cyan/10 text-cyan border-cyan/25 shadow-[0_0_10px_rgba(0,212,255,0.12)]',
  magenta: 'bg-magenta/10 text-magenta border-magenta/25 shadow-[0_0_10px_rgba(255,51,102,0.12)]',
  green: 'bg-helix-green/10 text-helix-green border-helix-green/25 shadow-[0_0_10px_rgba(0,255,136,0.12)]',
  amber: 'bg-amber/10 text-amber border-amber/25 shadow-[0_0_10px_rgba(255,170,0,0.12)]',
  muted: 'bg-space-600/50 text-text-secondary border-space-500/40',
};

export default function GlowBadge({ children, color = 'cyan', onClick, className = '', pulse = false }: GlowBadgeProps) {
  const Comp = onClick ? motion.button : motion.span;
  return (
    <Comp
      whileHover={onClick ? { scale: 1.05 } : undefined}
      whileTap={onClick ? { scale: 0.97 } : undefined}
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium
        border transition-all duration-200
        ${onClick ? 'cursor-pointer hover:brightness-125' : ''}
        ${pulse ? 'animate-glow-pulse' : ''}
        ${colorMap[color]}
        ${className}
      `}
    >
      {children}
    </Comp>
  );
}
