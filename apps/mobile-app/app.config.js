export default ({ config }) => {
  // ── Razorpay key resolution ─────────────────────────────────────────────────
  // Strip any accidental surrounding quotes that some .env parsers leave in.
  const rawRazorpayKey = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || '';
  const razorpayKeyId = rawRazorpayKey.replace(/^["']|["']$/g, '').trim();

  return {
    ...config,

    ios: {
      ...config.ios,
      config: {
        ...config.ios?.config,
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS || config.ios?.config?.googleMapsApiKey,
      },
    },

    android: {
      ...config.android,
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

