# 🍎 Apple App Store Submission Master Guide
**MaiHoonNa (Subscriber/Senior App) & Sathi Network (Care Companion App)**

This master guide contains every single task, file edit, configuration setting, and review note required to get both iOS applications approved on the Apple App Store on the **first attempt**.

---

## 📑 Table of Contents
1. [App Overview & Bundle Identification](#1-app-overview--bundle-identification)
2. [Task Checklist Overview](#2-task-checklist-overview)
3. [Phase 1: Code & Configuration Changes (File-by-File)](#phase-1-code--configuration-changes)
4. [Phase 2: Database & Reviewer Test Accounts](#phase-2-database--reviewer-test-accounts)
5. [Phase 3: Visual Assets & Screenshot Guidelines](#phase-3-visual-assets--screenshot-guidelines)
6. [Phase 4: App Store Connect Portal Configuration](#phase-4-app-store-connect-portal-configuration)
7. [Phase 5: The Critical App Review Notes (Copy-Paste Text)](#phase-5-the-critical-app-review-notes)
8. [Phase 6: Build, TestFlight Smoke Test & Submission](#phase-6-build-testflight-smoke-test--submission)
9. [Phase 7: Fast-Track Expedited Review Process](#phase-7-fast-track-expedited-review-process)

---

## 1. App Overview & Bundle Identification

Both apps are completely separate applications in App Store Connect with independent versioning, screenshots, and review notes:

| Property | App 1: MaiHoonNa (Senior & Family) | App 2: Sathi Network (Care Companion) |
| :--- | :--- | :--- |
| **Directory** | `apps/mobile-app` | `apps/sathi-app` |
| **Target Audience** | Senior citizens, subscribers, family members | Care companions, nurses, volunteers |
| **Bundle Identifier** | `com.maihoonna.app` | `com.maihoonna.sathiapp` |
| **Scheme** | `maihoonna` | `sathinetwork` |
| **Current Target Version** | `1.0.0` | `1.0.0` |
| **Current Target Build** | `2` (Incremented from rejected build 1) | `2` (Incremented from rejected build 1) |

---

## 2. Task Checklist Overview

Use this master checklist to track progress:

```markdown
[ ] Task 1.1: Disable tablet support in apps/sathi-app/app.json
[ ] Task 1.2: Set buildNumber to "2" in apps/sathi-app/app.json
[ ] Task 1.3: Update Info.plist in apps/sathi-app (Permissions, Encryption, CFBundleVersion)
[ ] Task 1.4: Disable tablet support in apps/mobile-app/app.json
[ ] Task 1.5: Set buildNumber to "2" in apps/mobile-app/app.json
[ ] Task 1.6: Update Info.plist in apps/mobile-app (Permissions, Encryption, CFBundleVersion)
[ ] Task 2.1: Verify test bypass phone (8585858585) & static OTP (442233)
[ ] Task 2.2: Seed mock companion visit data for Sathi test account
[ ] Task 2.3: Seed mock subscriber package data for MaiHoonNa test account
[ ] Task 3.1: Confirm 1024x1024 App Icons have NO alpha transparency
[ ] Task 3.2: Export 6.7" iPhone screenshots with zero Android UI bleed
[ ] Task 3.3: Record 60-second unlisted demo walkthrough video for each app
[ ] Task 4.1: Fill App Store Connect general information & categories
[ ] Task 4.2: Add live HTTPS Privacy, Support, and Marketing URLs
[ ] Task 4.3: Add App Description with mandatory Medical Disclaimer
[ ] Task 4.4: Complete App Privacy Data Nutrition Label questionnaire
[ ] Task 4.5: Complete Age Rating questionnaire (Medical: Infrequent/Mild)
[ ] Task 5.1: Paste Review Notes for Sathi App (Razorpay Guideline 3.1.5(a) + Video)
[ ] Task 5.2: Paste Review Notes for MaiHoonNa App (Razorpay Guideline 3.1.5(a) + Video)
[ ] Task 6.1: Run cloud production builds via EAS
[ ] Task 6.2: Test on physical iPhone via TestFlight
[ ] Task 6.3: Submit to App Review
[ ] Task 7.1: (Optional) Submit Expedited Review Request
```

---

## Phase 1: Code & Configuration Changes

### 1.1 Sathi App (`apps/sathi-app`)

#### File: `apps/sathi-app/app.json`
Update the `ios` configuration block:
```json
"ios": {
  "supportsTablet": false,
  "buildNumber": "2",
  "config": {
    "googleMapsApiKey": "AIzaSyDPrFpN29FZ786mTWjIbeQvW3y6ztjx3xU"
  },
  "bundleIdentifier": "com.maihoonna.sathiapp",
  "googleServicesFile": "./GoogleService-Info.plist"
}
```

#### File: `apps/sathi-app/ios/sathinetwork/Info.plist`
Make the following exact updates:
1. **Update `CFBundleVersion` to `"2"`**:
   ```xml
   <key>CFBundleVersion</key>
   <string>2</string>
   ```
2. **Add Encryption Exemption (Inside the main `<dict>`)**:
   ```xml
   <key>ITSAppUsesNonExemptEncryption</key>
   <false/>
   ```
3. **Replace Generic Permissions with User-Centric Purpose Descriptions**:
   ```xml
   <key>NSCameraUsageDescription</key>
   <string>MaiHoonNa requires camera access to capture verification photos during care companion visits and update profile photos.</string>
   
   <key>NSPhotoLibraryUsageDescription</key>
   <string>MaiHoonNa requires photo library access to upload identity verification documents and profile photos.</string>
   
   <key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
   <string>MaiHoonNa needs your location to show assigned visit locations on the map and coordinate care companion dispatch.</string>
   
   <key>NSLocationWhenInUseUsageDescription</key>
   <string>MaiHoonNa needs your location to navigate to elder care service addresses and locate nearby companion visits.</string>
   
   <key>NSLocationAlwaysUsageDescription</key>
   <string>MaiHoonNa uses your location in the background to ensure companion safety and real-time coordination during active field visits.</string>
   
   <key>NSFaceIDUsageDescription</key>
   <string>MaiHoonNa uses Face ID to provide fast, secure login for care companions.</string>
   ```
4. **Remove Unused Microphone Key**:
   Delete `<key>NSMicrophoneUsageDescription</key>` and its `<string>` entirely if voice recording is not implemented.

---

### 1.2 MaiHoonNa User App (`apps/mobile-app`)

#### File: `apps/mobile-app/app.json`
Update the `ios` configuration block:
```json
"ios": {
  "supportsTablet": false,
  "buildNumber": "2",
  "config": {
    "googleMapsApiKey": "AIzaSyDPrFpN29FZ786mTWjIbeQvW3y6ztjx3xU"
  },
  "bundleIdentifier": "com.maihoonna.app",
  "icon": "./assets/images/icon.png",
  "googleServicesFile": "./GoogleService-Info.plist"
}
```

#### File: `apps/mobile-app/ios/maihoonna/Info.plist`
Make the following exact updates:
1. **Update `CFBundleVersion` to `"2"`**:
   ```xml
   <key>CFBundleVersion</key>
   <string>2</string>
   ```
2. **Add Encryption Exemption (Inside the main `<dict>`)**:
   ```xml
   <key>ITSAppUsesNonExemptEncryption</key>
   <false/>
   ```
3. **Replace Generic Permissions with Clear Health & Safety Rationale**:
   ```xml
   <key>NSCameraUsageDescription</key>
   <string>MaiHoonNa requires camera access to photograph prescriptions, medical records, and senior profile photos.</string>
   
   <key>NSPhotoLibraryUsageDescription</key>
   <string>MaiHoonNa requires photo library access to upload existing medical reports, prescription documents, and profile pictures.</string>
   
   <key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
   <string>MaiHoonNa uses your location to share accurate GPS coordinates with your care team and family when an SOS Emergency Alert is triggered.</string>
   
   <key>NSLocationAlwaysUsageDescription</key>
   <string>MaiHoonNa needs background location access so your GPS coordinates are immediately broadcast to caregivers the instant you press the SOS button.</string>
   
   <key>NSLocationWhenInUseUsageDescription</key>
   <string>MaiHoonNa needs your location to pin your home address and connect you with nearby Care Companions and nurses.</string>
   
   <key>NSFaceIDUsageDescription</key>
   <string>MaiHoonNa uses Face ID to provide secure, biometric login to protect sensitive medical and family profile details.</string>
   ```
4. **Remove Unused Microphone Key**:
   Delete `<key>NSMicrophoneUsageDescription</key>` and its `<string>`.

---

## Phase 2: Database & Reviewer Test Accounts

Apple reviewers test from California or Ireland. They will **not receive SMS OTPs**.

### 2.1 Fixed Reviewer Credentials (Already Wired in Backend)
The backend `StplProvider.ts` has a hardcoded bypass for these phone numbers:
* **Test Phone Number**: `8585858585`
* **Static Verification OTP**: `442233`

### 2.2 Mandatory Test Data Seeding
Before submitting, ensure user `8585858585` has valid test records:
1. **For Sathi App**:
   * Companion profile is marked as **Approved / Verified**.
   * At least **1 upcoming visit** in the list.
   * At least **1 completed visit** in the history tab.
2. **For MaiHoonNa App**:
   * Subscriber account has at least **1 active Subscription Package**.
   * At least **1 registered Senior Beneficiary** with sample medical notes.
   * At least **1 emergency contact** configured.

*(Never submit an account that opens to a completely blank screen or throws a server error).*

---

## Phase 3: Visual Assets & Screenshot Guidelines

### 3.1 App Icon Audit
* Resolution: Exactly **1024 × 1024 pixels**.
* Format: PNG (72 DPI, RGB).
* ⚠️ **NO Alpha Channel / Transparency**: Apple rejects any icon with a transparent background. Check in Preview/Photoshop that the alpha channel is removed.

### 3.2 Screenshot Specifications
* **Required Display Size**: **6.7" Super Retina XDR** (1290 × 2796 pixels or 1284 × 2778 pixels).
* **Screens Required (Minimum 3 to 5)**:
  1. *Welcome & Verified OTP Login*
  2. *Main Home Dashboard*
  3. *Care Visit / Service Request Details*
  4. *Profile & Security Settings (Showing Data Privacy)*
* ⚠️ **Strict Quality Check (Apple Guideline 2.3.3)**:
  * Do **NOT** use screenshots taken from Android emulators with the bottom navigation bar (◀ ● ■).
  * Do **NOT** include any Google Play badges or Android battery/signal indicators.

### 3.3 The Reviewer Walkthrough Video (The #1 Secret to Fast Approval)
Record a 60–90 second screen video on your phone:
1. Open app -> Enter `8585858585` -> Enter `442233`.
2. Browse through home screen cards and tabs.
3. Show an active visit or service request.
4. Go to **Profile**, scroll down, and highlight the **Delete Account** button.
5. Upload to **YouTube as Unlisted** (or Google Drive set to "Anyone with link can view").

---

## Phase 4: App Store Connect Portal Configuration

### 4.1 General App Information
* **Primary Language**: English (US or UK).
* **Bundle ID**: Select `com.maihoonna.app` or `com.maihoonna.sathiapp`.
* **Primary Category**:
  * For MaiHoonNa: **Medical** or **Health & Fitness**.
  * For Sathi Network: **Lifestyle** or **Medical**.
* **Secondary Category**: Utilities or Social Networking.

### 4.2 Mandatory Live Web URLs
All URLs must be accessible via public HTTPS:
* **Privacy Policy URL**: `https://maihoonna.in/#privacy` (or `/privacy`)
* **Support URL**: `https://maihoonna.in/#terms` (Section 6 publishes direct support email & grievance contact)
* **Marketing URL**: `https://maihoonna.in/`

### 4.3 Mandatory Medical Disclaimer in App Description
Paste this exact disclaimer at the end of the App Description:
```text
Medical & Emergency Disclaimer:
MaiHoonNa (and Sathi Network) provides non-medical elder companionship, home assisted living coordination, and emergency notification routing. The platform does not provide medical diagnosis, treatment, or direct clinical prescriptions. In case of critical or acute medical emergencies, please immediately contact municipal emergency health services (such as 112/108) or visit the nearest emergency care facility.
```

### 4.4 App Privacy Questionnaire (Data Nutrition Label)
Select **"Yes, we collect data from this app"** and check:
* **Contact Info**: Name, Phone Number, Email Address (App Functionality).
* **Location**: Precise & Coarse Location (App Functionality).
* **Health & Fitness**: Medical conditions / care instructions (App Functionality).
* **Photos & Videos**: Prescriptions / Profile photos (App Functionality).
* **Identifiers**: User ID (App Functionality).
* ⚠️ **Tracking Question**: Select **"No, we do NOT use this data to track users across apps/websites owned by other companies."**

### 4.5 Age Rating Questionnaire
* Unrestricted Web Access: **No**.
* Gambling & Contests: **No**.
* Medical / Treatment Information: **Infrequent/Mild**.
* Profanity / Mature Content: **None**.
* Expected Age Rating: **4+** or **12+**.

---

## Phase 5: The Critical App Review Notes

Under **App Store Connect -> App Version -> App Review Information**:
* Check **"Sign-in required"** ✅
* **Username**: `8585858585`
* **Password**: `442233`

Paste the relevant review note below into the **Notes** box:

### 5.1 Review Note for Sathi Network (`com.maihoonna.sathiapp`)
```text
Dear Apple App Review Team,

Sathi Network is an on-ground care companion, nursing, and field assistant platform operating in India that coordinates in-person visits to senior citizens.

1. DEMO LOGIN CREDENTIALS:
- Phone Number: 8585858585
- Fixed OTP Code: 442233
(The SMS OTP gateway is bypassed for this reviewer number. Simply input the phone number and enter 442233 on the verification screen to instantly access the companion dashboard).

2. DEMO WALKTHROUGH VIDEO:
If you experience any location or regional network constraints during review, please view our end-to-end video demonstration:
[INSERT YOUR UNLISTED YOUTUBE OR DRIVE VIDEO LINK HERE]

3. PAYMENT METHOD COMPLIANCE (Guideline 3.1.5(a)):
Any payments or earnings processed within this platform (via Razorpay) are exclusively for real-world, in-person offline services (human companions and nurses physically visiting senior residences). In strict accordance with Apple Review Guideline 3.1.5(a) (Physical Goods & Services Outside the App), these services are consumed outside the digital app, and traditional payment processing is authorized rather than Apple In-App Purchase.

4. ACCOUNT DELETION COMPLIANCE (Guideline 5.1.1(v)):
Care companions can permanently delete their account and personal records directly inside the app:
Open Profile tab -> Scroll to the bottom -> Tap "Delete Account" -> Confirm deletion.

5. CONTACT:
For any review inquiries or questions, please reach us directly at info@maihoonna.com.
```

### 5.2 Review Note for MaiHoonNa User App (`com.maihoonna.app`)
```text
Dear Apple App Review Team,

MaiHoonNa is an elder care assisted-living platform operating in India connecting senior citizens and their families with verified human care companions and offline nursing assistance.

1. DEMO LOGIN CREDENTIALS:
- Phone Number: 8585858585
- Fixed OTP Code: 442233
(The SMS OTP gateway is bypassed for this reviewer number. Enter 8585858585 and type 442233 on the OTP screen to enter the subscriber dashboard).

2. DEMO WALKTHROUGH VIDEO:
A full operational video walkthrough of the app is available here:
[INSERT YOUR UNLISTED YOUTUBE OR DRIVE VIDEO LINK HERE]

3. PAYMENT EXEMPTION DISCLOSURE (Guideline 3.1.5(a) - Physical Services Outside App):
All care packages and subscription payments processed via Razorpay are strictly for real-world, in-person elder care services (physical home visits by care companions, offline hospital accompaniment, and licensed nurse visits). Under Apple App Store Review Guideline 3.1.5(a), these services are consumed in the real physical world outside the application, and therefore external payment methods are utilized rather than Apple In-App Purchase.

4. ACCOUNT DELETION COMPLIANCE (Guideline 5.1.1(v)):
Subscribers and beneficiaries can initiate self-serve account and data deletion inside the app:
Open Profile -> Tap Security Tab / Settings -> Tap "Delete Account" -> Confirm.

5. SOS EMERGENCY FEATURE DISCLOSURE:
The SOS Emergency button broadcasts real-time GPS coordinates directly to the user's pre-registered family members and designated local care network. It does not claim direct municipal dispatch integration.

6. CONTACT:
Should you require any additional information, please contact us at info@maihoonna.com.
```

---

## Phase 6: Build, TestFlight Smoke Test & Submission

### 6.1 Trigger Production Cloud Build via EAS
Run from the respective app directory in your terminal:
```bash
# For Sathi App
cd apps/sathi-app
eas build --platform ios --profile production

# For MaiHoonNa App
cd apps/mobile-app
eas build --platform ios --profile production
```

### 6.2 Submit Build to App Store Connect
```bash
eas submit --platform ios
```
*(Alternatively, download the `.ipa` artifact from your Expo dashboard and upload it via the **Apple Transporter** app on macOS or Transporter CLI).*

### 6.3 TestFlight Smoke Test Checklist
Install the build on a physical iPhone using TestFlight:
* [ ] Log in with `8585858585` and `442233` — verify dashboard loads immediately.
* [ ] Trigger photo/camera feature — verify custom rationale string appears in the prompt.
* [ ] Trigger location feature — verify location prompt displays custom rationale.
* [ ] Navigate to Profile -> Tap "Delete Account" — verify confirmation dialog appears.
* [ ] Confirm no crashes or infinite loading indicators.

### 6.4 Final Submission
1. In App Store Connect, go to **Apps** -> Select your app -> Select the current version.
2. Under the **Build** section, click `+` and attach **Build 2**.
3. Confirm all review notes, URLs, and screenshots are attached.
4. Click **Save** -> **Add for Review** -> **Submit to App Review**.

---

## Phase 7: Fast-Track Expedited Review Process

If your launch is time-sensitive, request an expedited review once the status displays **"Waiting for Review"**:

1. Open the **[Apple Expedited Review Request Form](https://developer.apple.com/contact/app-store/?topic=expedite)**.
2. Select your App Name and Platform (**iOS**).
3. Select Reason: **Time-Sensitive Event**.
4. Explanation Template:
   > *"MaiHoonNa provides critical healthcare accompaniment and real-world assisted living companion services to senior citizens in India. We have an on-ground care companion schedule launching with registered elderly beneficiaries this week who depend on this platform for home care visits and emergency assistance. We kindly request an expedited review to ensure uninterrupted service delivery."*
5. Submit the form. Apple typically reviews and acts on expedited requests within **4 to 12 hours**.
