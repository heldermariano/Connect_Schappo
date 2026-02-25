// Desktop Notifications (Browser Notification API)

export function requestNotificationPermission(): void {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

export function showDesktopNotification(title: string, body: string): void {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (document.hasFocus()) return;

  try {
    const notification = new Notification(title, {
      body,
      icon: '/favicon.svg',
      tag: 'connect-schappo-msg',
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    setTimeout(() => notification.close(), 5000);
  } catch {
    // Falha silenciosa
  }
}
