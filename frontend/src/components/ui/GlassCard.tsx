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
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={`
        rounded-2xl border border-cyan/[0.08] p-5
        glass-bg backdrop-blur-xl
        ${hover ? 'hover:border-cyan/20 hover:shadow-[0_0_30px_rgba(0,212,255,0.06)] transition-all duration-300' : ''}
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
}
