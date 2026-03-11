interface DNAHelixProps {
  opacity?: number;
}

export default function DNAHelix({ opacity = 0.08 }: DNAHelixProps) {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      style={{ opacity }}
    >
      {/* Left helix strand */}
      <div className="absolute -left-20 top-0 w-[500px] h-full">
        <svg
          viewBox="0 0 200 800"
          className="w-full h-full"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="helix-cyan" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00d4ff" stopOpacity="0" />
              <stop offset="30%" stopColor="#00d4ff" stopOpacity="0.5" />
              <stop offset="70%" stopColor="#00d4ff" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#00d4ff" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="helix-magenta" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff3366" stopOpacity="0" />
              <stop offset="30%" stopColor="#ff3366" stopOpacity="0.3" />
              <stop offset="70%" stopColor="#ff3366" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#ff3366" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Double helix paths */}
          <path
            d="M100,0 Q170,100 100,200 Q30,300 100,400 Q170,500 100,600 Q30,700 100,800"
            fill="none"
            stroke="url(#helix-cyan)"
            strokeWidth="1.5"
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,0;0,-200;0,0"
              dur="12s"
              repeatCount="indefinite"
            />
          </path>
          <path
            d="M100,0 Q30,100 100,200 Q170,300 100,400 Q30,500 100,600 Q170,700 100,800"
            fill="none"
            stroke="url(#helix-magenta)"
            strokeWidth="1.5"
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,0;0,-200;0,0"
              dur="12s"
              repeatCount="indefinite"
            />
          </path>
          {/* Base pair rungs */}
          {Array.from({ length: 16 }).map((_, i) => (
            <line
              key={i}
              x1={100 + Math.sin((i / 16) * Math.PI * 4) * 70}
              y1={i * 50}
              x2={100 - Math.sin((i / 16) * Math.PI * 4) * 70}
              y2={i * 50}
              stroke="#00d4ff"
              strokeWidth="0.5"
              strokeOpacity={0.3}
            >
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0,0;0,-200;0,0"
                dur="12s"
                repeatCount="indefinite"
              />
            </line>
          ))}
        </svg>
      </div>

      {/* Right helix strand */}
      <div className="absolute -right-20 top-[20%] w-[400px] h-full rotate-12">
        <svg
          viewBox="0 0 200 800"
          className="w-full h-full"
          preserveAspectRatio="none"
        >
          <path
            d="M100,0 Q160,100 100,200 Q40,300 100,400 Q160,500 100,600 Q40,700 100,800"
            fill="none"
            stroke="url(#helix-cyan)"
            strokeWidth="1"
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,0;0,-150;0,0"
              dur="16s"
              repeatCount="indefinite"
            />
          </path>
          <path
            d="M100,0 Q40,100 100,200 Q160,300 100,400 Q40,500 100,600 Q160,700 100,800"
            fill="none"
            stroke="url(#helix-magenta)"
            strokeWidth="1"
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,0;0,-150;0,0"
              dur="16s"
              repeatCount="indefinite"
            />
          </path>
        </svg>
      </div>
    </div>
  );
}
