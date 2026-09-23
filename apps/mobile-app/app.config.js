import fs from 'fs';
import path from 'path';

export default ({ config }) => {
  // ── Determine environment ───────────────────────────────────────────────────
  // Default to 'production' if not explicitly staging/preview/development
  const appEnv = process.env.APP_ENV || process.env.EXPO_PUBLIC_ENV || 'production';
  const isProd = appEnv === 'production';

  // ── Dynamic App Identity to allow coexisting on the same mobile device ─────
  const appName = isProd ? "Family Connect" : "Family Connect (Beta)";
  const bundleId = isProd ? "com.maihoonna.app" : "com.maihoonna.app.staging";
  const scheme = isProd ? "maihoonna" : "maihoonna-staging";

  // ── Razorpay key resolution ─────────────────────────────────────────────────
  // Strip any accidental surrounding quotes that some .env parsers leave in.
  const rawRazorpayKey = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || '';
  const razorpayKeyId = rawRazorpayKey.replace(/^["']|["']$/g, '').trim();

  // Select iOS Firebase GoogleService-Info.plist file
  const iosGoogleServicesFile = (!isProd && fs.existsSync(path.resolve(__dirname, 'GoogleService-Info.staging.plist')))
    ? './GoogleService-Info.staging.plist'
    : './GoogleService-Info.plist';

  return {
    ...config,
    name: appName,
    scheme: scheme,

    ios: {
      ...config.ios,
      bundleIdentifier: bundleId,
      googleServicesFile: iosGoogleServicesFile,
      config: {
        ...config.ios?.config,
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS || config.ios?.config?.googleMapsApiKey,
      },
    },

    android: {
      ...config.android,
      package: bundleId,
      config: {
        ...config.android?.config,
        googleMaps: {
          ...config.android?.config?.googleMaps,
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID || config.android?.config?.googleMaps?.apiKey,
        },
      },
    },

    // ── Bake env vars into the bundle so they work in ALL Expo environments ───
    // (Expo Go dev builds, EAS preview APKs, and production builds)
    extra: {
      ...config.extra,
      appEnv,
      eas: {
        projectId: "884c08eb-199b-49a2-9c0c-f6ec9ff3586b",
      },
      razorpayKeyId,
      firebase: {
        projectNumber: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_NUMBER || '',
        projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
        storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
        appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
        apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
      },
    },
  };
};
