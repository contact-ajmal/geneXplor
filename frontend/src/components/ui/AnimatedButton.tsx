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
    bg-primary text-white font-semibold
    hover:bg-primary-dark
    disabled:opacity-40 disabled:cursor-not-allowed
  `,
  secondary: `
    bg-white border border-ocean-100 text-primary
    hover:bg-ocean-50 hover:border-ocean-200
  `,
  ghost: `
    bg-transparent text-text-secondary
    hover:text-primary hover:bg-ocean-50
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
      whileHover={{ scale: disabled || loading ? 1 : 1.01 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
      type={type}
      onClick={onClick}
      className={`
        relative rounded-lg px-5 py-2.5 text-sm font-body
        transition-all duration-150 cursor-pointer
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
