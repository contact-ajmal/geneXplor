import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface AnimatedButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}

const styleVariants = {
  primary: `
    bg-gradient-to-r from-cyan to-cyan-dim text-space-900 font-semibold
    hover:shadow-[0_0_24px_rgba(0,212,255,0.35)]
    disabled:opacity-40 disabled:cursor-not-allowed
  `,
  secondary: `
    bg-space-700/80 border border-space-500 text-text-primary
    hover:border-cyan/30 hover:shadow-[0_0_16px_rgba(0,212,255,0.1)]
  `,
  ghost: `
    bg-transparent text-text-secondary hover:text-cyan
    hover:bg-cyan/[0.05]
  `,
};

export default function AnimatedButton({
  children,
  variant = 'primary',
  loading = false,
  className = '',
  disabled,
  onClick,
  type = 'button',
}: AnimatedButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
      type={type}
      onClick={onClick}
      className={`
        relative rounded-lg px-5 py-2.5 text-sm font-body
        transition-all duration-200 cursor-pointer
        ${styleVariants[variant]}
        ${loading ? 'overflow-hidden' : ''}
        ${className}
      `}
      disabled={disabled || loading}
    >
      {loading && (
        <div className="absolute inset-0 skeleton-shimmer rounded-lg" />
      )}
      <span className={loading ? 'opacity-70' : ''}>{children}</span>
    </motion.button>
  );
}
