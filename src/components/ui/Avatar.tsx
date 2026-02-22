'use client';

interface AvatarProps {
  nome: string;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isGroup?: boolean;
}

const SIZES = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
};

const COLORS = [
  'bg-schappo-500',
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-rose-500',
];

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function getInitials(nome: string, isGroup: boolean): string {
  if (isGroup) return 'G';
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return nome.charAt(0).toUpperCase() || '?';
}

export default function Avatar({ nome, avatarUrl, size = 'md', isGroup = false }: AvatarProps) {
  const sizeClass = SIZES[size];
  const hasImage = avatarUrl && avatarUrl.startsWith('http');

  if (hasImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={nome}
        className={`${sizeClass} rounded-full object-cover shrink-0`}
      />
    );
  }

  const color = getColor(nome);
  const initials = getInitials(nome, isGroup);

  return (
    <div className={`${sizeClass} rounded-full ${color} flex items-center justify-center font-medium text-white shrink-0`}>
      {initials}
    </div>
  );
}

/**
 * Retorna uma cor CSS consistente para um nome (util para nomes de sender em grupos).
 */
export function getSenderColor(name: string): string {
  const SENDER_COLORS = [
    'text-schappo-600',
    'text-blue-600',
    'text-green-600',
    'text-purple-600',
    'text-pink-600',
    'text-teal-600',
    'text-indigo-600',
    'text-rose-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length];
}
