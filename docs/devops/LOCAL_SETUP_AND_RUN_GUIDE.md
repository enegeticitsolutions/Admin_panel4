# 🚀 MaiHoonNa — Complete Local Development & Emulator Guide

> **All-in-one reference** for running all backend services, web applications, and mobile apps (including the **Pixel 10 Android Emulator**) on your machine.

---

## ⚡ Quick Start Cheat Sheet

Open your terminal at the project root (`c:\Users\harsh\OneDrive\Desktop\MHN`):

| What you want to do | Command (Root Directory) | Notes |
| :--- | :--- | :--- |
| **Launch Pixel 10 Emulator** | `npm run emulator:pixel` | Starts your Pixel 10 AVD directly without Android Studio GUI |
| **Start Mobile Metro Bundler** | `npm run dev:mobile` | Launches Expo Metro Bundler for `apps/mobile-app` (Port 8081) |
| **Build & Run on Pixel 10** | `npm run android:pixel` | Compiles & launches app directly targeting the Pixel 10 emulator |
| **Run Client API (Port 8001)** | `npm run dev:api` | Backend servicing subscribers, mobile apps & marketing site |
| **Run Admin Backend (Port 3001)** | `npm run dev:admin` | Backend servicing the Admin Control Tower |
| **Run Admin Frontend (Port 5173)** | `npm run dev:admin-ui` | React Admin Dashboard |
| **Run Marketing Website (Port 5174)** | `cd apps/website && npm run dev` | Public Marketing Portal & Plans showcase |
| **Run Notification Worker** | `npm run worker` | Background multi-channel dispatch engine |

---

## 🌐 Applications, Services & Port Matrix

| Service | Directory | Port | URL | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Client API** | `apps/api` | `8001` | `http://localhost:8001` | Core REST API for subscribers & mobile apps |
| **Admin Backend** | `apps/admin-backend` | `3001` | `http://localhost:3001` | Admin operational API |
| **Admin Frontend** | `apps/admin-frontend` | `5173` | `http://localhost:5173` | Ops & Admin web portal |
| **Marketing Website** | `apps/website` | `5174` | `http://localhost:5174` | Public landing page & plan checkout |
| **Family Connect Mobile** | `apps/mobile-app` | `8081` | `http://localhost:8081` | Senior & Subscriber mobile app |
| **Saathi Volunteer Mobile** | `apps/sathi-app` | `8082` | `http://localhost:8082` | Volunteer Companion mobile app |

---

## 📱 Running Mobile App on Android Emulator (Pixel 10)

### Prerequisite Environment Paths
These are already configured on your machine:
- **`JAVA_HOME`**: `C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot\` (OpenJDK 17)
- **`ANDROID_HOME`**: `C:\Users\harsh\AppData\Local\Android\Sdk`
- **`PATH`**: Contains `%ANDROID_HOME%\platform-tools` (`adb`) and `%ANDROID_HOME%\emulator` (`emulator`).

---

### Step-by-Step Workflow for Mobile App

#### Step 1 — Start the Pixel 10 Emulator
Run from your terminal:
```bash
npm run emulator:pixel
```
*(Or launch it from **Android Studio ➔ Device Manager** by pressing the Play button on **Pixel 10**).*

#### Step 2 — Port Forwarding (100% Automated!)
> ⚡ **You do NOT need to type any adb reverse commands manually!**
> The project scripts (`npm run dev:mobile`, `npm run emulator:pixel`, and `npm run android:pixel`) now automatically detect the emulator and connect ports `8081` and `8001` for you in the background.

#### Step 3 — Start the Metro Bundler
In a separate terminal tab:
```bash
npm run dev:mobile
```

#### Step 4 — Run the App on Pixel 10
In a new terminal:
```bash
npm run android:pixel
```
This builds and streams the native APK directly to `Pixel_10` and connects it to your running Metro bundler.

> **Tip:** When the Expo Dev Menu appears with *"Family Connect (Beta) - Runtime version: exposdk:54.0.0"*, simply press **Continue** or press the **Back** button on the emulator to load the active app interface!

---

## 🛠️ Native Android Build Settings & Fixes

### 1. SDK Path Configuration (`local.properties`)
Both `apps/mobile-app/android/local.properties` and `apps/sathi-app/android/local.properties` contain:
```properties
sdk.dir=C\:\\Users\\harsh\\AppData\\Local\\Android\\Sdk
```

### 2. OneDrive & Antivirus File-Locking Fix (`gradle.properties`)
Because the project resides inside OneDrive (`c:\Users\harsh\OneDrive\Desktop\MHN`), Gradle's background file-system watcher can collide with OneDrive file sync.

This is fixed in `apps/mobile-app/android/gradle.properties`:
```properties
org.gradle.vfs.watch=false
```
*(Prevents `Unable to delete directory ... packageDebugResources` locking errors).*

---

## 💻 Running the Web Applications & Backends

### 1. Client API Backend (Port 8001)
```bash
npm run dev:api
```
- Health Check: `http://localhost:8001/health`
- Mobile API endpoint: `http://localhost:8001/app-api/`

### 2. Admin Backend API (Port 3001)
```bash
npm run dev:admin
```
- Endpoint: `http://localhost:3001`

### 3. Admin Frontend (Port 5173)
```bash
npm run dev:admin-ui
```
- Open browser at `http://localhost:5173`

### 4. Marketing Website (Port 5174)
```bash
cd apps/website
npm run dev
```
- Open browser at `http://localhost:5174`

---

## 🔧 Useful ADB & Emulator Commands

| Action | Command |
| :--- | :--- |
| **List Connected Devices** | `adb devices` |
| **List Installed AVDs** | `emulator -list-avds` |
| **Take Screenshot of Emulator** | `adb -s emulator-5554 exec-out screencap -p > screen.png` |
| **Open Expo Dev Menu** | `adb -s emulator-5554 shell input keyevent 82` |
| **Press Back Button** | `adb -s emulator-5554 shell input keyevent 4` |
| **Reload JavaScript Bundle** | Press `r` inside the Metro terminal window |

---

## 🚨 Troubleshooting & FAQ

#### Q: The app displays "Invalid URL host: 'null'" or a blank input on startup.
- **Cause:** The Dev Client input was empty or waiting for host input.
- **Fix:** Type `http://localhost:8081` (or `http://10.0.2.2:8081`) and press Connect, or ensure `adb reverse tcp:8081 tcp:8081` has been executed.

#### Q: Gradle fails with `Unable to delete directory ... build\intermediates\...`
- **Cause:** OneDrive or Windows Defender locked the build directory.
- **Fix:** Ensure `org.gradle.vfs.watch=false` is set in `apps/mobile-app/android/gradle.properties` (already configured). You can also run `cd apps/mobile-app/android && .\gradlew.bat --stop` to terminate lingering Gradle daemon locks.

#### Q: Pixel 10 says "offline" or does not appear in `adb devices`.
- Run:
  ```bash
  adb kill-server
  adb start-server
  adb devices
  ```
