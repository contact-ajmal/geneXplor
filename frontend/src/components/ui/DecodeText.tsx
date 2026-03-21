import { motion } from 'framer-motion';

interface DecodeTextProps {
  text: string;
  className?: string;
  delay?: number;
  speed?: number;
}

export default function DecodeText({ text, className = '', delay = 0 }: DecodeTextProps) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: delay / 1000 }}
      className={className}
    >
      {text}
    </motion.span>
  );
}
