import { Platform } from 'react-native';

// ─── Environment Switch ────────────────────────────────────────────────────
// If EXPO_PUBLIC_ENV is explicitly set to 'local', use local. Otherwise default to 'production'
const ENV = process.env.EXPO_PUBLIC_ENV || 'production';
const USE_LOCAL = ENV === 'local';

const PRODUCTION_URL = (process.env.EXPO_PUBLIC_PRODUCTION_API_URL ?? 'https://api.maihoonna.com/app-api').replace(/\/+$/, '');

const LOCAL_IP = process.env.EXPO_PUBLIC_LOCAL_IP ?? 'localhost';
const PORT = process.env.EXPO_PUBLIC_API_PORT ?? '8001';

// ─── Local URL (auto-handles emulator vs web vs physical device) ─────────────
const getLocalUrl = () => {
    // 1. If we are testing on Local Web, we can safely use localhost!
    if (Platform.OS === 'web') {
        return `http://localhost:${PORT}/api`;
    }

    // 2. Graceful handling if you accidentally include 'http://' in your .env IP
    if (LOCAL_IP.startsWith('http')) {
        return LOCAL_IP.includes(`:${PORT}`) ? `${LOCAL_IP}/api` : `${LOCAL_IP}:${PORT}/api`;
    }

    // 3. Android emulators / physical devices
    if (Platform.OS === 'android') {
        // For physical devices using `adb reverse tcp:PORT tcp:PORT`, 127.0.0.1 works via USB tunnel.
        // 10.0.2.2 is only for the Android emulator (which does NOT support adb reverse).
        const host = LOCAL_IP === 'localhost' ? '10.0.2.2' : LOCAL_IP;
        return `http://${host}:${PORT}/api`;
    }
    
    // 4. iOS simulator / physical iOS
    return `http://${LOCAL_IP}:${PORT}/api`;
};

// ─── Export final URL ─────────────────────────────────────────────────────────
export const API_URL = USE_LOCAL ? getLocalUrl() : PRODUCTION_URL;

// Handy for debugging — shows in Metro console on startup
console.log(`[API] Platform: ${Platform.OS} | Environment: ${USE_LOCAL ? 'LOCAL' : 'PRODUCTION'} → ${API_URL}`);
