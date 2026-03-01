export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startAMIListener } = await import('./lib/ami-listener');
    startAMIListener();

    const { startFichaValidator } = await import('./lib/ficha-validator');
    startFichaValidator();
  }
}
