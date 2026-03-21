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
  cyan: 'bg-primary-light text-primary border-ocean-200',
  magenta: 'bg-danger-light text-danger border-danger-light',
  green: 'bg-success-light text-success border-success-light',
  amber: 'bg-warning-light text-warning border-warning-light',
  muted: 'bg-ocean-50 text-text-secondary border-ocean-100',
};

export default function GlowBadge({ children, color = 'cyan', onClick, className = '', pulse = false }: GlowBadgeProps) {
  const Comp = onClick ? motion.button : motion.span;
  return (
    <Comp
      whileHover={onClick ? { scale: 1.03 } : undefined}
      whileTap={onClick ? { scale: 0.97 } : undefined}
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono font-medium
        border transition-all duration-150
        ${onClick ? 'cursor-pointer hover:brightness-95' : ''}
        ${colorMap[color]}
        ${className}
      `}
    >
      {children}
    </Comp>
  );
}
