import { useEffect, useState, useRef } from 'react';

const DNA_CHARS = 'ATGCATGC';

interface DecodeTextProps {
  text: string;
  className?: string;
  delay?: number;
  speed?: number;
}

export default function DecodeText({ text, className = '', delay = 0, speed = 40 }: DecodeTextProps) {
  const [displayText, setDisplayText] = useState('');
  const [resolved, setResolved] = useState(false);
  const frameRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const chars = text.split('');
    const resolvedArr = new Array(chars.length).fill(false);
    let iteration = 0;

    const timeout = setTimeout(() => {
      const interval = setInterval(() => {
        if (cancelled) return;

        const next = chars.map((char, i) => {
          if (char === ' ') return ' ';
          if (resolvedArr[i]) return char;
          if (iteration > i * 2 + 4) {
            resolvedArr[i] = true;
            return char;
          }
          return DNA_CHARS[Math.floor(Math.random() * DNA_CHARS.length)];
        });

        setDisplayText(next.join(''));
        iteration++;

        if (resolvedArr.every(Boolean)) {
          setResolved(true);
          clearInterval(interval);
        }
      }, speed);

      frameRef.current = interval as unknown as number;
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      clearInterval(frameRef.current);
    };
  }, [text, delay, speed]);

  return (
    <span className={`${className} ${resolved ? '' : 'text-cyan'}`}>
      {displayText || text}
    </span>
  );
}
