import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.clinicaschappo.connect',
  appName: 'Connect Schappo',
  webDir: 'public',
  server: {
    url: 'https://connect.clinicaschappo.com',
    cleartext: false,
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#F58220',
    },
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#1A1A1A',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
