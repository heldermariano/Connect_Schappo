'use client';

interface LogoProps {
  variant?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  showWave?: boolean;
}

const SIZES = {
  sm: { width: 140, height: 32, fontSize: 14, waveY: 26 },
  md: { width: 180, height: 40, fontSize: 18, waveY: 33 },
  lg: { width: 260, height: 56, fontSize: 26, waveY: 46 },
};

export default function Logo({ variant = 'dark', size = 'md', showWave = true }: LogoProps) {
  const s = SIZES[size];
  const schappoColor = variant === 'light' ? '#FFFFFF' : '#6B6B6B';
  const connectColor = '#F58220';
  const waveColor = variant === 'light' ? 'rgba(255,255,255,0.5)' : 'rgba(245,130,32,0.4)';

  return (
    <svg
      width={s.width}
      height={s.height}
      viewBox={`0 0 ${s.width} ${s.height}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Connect Schappo"
    >
      {/* "Connect" em laranja */}
      <text
        x="0"
        y={s.fontSize + 2}
        fontFamily="var(--font-geist-sans), system-ui, sans-serif"
        fontSize={s.fontSize}
        fontWeight="700"
        fill={connectColor}
      >
        Connect
      </text>

      {/* "Schappo" em cinza ou branco */}
      <text
        x={s.fontSize * 4.6}
        y={s.fontSize + 2}
        fontFamily="var(--font-geist-sans), system-ui, sans-serif"
        fontSize={s.fontSize}
        fontWeight="600"
        fill={schappoColor}
      >
        Schappo
      </text>

      {/* Onda EEG como underline decorativo */}
      {showWave && (
        <path
          d={`M 0 ${s.waveY} Q ${s.width * 0.06} ${s.waveY - 6}, ${s.width * 0.12} ${s.waveY} T ${s.width * 0.24} ${s.waveY} Q ${s.width * 0.30} ${s.waveY + 5}, ${s.width * 0.36} ${s.waveY} T ${s.width * 0.48} ${s.waveY} Q ${s.width * 0.52} ${s.waveY - 8}, ${s.width * 0.56} ${s.waveY} T ${s.width * 0.68} ${s.waveY} Q ${s.width * 0.74} ${s.waveY + 4}, ${s.width * 0.80} ${s.waveY} T ${s.width * 0.92} ${s.waveY} L ${s.width} ${s.waveY}`}
          stroke={waveColor}
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
