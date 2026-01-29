import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.meatpr.production',
    appName: 'Производство',
    webDir: 'dist',
    server: {
        // Для разработки: подключение к dev-серверу
        // url: 'http://192.168.1.100:5173',
        // cleartext: true
    },
    android: {
        buildOptions: {
            keystorePath: undefined,
            keystoreAlias: undefined,
        }
    },
    plugins: {
        SplashScreen: {
            launchShowDuration: 2000,
            backgroundColor: "#1e1b4b",
            showSpinner: false,
        }
    }
};

export default config;
