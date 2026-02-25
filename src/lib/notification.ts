// Helper para notificacoes visuais e sonoras

let audioCtx: AudioContext | null = null;

/**
 * Toca um beep curto usando Web Audio API.
 * Nao depende de arquivo de audio externo.
 */
export function playNotificationBeep(): void {
  try {
    if (!audioCtx) {
      audioCtx = new AudioContext();
    }

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // La5
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.3);
  } catch {
    // Falha silenciosa (ex: autoplay bloqueado pelo browser)
  }
}

/**
 * Mostra uma notificacao toast temporaria no canto superior direito.
 * Usa DOM direto para nao depender de biblioteca de toast.
 */
export function showMentionToast(senderName: string, groupName?: string): void {
  const container = document.getElementById('toast-container') || createToastContainer();

  const toast = document.createElement('div');
  toast.className =
    'mb-2 px-4 py-3 bg-schappo-500 text-white rounded-lg shadow-lg text-sm flex items-center gap-2 animate-slide-in max-w-xs';
  toast.innerHTML = `
    <span class="font-bold">@</span>
    <div>
      <div class="font-semibold">${escapeHtml(senderName)} mencionou voce</div>
      ${groupName ? `<div class="text-xs text-white/80">${escapeHtml(groupName)}</div>` : ''}
    </div>
  `;

  container.appendChild(toast);

  // Remover apos 4 segundos
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Labels dos canais
const CANAL_LABELS: Record<string, string> = {
  eeg: 'EEG',
  recepcao: 'Recepção',
  geral: 'Geral',
};

/**
 * Mostra toast de notificacao no canto superior direito.
 * Fundo preto, nome do remetente, preview da mensagem e badge do canal.
 * Auto-desaparece em 5s. Suporta multiplas toasts empilhadas.
 */
export function showToastNotification(
  title: string,
  body: string,
  onClick?: () => void,
  canal?: string,
): void {
  const container = document.getElementById('toast-container') || createToastContainer();

  const toast = document.createElement('div');
  toast.style.cssText = 'animation: toast-slide-in 0.3s ease forwards; opacity: 0; transform: translateX(100%); background:#000; color:#fff; border-radius:12px; padding:12px 16px; margin-bottom:8px; max-width:360px; cursor:pointer; box-shadow:0 8px 30px rgba(0,0,0,0.4); display:flex; align-items:flex-start; gap:10px;';

  // Iniciais do remetente
  const initials = title
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const canalLabel = canal ? (CANAL_LABELS[canal] || canal.toUpperCase()) : '';
  const canalBadge = canalLabel
    ? `<span style="display:inline-block;font-size:10px;font-weight:600;background:#F58220;color:#fff;padding:1px 6px;border-radius:4px;margin-left:6px;vertical-align:middle">${escapeHtml(canalLabel)}</span>`
    : '';

  toast.innerHTML = `
    <div style="width:36px;height:36px;border-radius:50%;background:#F58220;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;color:#fff">${escapeHtml(initials)}</div>
    <div style="flex:1;min-width:0">
      <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(title)}${canalBadge}</div>
      <div style="font-size:12px;color:#a3a3a3;overflow:hidden;text-overflow:ellipsis;margin-top:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${escapeHtml(body)}</div>
    </div>
  `;

  if (onClick) {
    toast.addEventListener('click', () => {
      onClick();
      toast.remove();
    });
  }

  container.appendChild(toast);

  // Injetar animacao CSS se nao existir
  ensureToastStyles();

  // Remover apos 5 segundos
  setTimeout(() => {
    toast.style.animation = 'toast-slide-out 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

function createToastContainer(): HTMLElement {
  const container = document.createElement('div');
  container.id = 'toast-container';
  container.className = 'fixed top-16 right-4 z-[9999]';
  document.body.appendChild(container);
  return container;
}

let stylesInjected = false;
function ensureToastStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes toast-slide-in {
      from { opacity: 0; transform: translateX(100%); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes toast-slide-out {
      from { opacity: 1; transform: translateX(0); }
      to { opacity: 0; transform: translateX(100%); }
    }
  `;
  document.head.appendChild(style);
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
