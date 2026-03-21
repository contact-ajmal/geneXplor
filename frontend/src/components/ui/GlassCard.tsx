import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  delay?: number;
}

export default function GlassCard({ children, className = '', hover = true, delay = 0 }: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={`
        rounded-xl border border-ocean-100 p-5
        bg-white
        shadow-[0_1px_3px_rgba(16,42,67,0.04),0_1px_2px_rgba(16,42,67,0.06)]
        ${hover ? 'hover:shadow-[0_4px_12px_rgba(16,42,67,0.08)] hover:border-ocean-200 transition-all duration-200' : ''}
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
}
