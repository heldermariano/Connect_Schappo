export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // TODO: reativar AMI listener quando softphone/chamadas voltar
    // const { startAMIListener } = await import('./lib/ami-listener');
    // startAMIListener();

    const { startFichaValidator } = await import('./lib/ficha-validator');
    startFichaValidator();
  }
}
