'use client';

import { Chamada } from '@/lib/types';
import CallButton from './CallButton';

interface CallItemProps {
  chamada: Chamada & { atendente_nome?: string | null };
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return '--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return time;
  const day = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `${day} ${time}`;
}

function getStatusConfig(status: string): { label: string; color: string; icon: string } {
  switch (status) {
    case 'ringing':
      return { label: 'Tocando', color: 'text-yellow-600 bg-yellow-50', icon: '\uD83D\uDD14' };
    case 'answered':
      return { label: 'Atendida', color: 'text-green-600 bg-green-50', icon: '\u2705' };
    case 'missed':
      return { label: 'Perdida', color: 'text-red-600 bg-red-50', icon: '\u274C' };
    case 'rejected':
      return { label: 'Rejeitada', color: 'text-red-600 bg-red-50', icon: '\u26D4' };
    case 'voicemail':
      return { label: 'Voicemail', color: 'text-purple-600 bg-purple-50', icon: '\uD83D\uDCE8' };
    case 'busy':
      return { label: 'Ocupado', color: 'text-orange-600 bg-orange-50', icon: '\uD83D\uDEAB' };
    case 'failed':
      return { label: 'Falha', color: 'text-gray-600 bg-gray-50', icon: '\u26A0\uFE0F' };
    default:
      return { label: status, color: 'text-gray-600 bg-gray-50', icon: '\uD83D\uDCDE' };
  }
}

function getOrigemLabel(origem: string): { label: string; icon: string } {
  switch (origem) {
    case 'whatsapp':
      return { label: 'WhatsApp Voz', icon: '\uD83D\uDCF1' };
    case 'telefone':
      return { label: 'Telefone', icon: '\u260E\uFE0F' };
    case 'whatsapp-tentativa':
      return { label: 'Tentativa WhatsApp', icon: '\u26A0\uFE0F' };
    default:
      return { label: origem, icon: '\uD83D\uDCDE' };
  }
}

export default function CallItem({ chamada }: CallItemProps) {
  const statusConfig = getStatusConfig(chamada.status);
  const origemConfig = getOrigemLabel(chamada.origem);
  const isIncoming = chamada.direcao === 'recebida';

  // Numero para rediscar: se recebida, ligar para caller; se realizada, ligar para called
  const rediscNumber = isIncoming ? chamada.caller_number : chamada.called_number;
  // Mostrar rediscar apenas para chamadas finalizadas com numero valido
  const showRedial = rediscNumber && rediscNumber.length >= 8 && chamada.status !== 'ringing';

  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
      {/* Icone direcao */}
      <div className="shrink-0">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
          chamada.status === 'missed' || chamada.status === 'rejected'
            ? 'bg-red-100'
            : chamada.status === 'answered'
            ? 'bg-green-100'
            : 'bg-gray-100'
        }`}>
          {isIncoming ? (
            <svg className={`w-5 h-5 ${chamada.status === 'missed' ? 'text-red-500' : 'text-green-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-schappo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          )}
        </div>
      </div>

      {/* Info principal */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {chamada.caller_number || 'Desconhecido'}
          </span>
          <span className="text-[11px] text-gray-400 dark:text-gray-500">
            {isIncoming ? '\u2192' : '\u2190'} {chamada.called_number || '--'}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-gray-400">
            {origemConfig.icon} {origemConfig.label}
          </span>
          {chamada.ramal_atendeu && (
            <span className="text-[11px] text-gray-400">
              Ramal {chamada.ramal_atendeu}
            </span>
          )}
          {chamada.atendente_nome && (
            <span className="text-[11px] text-schappo-500">
              {chamada.atendente_nome}
            </span>
          )}
        </div>
      </div>

      {/* Rediscar */}
      {showRedial && (
        <div className="shrink-0">
          <CallButton telefone={rediscNumber} size="sm" />
        </div>
      )}

      {/* Status + duracao */}
      <div className="text-right shrink-0">
        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusConfig.color}`}>
          {statusConfig.icon} {statusConfig.label}
        </span>
        <div className="text-[11px] text-gray-400 mt-0.5">
          {formatDuration(chamada.duracao_seg)} &middot; {formatTime(chamada.inicio_at)}
        </div>
      </div>
    </div>
  );
}
