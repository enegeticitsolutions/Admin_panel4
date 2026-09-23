# 📱 MaiHoonNa Mobile — Dual Environment (Staging & Production) Setup Guide

> **Target Audience:** Mobile Developers, QA Engineers, and DevOps Engineers.  
> **Apps Covered:** 
> 1. **Family Connect** (`apps/mobile-app`)
> 2. **Saathi Network** (`apps/sathi-app`)  
> **Last Updated:** September 2026

---

## 🎯 Overview & Architecture

Both mobile applications (**Family Connect** and **Saathi Network**) are configured with a **Dual-Environment Architecture**. This allows developers and testers to install both the **Staging/Testing Build** and the **Production Build** on the **same mobile phone (Android and iOS) at the same time without overwriting each other**.

### How Coexistence Works (Under the Hood)
Android and iOS identify installed applications by their **Package Name** (Android) and **Bundle Identifier** (iOS). If two builds share the same ID, the operating system replaces/overwrites the app.

By splitting identifiers dynamically at build time, both apps can live side-by-side on the same physical device:

---

## 📋 App Identification Matrix

### 1. Family Connect (`apps/mobile-app`)

| Property | 🧪 Staging / Testing (`staging` / `preview`) | 🚀 Production (`production`) |
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

### 2. Saathi Network (`apps/sathi-app`)

| Property | 🧪 Staging / Testing (`staging` / `preview`) | 🚀 Production (`production`) |
| :--- | :--- | :--- |
| **App Display Name** | `Saathi Network (Beta)` | `Saathi Network` |
| **Android Package** | `com.maihoonna.sathiapp.staging` | `com.maihoonna.sathiapp` |
| **iOS Bundle Identifier** | `com.maihoonna.sathiapp.staging` | `com.maihoonna.sathiapp` |
| **Deep Link Scheme** | `sathinetwork-staging://` | `sathinetwork://` |
| **Backend API URL** | `https://staging-api.maihoonna.com/app-api` | `https://api.maihoonna.com/app-api` |
| **Razorpay Mode** | Test Mode (`rzp_test_T5r7EAjfxEsAtl`) | Live Mode (`rzp_live_TZ3KKOCt6TIiSt`) |
| **iOS Google Services** | `GoogleService-Info.staging.plist` | `GoogleService-Info.plist` |
| **Android Google Services** | `google-services.json` (staging client entry) | `google-services.json` (prod client entry) |

---

## 🗺️ Google Maps API Key Details

Both applications and environments share the same Google Maps configuration.

### Android Google Maps
* **API Key:** `AIzaSyAv8pjhFQ8ZURUW02cwHThYUCnRYkw6Rp0`
* **Env Variable:** `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID`
* **Google Cloud Console Restrictions (Add all 4 packages):**
  1. `com.maihoonna.app` (Family Connect Prod)
  2. `com.maihoonna.app.staging` (Family Connect Staging)
  3. `com.maihoonna.sathiapp` (Saathi Network Prod)
  4. `com.maihoonna.sathiapp.staging` (Saathi Network Staging)
  * *Fingerprints:* Include SHA-1 fingerprints for your local debug keystore and EAS cloud build keystores.

### iOS Google Maps
* **API Key:** `AIzaSyBF998QC_UD_9qcsL8EYwnhDDD7zF_rgiU`
* **Env Variable:** `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS`
* **Google Cloud Console Restrictions (Add all 4 bundle IDs):**
  1. `com.maihoonna.app` (Family Connect Prod)
  2. `com.maihoonna.app.staging` (Family Connect Staging)
  3. `com.maihoonna.sathiapp` (Saathi Network Prod)
  4. `com.maihoonna.sathiapp.staging` (Saathi Network Staging)

---

## 🔥 Firebase & FCM Push Notification Keys

Both apps are linked to Firebase project `maihoonna-3d9ca`.

### Project Metadata
* **Firebase Project ID:** `maihoonna-3d9ca`
* **Firebase Project Number:** `706959347067`
* **Storage Bucket:** `maihoonna-3d9ca.firebasestorage.app`

### Package & App ID Mappings

| App | Flavor | Platform | Package / Bundle ID | Firebase App ID |
| :--- | :--- | :--- | :--- | :--- |
| **Family Connect** | Prod | Android | `com.maihoonna.app` | `1:706959347067:android:9b863492ff5e5cb0c681de` |
| **Family Connect** | Staging | Android | `com.maihoonna.app.staging` | `1:706959347067:android:9b863492ff5e5cb0c681de` |
| **Family Connect** | Prod | iOS | `com.maihoonna.app` | `1:706959347067:ios:1fb2f50f2c44f6c4c681de` |
| **Family Connect** | Staging | iOS | `com.maihoonna.app.staging` | `1:706959347067:ios:1fb2f50f2c44f6c4c681de` |
| **Saathi Network** | Prod | Android | `com.maihoonna.sathiapp` | `1:706959347067:android:1c0b7bc2b9b4604cc681de` |
| **Saathi Network** | Staging | Android | `com.maihoonna.sathiapp.staging` | `1:706959347067:android:1c0b7bc2b9b4604cc681de` |
| **Saathi Network** | Prod | iOS | `com.maihoonna.sathiapp` | `1:706959347067:ios:866299f13956ac28c681de` |
| **Saathi Network** | Staging | iOS | `com.maihoonna.sathiapp.staging` | `1:706959347067:ios:866299f13956ac28c681de` |

---

## 🛠️ Developer Commands Reference

Commands can be run inside either `apps/mobile-app` or `apps/sathi-app`:

### 1. Local Workspace Switching
Switch your local native files before running local emulators:

```bash
# Switch to STAGING (Beta name, staging package, staging plist)
npm run sync:staging

# Switch to PRODUCTION (Prod name, prod package, prod plist)
npm run sync:prod
```

---

### 2. EAS Cloud Build Commands

#### 🧪 Build Testing / Staging Builds
```bash
# Android Testing APK (installs with "(Beta)" name side-by-side with prod)
eas build --profile staging --platform android

# iOS Testing Build (Internal Ad Hoc distribution)
eas build --profile staging --platform ios

# iOS Simulator Build (for Mac Xcode simulator without provisioning profiles)
eas build --profile staging-simulator --platform ios

# Build both Android APK & iOS Staging together
eas build --profile staging --platform all
```

#### 🚀 Build Official Production Releases
```bash
# Production Release (Play Store .aab and Apple App Store .ipa)
eas build --profile production --platform all

# (Optional) Production direct-install APK
eas build --profile production-apk --platform android
```

---

## 🛡️ Cloudflare Turnstile & Mobile
* **Turnstile Captcha is WEB ONLY** (Admin portal and Website).
* Turnstile is **NOT required** for mobile.
* On the backend server (`apps/api`), ensure `REQUIRE_TURNSTILE` is **NOT** set to `true` (leave it unset or `false`), so mobile OTP/Auth requests proceed smoothly without requiring captcha tokens.
