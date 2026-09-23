import fs from 'fs';
import path from 'path';

export default ({ config }) => {
  // ── Determine environment ───────────────────────────────────────────────────
  const appEnv = process.env.APP_ENV || process.env.EXPO_PUBLIC_ENV || 'production';
  const isProd = appEnv === 'production';

  // ── Dynamic App Identity to allow coexisting on the same mobile device ─────
  const appName = isProd ? "Saathi Network" : "Saathi Network (Beta)";
  const bundleId = isProd ? "com.maihoonna.sathiapp" : "com.maihoonna.sathiapp.staging";
  const scheme = isProd ? "sathinetwork" : "sathinetwork-staging";

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
      razorpayKeyId,
      eas: {
        projectId: "dfb5a3f3-6dfe-47b6-8418-df1bd2e27bc3"
      }
    },
  };
};
