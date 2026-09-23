#!/usr/bin/env node

/**
 * sync-env.js (Saathi Network)
 *
 * Automatically synchronizes native Android & iOS configuration with the target environment
 * (staging vs production). This ensures that staging and production builds can be installed
 * side-by-side on both Android and iOS without overwriting each other.
 *
 * Usage:
 *   node scripts/sync-env.js [staging|production]
 *   Or automatically invoked via EAS Build hook: `eas-build-pre-build`
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

// 1. Determine environment
const rawEnv = process.argv[2] || process.env.APP_ENV || process.env.EXPO_PUBLIC_ENV || 'production';
const isProd = rawEnv.toLowerCase() === 'production';
const envName = isProd ? 'production' : 'staging';

const config = {
  appName: isProd ? 'Saathi Network' : 'Saathi Network (Beta)',
  bundleId: isProd ? 'com.maihoonna.sathiapp' : 'com.maihoonna.sathiapp.staging',
  scheme: isProd ? 'sathinetwork' : 'sathinetwork-staging',
};

console.log(`\n======================================================`);
console.log(`🚀 [Sync-Env] Configuring Saathi App for: ${envName.toUpperCase()}`);
console.log(`   App Name:   ${config.appName}`);
console.log(`   Bundle ID:  ${config.bundleId}`);
console.log(`   Scheme:     ${config.scheme}`);
console.log(`======================================================\n`);

// ─────────────────────────────────────────────────────────────────────────────
// 2. Sync Android Files
// ─────────────────────────────────────────────────────────────────────────────
// 2.1 Sync strings.xml app_name
const stringsXmlPath = path.join(rootDir, 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml');
if (fs.existsSync(stringsXmlPath)) {
  let content = fs.readFileSync(stringsXmlPath, 'utf8');
  content = content.replace(/<string name="app_name">.*?<\/string>/, `<string name="app_name">${config.appName}</string>`);
  fs.writeFileSync(stringsXmlPath, content, 'utf8');
  console.log(`✅ [Android] Updated app_name in strings.xml -> "${config.appName}"`);
}

// 2.2 Sync google-services.json to android/app
const rootGoogleServices = path.join(rootDir, 'google-services.json');
const androidGoogleServices = path.join(rootDir, 'android', 'app', 'google-services.json');
if (fs.existsSync(rootGoogleServices)) {
  fs.copyFileSync(rootGoogleServices, androidGoogleServices);
  console.log(`✅ [Android] Synchronized google-services.json to android/app`);
}

// 2.3 Sync Android build.gradle applicationId
const buildGradlePath = path.join(rootDir, 'android', 'app', 'build.gradle');
if (fs.existsSync(buildGradlePath)) {
  let gradleContent = fs.readFileSync(buildGradlePath, 'utf8');
  gradleContent = gradleContent.replace(/applicationId\s+['"][^'"]+['"]/, `applicationId '${config.bundleId}'`);
  fs.writeFileSync(buildGradlePath, gradleContent, 'utf8');
  console.log(`✅ [Android] Set applicationId to '${config.bundleId}' in build.gradle`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Sync iOS Files
// ─────────────────────────────────────────────────────────────────────────────
// 3.1 Sync Info.plist CFBundleDisplayName
const infoPlistPath = path.join(rootDir, 'ios', 'SaathiNetwork', 'Info.plist');
if (fs.existsSync(infoPlistPath)) {
  let plistContent = fs.readFileSync(infoPlistPath, 'utf8');
  plistContent = plistContent.replace(
    /(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]*(<\/string>)/,
    `$1${config.appName}$2`
  );
  fs.writeFileSync(infoPlistPath, plistContent, 'utf8');
  console.log(`✅ [iOS] Updated CFBundleDisplayName in Info.plist -> "${config.appName}"`);
}

// 3.2 Sync project.pbxproj PRODUCT_BUNDLE_IDENTIFIER
const pbxprojPath = path.join(rootDir, 'ios', 'SaathiNetwork.xcodeproj', 'project.pbxproj');
if (fs.existsSync(pbxprojPath)) {
  let pbxContent = fs.readFileSync(pbxprojPath, 'utf8');
  pbxContent = pbxContent.replace(/PRODUCT_BUNDLE_IDENTIFIER = com\.maihoonna\.sathiapp(\.staging)?;/g, `PRODUCT_BUNDLE_IDENTIFIER = ${config.bundleId};`);
  fs.writeFileSync(pbxprojPath, pbxContent, 'utf8');
  console.log(`✅ [iOS] Set PRODUCT_BUNDLE_IDENTIFIER to '${config.bundleId}' in project.pbxproj`);
}

// 3.3 Sync GoogleService-Info.plist for iOS
const iosGoogleServices = path.join(rootDir, 'ios', 'SaathiNetwork', 'GoogleService-Info.plist');
const iosStagingGoogleServices = path.join(rootDir, 'GoogleService-Info.staging.plist');
const iosProdGoogleServices = path.join(rootDir, 'GoogleService-Info.plist');

if (!isProd && fs.existsSync(iosStagingGoogleServices)) {
  fs.copyFileSync(iosStagingGoogleServices, iosGoogleServices);
  console.log(`✅ [iOS] Copied GoogleService-Info.staging.plist -> ios/SaathiNetwork/GoogleService-Info.plist`);
} else if (isProd && fs.existsSync(iosProdGoogleServices)) {
  fs.copyFileSync(iosProdGoogleServices, iosGoogleServices);
  console.log(`✅ [iOS] Copied production GoogleService-Info.plist -> ios/SaathiNetwork/GoogleService-Info.plist`);
}

console.log(`\n🎉 [Sync-Env] Environment synchronization complete!\n`);
