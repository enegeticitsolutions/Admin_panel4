# 📱 MaiHoonNa Mobile — Dual Environment (Staging & Production) Setup Guide

> **Target Audience:** Mobile Developers, QA Engineers, and DevOps Engineers.  
> **Repository Path:** `apps/mobile-app`  
> **Last Updated:** September 2026

---

## 🎯 Overview & Architecture

We have configured the **Family Connect** mobile app with a **Dual-Environment Architecture**. This allows developers and testers to install both the **Staging/Testing Build** and the **Production Build** on the **same mobile phone (Android and iOS) at the same time without overwriting each other**.

### How Coexistence Works (Under the Hood)
Android and iOS identify installed applications by their **Package Name** (Android) and **Bundle Identifier** (iOS). If two builds share the same ID, the operating system replaces/overwrites the app.

By splitting identifiers dynamically at build time, both apps operate completely independently:

| Configuration Property | 🧪 Staging / Testing (`staging` / `preview`) | 🚀 Production (`production`) |
| :--- | :--- | :--- |
| **App Display Name** | `Family Connect (Beta)` | `Family Connect` |
| **Android Package** | `com.maihoonna.app.staging` | `com.maihoonna.app` |
| **iOS Bundle Identifier** | `com.maihoonna.app.staging` | `com.maihoonna.app` |
| **Deep Link Scheme** | `maihoonna-staging://` | `maihoonna://` |
| **Backend API URL** | `https://staging-api.maihoonna.com/app-api` | `https://api.maihoonna.com/app-api` |
| **Password Login UI** | Enabled (`EXPO_PUBLIC_ENABLE_PASSWORD_LOGIN=true`) | Disabled / OTP Only (`EXPO_PUBLIC_ENABLE_PASSWORD_LOGIN=false`) |
| **Razorpay Mode** | Test Mode (`rzp_test_T5r7EAjfxEsAtl`) | Live Mode (`rzp_live_TZ3KKOCt6TIiSt`) |
| **iOS Google Services** | `GoogleService-Info.staging.plist` | `GoogleService-Info.plist` |
| **Android Google Services** | `google-services.json` (staging client entry) | `google-services.json` (prod client entry) |

---

## 🗺️ Google Maps API Key Details

Both environments share the same Google Maps project. When configuring restrictions in **Google Cloud Console (Credentials)**, ensure the following settings:

### Android Google Maps
* **API Key:** `AIzaSyAv8pjhFQ8ZURUW02cwHThYUCnRYkw6Rp0`
* **Env Variable:** `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID`
* **Location in Code:**
  * `app.config.js` (`android.config.googleMaps.apiKey`)
  * `android/app/src/main/AndroidManifest.xml` (`com.google.android.geo.API_KEY`)
  * `eas.json` under `staging` and `production`
* **Google Cloud Console Restriction Requirement:**
  * Package Names allowed:
    1. `com.maihoonna.app` (Production)
    2. `com.maihoonna.app.staging` (Staging/Beta)
  * SHA-1 Certificate Fingerprints: Add both your local debug keystore SHA-1 and the EAS build keystore SHA-1.

### iOS Google Maps
* **API Key:** `AIzaSyBF998QC_UD_9qcsL8EYwnhDDD7zF_rgiU`
* **Env Variable:** `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS`
* **Location in Code:**
  * `app.config.js` (`ios.config.googleMapsApiKey`)
  * `ios/FamilyConnect/Info.plist` (`GMSApiKey`)
  * `eas.json` under `staging` and `production`
* **Google Cloud Console Restriction Requirement:**
  * Allowed iOS Bundle IDs:
    1. `com.maihoonna.app` (Production)
    2. `com.maihoonna.app.staging` (Staging/Beta)

---

## 🔥 Firebase & FCM Push Notification Keys

Both Staging and Production are linked to Firebase project `maihoonna-3d9ca`.

### Project Metadata
* **Firebase Project ID:** `maihoonna-3d9ca`
* **Firebase Project Number:** `706959347067`
* **Storage Bucket:** `maihoonna-3d9ca.firebasestorage.app`

### Android FCM (`google-services.json`)
The file [google-services.json](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/apps/mobile-app/google-services.json) contains client definitions for **both** packages:
```json
{
  "client": [
    {
      "client_info": {
        "mobilesdk_app_id": "1:706959347067:android:9b863492ff5e5cb0c681de",
        "android_client_info": { "package_name": "com.maihoonna.app" }
      },
      "api_key": [{ "current_key": "AIzaSyDJmE_CQ9gF_MjzCiwmhIPPLw-L8dhi0lk" }]
    },
    {
      "client_info": {
        "mobilesdk_app_id": "1:706959347067:android:9b863492ff5e5cb0c681de",
        "android_client_info": { "package_name": "com.maihoonna.app.staging" }
      },
      "api_key": [{ "current_key": "AIzaSyDJmE_CQ9gF_MjzCiwmhIPPLw-L8dhi0lk" }]
    }
  ]
}
```

