// Funcoes de formatacao compartilhadas

/**
 * Formata telefone brasileiro para exibicao.
 * Ex: "5561999999999" -> "(61) 99999-9999"
 */
export function formatPhone(phone: string | null): string {
  if (!phone) return '';
  const num = phone.replace(/\D/g, '');
  if (num.length === 13 && num.startsWith('55')) {
    return `(${num.slice(2, 4)}) ${num.slice(4, 9)}-${num.slice(9)}`;
  }
  if (num.length === 12 && num.startsWith('55')) {
    return `(${num.slice(2, 4)}) ${num.slice(4, 8)}-${num.slice(8)}`;
  }
  return phone;
}

/**
 * Formata telefone sem DDI para exibicao curta.
 * Ex: "5561999999999" -> "(61) 999999999"
 */
export function formatPhoneShort(phone: string | null): string {
  if (!phone) return '';
  const num = phone.replace(/\D/g, '');
  if (num.length >= 12 && num.startsWith('55')) {
    return `(${num.slice(2, 4)}) ${num.slice(4)}`;
  }
  return phone;
}

/**
 * Formata telefone com DDI visivel.
 * Ex: "5561999999999" -> "+55 (61) 99999-9999"
 */
export function formatPhoneWithDDI(phone: string): string {
  const num = phone.replace(/\D/g, '');
  if (num.length === 13 && num.startsWith('55')) {
    return `+${num.slice(0, 2)} (${num.slice(2, 4)}) ${num.slice(4, 9)}-${num.slice(9)}`;
  }
  return phone;
}

/**
 * Formata data ISO (YYYY-MM-DD) para DD/MM/YYYY.
 */
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  } catch {
    return dateStr;
  }
}

/**
 * Formata datetime ISO para horario HH:MM.
 */
export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Formata datetime para exibicao em listas.
 * Hoje: "14:30", ontem/antes: "12/03"
 */
export function formatTimeOrDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/**
 * Formata datetime para exibicao em chamadas.
 * Hoje: "14:30", antes: "12/03 14:30"
 */
export function formatTimeWithDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return time;
  const day = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `${day} ${time}`;
}

/**
 * Formata datetime ISO para DD/MM/YYYY HH:MM.
 */
export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formata datetime relativo (ex: "5 min", "2h 30min").
 */
export function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Nunca';
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Agora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ${min % 60}min`;
  return `${Math.floor(h / 24)}d`;
}

/**
 * Formata segundos em timer MM:SS ou HH:MM:SS.
 */
export function formatTimer(seconds: number): string {
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
