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

function createToastContainer(): HTMLElement {
  const container = document.createElement('div');
  container.id = 'toast-container';
  container.className = 'fixed top-4 right-4 z-[9999]';
  document.body.appendChild(container);
  return container;
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