### iOS FCM Plists
* **Production Plist:** [GoogleService-Info.plist](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/apps/mobile-app/GoogleService-Info.plist)
  * `BUNDLE_ID` = `com.maihoonna.app`
  * `GOOGLE_APP_ID` = `1:706959347067:ios:1fb2f50f2c44f6c4c681de`
  * `API_KEY` = `AIzaSyCkGy0ZMdZixsnAujCqbZcM8p0_FR0H0M8`
* **Staging Plist:** [GoogleService-Info.staging.plist](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/apps/mobile-app/GoogleService-Info.staging.plist)
  * `BUNDLE_ID` = `com.maihoonna.app.staging`
  * `GOOGLE_APP_ID` = `1:706959347067:ios:1fb2f50f2c44f6c4c681de`
  * `API_KEY` = `AIzaSyCkGy0ZMdZixsnAujCqbZcM8p0_FR0H0M8`

---

## 🛠️ Developer Commands Reference

Navigate to the mobile app directory first:
```bash
cd apps/mobile-app
```

### 1. Local Workspace Switching
If you are developing locally with `npm run android` or `npm run ios`, switch your native workspace files with one command:

```bash
# Switch local configuration to STAGING (Beta name, staging package, staging plist)
npm run sync:staging

# Switch local configuration to PRODUCTION (Prod name, prod package, prod plist)
npm run sync:prod
```

> **Note:** The sync script [scripts/sync-env.js](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/apps/mobile-app/scripts/sync-env.js) automatically updates:
> * `android/app/src/main/res/values/strings.xml` (`app_name`)
> * `android/app/build.gradle` (`applicationId`)
> * `ios/FamilyConnect/Info.plist` (`CFBundleDisplayName`)
> * `ios/FamilyConnect.xcodeproj/project.pbxproj` (`PRODUCT_BUNDLE_IDENTIFIER`)
> * Swaps `GoogleService-Info.plist`

---

### 2. EAS Cloud Build Commands

#### 🧪 Build Testing / Staging Versions
```bash
# 1. Android Testing APK (installs as "Family Connect (Beta)", side-by-side with prod)
eas build --profile staging --platform android

# 2. iOS Testing Build (Internal distribution for registered Apple devices)
eas build --profile staging --platform ios

# 3. iOS Simulator Build (for testing in Mac Xcode simulator without provisioning profiles)
eas build --profile staging-simulator --platform ios

# 4. Build both Android APK & iOS Staging together
eas build --profile staging --platform all
```

#### 🚀 Build Official Production Releases
```bash
# 1. Production Release (Play Store .aab and Apple App Store .ipa)
eas build --profile production --platform all

# 2. Production Android Play Store Bundle only
eas build --profile production --platform android

# 3. (Optional) Production direct-install APK (for internal smoke-testing prod endpoints)
eas build --profile production-apk --platform android
```

---

## 🛡️ Cloudflare Turnstile & Mobile
* **Turnstile Captcha is WEB ONLY** (Admin portal and Website).
* Turnstile is **NOT required** for mobile.
* On the backend server (`apps/api`), ensure `REQUIRE_TURNSTILE` is **NOT** set to `true` (leave it unset or `false`), so mobile OTP/Auth requests proceed smoothly without requiring captcha tokens.

---

## 📁 Key File Locations

| File | Purpose |
| :--- | :--- |
| [app.config.js](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/apps/mobile-app/app.config.js) | Dynamic Expo app manifest (name, bundleId, scheme, keys) |
| [eas.json](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/apps/mobile-app/eas.json) | EAS build profiles (`staging`, `preview`, `production`, env vars) |
| [scripts/sync-env.js](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/apps/mobile-app/scripts/sync-env.js) | Native pre-build synchronizer |
| [google-services.json](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/apps/mobile-app/google-services.json) | Android Firebase config (both prod & staging clients) |
| [GoogleService-Info.plist](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/apps/mobile-app/GoogleService-Info.plist) | iOS Production Firebase config |
| [GoogleService-Info.staging.plist](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/apps/mobile-app/GoogleService-Info.staging.plist) | iOS Staging Firebase config |
| [constants/api.ts](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/apps/mobile-app/constants/api.ts) | Runtime API URL selector (`USE_LOCAL ? local : PRODUCTION_URL`) |
