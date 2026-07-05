import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.joyeriamarine.pos',
  appName: 'JoyeriaMarine',
  webDir: 'client',
  android: {
    backgroundColor: '#00000000' // Transparent background so camera shows through
  }
};

export default config;
