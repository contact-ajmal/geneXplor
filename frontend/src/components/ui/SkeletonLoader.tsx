interface SkeletonLoaderProps {
  className?: string;
  lines?: number;
  variant?: 'text' | 'card' | 'circle';
}

export default function SkeletonLoader({ className = '', lines = 3, variant = 'text' }: SkeletonLoaderProps) {
  if (variant === 'circle') {
    return (
      <div className={`rounded-full skeleton-shimmer ${className}`} />
    );
  }

  if (variant === 'card') {
    return (
      <div
        className={`
          rounded-2xl border border-cyan/[0.05] p-5
          bg-[rgba(20,27,45,0.5)] backdrop-blur-xl
          ${className}
        `}
      >
        <div className="h-5 w-1/3 rounded skeleton-shimmer mb-4" />
        <div className="space-y-3">
          {Array.from({ length: lines }).map((_, i) => (
            <div
              key={i}
              className="h-3.5 rounded skeleton-shimmer"
              style={{ width: `${85 - i * 15}%` }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3.5 rounded skeleton-shimmer"
          style={{ width: `${90 - i * 12}%` }}
        />
      ))}
    </div>
  );
}
