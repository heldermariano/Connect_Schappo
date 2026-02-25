'use client';

interface LogoProps {
  variant?: 'dark' | 'light' | 'orange' | 'icon';
  size?: 'sm' | 'md' | 'lg';
}

const ICON_SIZES = {
  sm: 28,
  md: 36,
  lg: 48,
};

const FONT_SIZES = {
  sm: { connect: 17, schappo: 17 },
  md: { connect: 20, schappo: 20 },
  lg: { connect: 26, schappo: 26 },
};

function LogoIcon({ size, variant }: { size: number; variant: 'dark' | 'light' | 'orange' | 'icon' }) {
  const isOrange = variant === 'orange';
  const rectFill = isOrange ? 'white' : '#F58220';
  const strokeColor = isOrange ? '#F58220' : 'white';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="1" y="1" width="42" height="42" rx="10" fill={rectFill} />
      <path
        d="M22 10 C14 10 9 16 9 22 C9 28 14 34 22 34"
        stroke={strokeColor}
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M22 34 L26 28 L29 36 L32 22 L35 30 L37 26"
        stroke={strokeColor}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export default function Logo({ variant = 'dark', size = 'md' }: LogoProps) {
  const iconSize = ICON_SIZES[size];

  // Apenas icone (sidebar compacta, favicon)
  if (variant === 'icon') {
    return <LogoIcon size={iconSize} variant="dark" />;
  }

  const fontSize = FONT_SIZES[size];

  // Cores do texto por variante
  let connectColor: string;
  let schappoColor: string;

  switch (variant) {
    case 'light':
      connectColor = '#FFFFFF';
      schappoColor = '#9CA3AF';
      break;
    case 'orange':
      connectColor = '#FFFFFF';
      schappoColor = 'rgba(255,255,255,0.7)';
      break;
    case 'dark':
    default:
      connectColor = '#1A1A1A';
      schappoColor = '#6B6B6B';
      break;
  }

  return (
    <div className="flex items-center" style={{ gap: size === 'lg' ? 14 : size === 'md' ? 12 : 10 }}>
      <LogoIcon size={iconSize} variant={variant} />
      <div className="flex items-baseline" style={{ gap: size === 'lg' ? 6 : 4, lineHeight: 1 }}>
        <span
          style={{
            fontWeight: 700,
            fontSize: fontSize.connect,
            letterSpacing: '-0.3px',
            color: connectColor,
            fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
          }}
        >
          Connect
        </span>
        <span
          style={{
            fontWeight: 300,
            fontSize: fontSize.schappo,
            letterSpacing: '-0.3px',
            color: schappoColor,
            fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
          }}
        >
          Schappo
        </span>
      </div>
    </div>
  );
}
