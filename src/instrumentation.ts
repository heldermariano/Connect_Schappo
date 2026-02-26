export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startFichaValidator } = await import('./lib/ficha-validator');
    startFichaValidator();
  }
}
