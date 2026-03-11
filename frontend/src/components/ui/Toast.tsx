import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

const colorMap = {
  success: 'border-helix-green/30 text-helix-green',
  error: 'border-magenta/30 text-magenta',
  info: 'border-cyan/30 text-cyan',
};

export default function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="fixed top-16 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  const Icon = iconMap[toast.type];

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 80, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.95 }}
      transition={{ duration: 0.25 }}
      className={`
        pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl
        bg-[rgba(20,27,45,0.85)] backdrop-blur-xl border
        shadow-[0_8px_32px_rgba(0,0,0,0.4)]
        ${colorMap[toast.type]}
      `}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="text-text-primary text-sm font-body">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="ml-2 text-text-muted hover:text-text-primary transition-colors cursor-pointer shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}
