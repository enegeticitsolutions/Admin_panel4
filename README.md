# 🏥 MaiHoonNa — Connected Senior Care Platform

[![Monorepo Architecture](https://img.shields.io/badge/Architecture-Monorepo-orange.svg)](https://github.com/Harshit00018/MHN)
[![Frontend](https://img.shields.io/badge/Frontend-React%2018%20%7C%20React%20Native%20%7C%20Expo%20%7C%20Vite-blue.svg)](https://react.dev/)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%7C%20Express%20%7C%20TypeScript-green.svg)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/Database-PostgreSQL%20%7C%20Prisma%207%20ORM-indigo.svg)](https://www.prisma.io/)
[![Security](https://img.shields.io/badge/Security-Hardened%20%7C%20RBAC%20%7C%20Rate--Limited-red.svg)](#6-security--governance-architecture)
[![Mobile Setup](https://img.shields.io/badge/Mobile-Android%20%7C%20iOS%20%7C%20Expo%20Go-success.svg)](#7-mobile-app-testing--development-guide)

Welcome to the official repository for **MaiHoonNa**, an enterprise-grade connected elder care ecosystem. MaiHoonNa powers senior care subscriptions, care companion visit dispatching, volunteer companion matching (Saathi network), emergency SOS radar tracking, immutable double-entry benefit utilization ledgers, and dynamic vitals monitoring.

---

## 📑 Table of Contents

1. [System Architecture & Monorepo Matrix](#1-system-architecture--monorepo-matrix)
2. [Core Applications Overview](#2-core-applications-overview)
3. [Shared Packages](#3-shared-packages)
4. [Data Flow & System Sequence Diagrams](#4-data-flow--system-sequence-diagrams)
5. [Database Schema & Models Reference](#5-database-schema--models-reference)
6. [Security & Governance Architecture](#6-security--governance-architecture)
7. [Mobile App Testing & Development Guide](#7-mobile-app-testing--development-guide)
8. [Environment Setup & Variable Matrix](#8-environment-setup--variable-matrix)
9. [Developer CLI Commands & Scripts](#9-developer-cli-commands--scripts)
10. [Troubleshooting & Frequently Asked Questions](#10-troubleshooting--frequently-asked-questions)

---

## 1. System Architecture & Monorepo Matrix

MaiHoonNa is structured as a unified monorepo containing 6 application services and 2 shared workspace packages connected to a central PostgreSQL database.

```
                                ┌─────────────────────────────┐
                                │     PostgreSQL Database     │
                                │  (packages/database/prisma) │
                                └──────────────┬──────────────┘
                                               │
                        ┌──────────────────────┴──────────────────────┐
                        │                                             │
                        ▼                                             ▼
           ┌──────────────────────────┐                  ┌──────────────────────────┐
           │   apps/admin-backend     │                  │         apps/api         │
           │   Port: 3001 (Express)   │                  │   Port: 8001 (Express)   │
           └────────────┬─────────────┘                  └─────────────┬────────────┘
                        │                                              │
                        ▼                        ┌─────────────────────┼─────────────────────┐
             ┌────────────────────┐              ▼                     ▼                     ▼
             │apps/admin-frontend │    ┌────────────────────┐┌────────────────────┐┌────────────────────┐
             │ Port: 5173 (React) │    │   apps/website     ││  apps/mobile-app   ││   apps/sathi-app   │
             └────────────────────┘    │ Port: 5174 (Vite)  ││ (Subscriber/Senior)││ (Volunteer/Saathi) │
                                       └────────────────────┘└────────────────────┘└────────────────────┘
```

### Application & Service Matrix

| Module | Type | Port | Main Technologies | Purpose / Target Audience | Key Entry Files |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`apps/admin-backend`** | REST API | `3001` | Express, Node.js, Prisma ORM | Operational backend for zone, staff, packages, payments, and emergency dispatches (Dedicated to Admin Frontend) | [`server.js`](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/apps/admin-backend/server.js), [`routes/`](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/apps/admin-backend/routes/) |
| **`apps/admin-frontend`** | Web SPA | `5173` | React 18, Vite, TypeScript, TailwindCSS | Control tower for operations managers, field managers, and admins | [`src/main.tsx`](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/apps/admin-frontend/src/main.tsx), [`src/app/pages/`](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/apps/admin-frontend/src/app/pages/) |
| **`apps/api`** | REST API | `8001` | Express, TypeScript, Prisma ORM | Client API servicing subscribers, website, senior beneficiaries, and mobile client apps | [`app/main.ts`](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/apps/api/app/main.ts), [`app/api/`](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/apps/api/app/api/) |
| **`apps/mobile-app`** | Native App | Expo | React Native, Expo Go, TypeScript | Mobile app for Subscribers (Purchasers) & Beneficiaries (Seniors) | [`app/(beneficiary)/`](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/apps/mobile-app/app/(beneficiary)/), [`app.json`](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/apps/mobile-app/app.json) |
| **`apps/sathi-app`** | Native App | Expo | React Native, Expo Go, TypeScript | Mobile app for verified Saathi companions & community volunteers | [`app/(sathi)/`](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/apps/sathi-app/app/(sathi)/), [`app.json`](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/apps/sathi-app/app.json) |
| **`apps/website`** | Web SPA | `5174` | React 18, Vite, JavaScript | Public marketing portal, plan showcase, interactive comparison & web checkout (Connects to `apps/api`) | [`src/main.jsx`](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/apps/website/src/main.jsx), [`src/pages/`](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/apps/website/src/pages/) |
| **`packages/database`** | Library | N/A | Prisma 7, PostgreSQL | Central schema definitions, seed files, and DB migration scripts | [`prisma/schema.prisma`](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/packages/database/prisma/schema.prisma) |
| **`packages/notifications`** | Engine | N/A | Node.js, Webhooks, Push SDKs | Multi-channel dispatch engine (Push Notifications, SMS, WhatsApp alerts) | [`src/`](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/packages/notifications/src/) |

---

## 2. Core Applications Overview

### 📱 1. Senior & Subscriber Mobile App (`apps/mobile-app`)
- **Dual Mode Experience**: Supports both **Subscriber mode** (family members managing elder care plans, tracking billing, and viewing logs) and **Beneficiary mode** (seniors viewing visit schedules, logging daily vitals, and triggering emergency SOS alerts).
- **Dynamic Vitals Dashboard**: Logs blood pressure, heart rate, spO2, temperature, and weight with alert thresholds.
- **Medication Reminders**: Interactive medicine cabinet featuring frequency chips, customizable time slots (morning/afternoon/evening), and notification toggles.
- **Saathi Companion Requesting**: Seniors can request volunteer companionship visits, view volunteer profiles, track live visit timers, and leave 1-to-5-star reviews upon completion.

### 🤝 2. Saathi Volunteer Mobile App (`apps/sathi-app`)
- **Volunteer Onboarding & Verification**: Document upload workflow (Aadhaar, background checks) evaluated by admin staff.
- **Visit Request Dashboard**: Auto-polls nearby visit requests submitted by eligible seniors (`useFocusEffect` silent 1s polling).
- **Live Visit Timer**: Real-time ticking timer for ongoing companion visits with automatic duration tracking.
- **Credit & Reward Points**: Volunteers earn credit points per verified visit reflected in their personal credit transactions ledger.

### 🌐 3. Public Marketing & Plan Portal (`apps/website`)
- **Card Carousel & Plans Showcase**: Auto-play right-to-left plan carousel featuring billing duration selectors (1, 3, 6, 12 months with dynamic discounts).
- **100% Dynamic Side-by-Side Comparison Table**: Pulls top packages (`isCompared: true`) and compares them against the global Benefits Library directly from PostgreSQL.
- **Native Web Checkout**: Integrated Razorpay modal checkout supporting coupon validation and automatic role upgrade from `prospect` to `subscriber`. Connects to `apps/api` (Port 8001).

### 🖥️ 4. Operational Admin Dashboard (`apps/admin-frontend`)
- **Product Factory 2.0**: Formulates subscription packages, sets base pricing, auto-calculates MRP, configures duration discount rules, and assigns unit benefits.
- **Emergency Radar Control Tower**: Interactive map radar (`EmergencyRadarPage.tsx`) using Google Maps coordinates to calculate senior-to-staff distances and dispatch immediate care.
- **Service Request Hub (`RequestedVisitsPage.tsx`)**: Quick-schedule modal with date-range filters (`Past 7 Days`, `Past 30 Days`, `This Month`, `Custom Range`).
- **Pincode & Staff Allocation**: Assigns Operations Managers and Field Managers to designated geographic zones based on 6-digit postal pincodes.

### ⚙️ 5. Express Operational Backend (`apps/admin-backend`)
- **Dedicated Admin Control Tower Backend**: Exclusively powers `apps/admin-frontend` for operations managers, field managers, and master admins.
- **Modular Payment Architecture**: Decoupled modules (`razorpay.service.js`, `webhook.service.js`, `payment.repository.js`, `subscription.service.js`) supporting link generation (`https://rzp.io/i/...`) and HMAC-SHA256 webhooks.
- **Atomic Transactions**: Database operations execute inside `prisma.$transaction()` to guarantee idempotency and audit log consistency.
- **Pincode Lookup Service**: Proxies requests to `api.postalpincode.in` to auto-resolve city, state, and area defaults.

### 🔌 6. Primary API Backend (`apps/api`)
- **Client & Mobile API Services**: Serves all end-user client applications: **`apps/website`**, **`apps/mobile-app`**, and **`apps/sathi-app`**.
- **Subscriber & Mobile Services**: Handles authentication, profile setup, vitals logging, beneficiary management, package browsing, and web/in-app checkout.
- **Security Hardening**: Enforces `JWT_SECRET` presence in production, rate limiters, strict CORS policies, and ownership check middleware.

---

## 3. Shared Packages

### 🗄️ Database Package (`packages/database`)
Centralized database definitions shared across all backends.
- **Prisma Schema**: Single source of truth located at [`packages/database/prisma/schema.prisma`](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/packages/database/prisma/schema.prisma).
- **Seeding Script**: Executable seeder ([`seed.js`](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/packages/database/prisma/seed.js)) populating benefit types, system benefits, default packages, pincode zones, and initial test accounts.

### 🔔 Notification Engine (`packages/notifications`)
Unified dispatch module for platform events.
- **Channels**: Expo Push Notifications, SMS Gateways, and WhatsApp Webhooks.
- **Triggers**: Emergency SOS alerts, visit schedule updates, medication reminders, and low benefit balance warnings.

---

## 4. Data Flow & System Sequence Diagrams

### 🛍️ A. Admin Product Factory ➔ Website ➔ Checkout Flow

```mermaid
sequenceDiagram
    autonumber
    actor Admin
    participant AdminApp as Admin Frontend (5173)
    participant AdminAPI as Admin Backend (3001)
    participant DB as PostgreSQL Database
    participant WebApp as Website Portal (5174)
    participant API as Primary API Backend (8001)
    participant RZP as Razorpay Payment Gateway

    Admin->>AdminApp: Create Package in Product Factory
    AdminApp->>AdminAPI: POST /api/packages (basePrice, MRP, packageBenefits)
    AdminAPI->>DB: Save Package & PackageBenefit relations
    WebApp->>API: GET /api/subscriber/subscriptions/packages
    API->>DB: Fetch active packages & benefits
    DB-->>API: Return package data
    API-->>WebApp: Return dynamic packages & benefits
    WebApp->>WebApp: Render Plan Carousel & Comparison Table
    actor Customer
    Customer->>WebApp: Select Package & Click Purchase
    WebApp->>API: POST /api/subscriber/subscriptions/create-order
    API->>RZP: Create Razorpay Order
    RZP-->>API: Return order_id & amount
    API-->>WebApp: Return Razorpay order details
    WebApp->>RZP: Open Razorpay Checkout Modal
    RZP-->>WebApp: Payment Success (razorpay_payment_id, signature)
    WebApp->>API: POST /api/subscriber/subscriptions/purchase
    API->>DB: Execute prisma.$transaction() (Activate Subscription, Upgrade Role to subscriber)
```

---

### 💳 B. Double-Entry Benefit Utilization Ledger State Machine

```mermaid
stateDiagram-v2
    [*] --> ALLOCATED: Package Purchased / Subscription Activated
    ALLOCATED --> RESERVED: Visit Scheduled / SOS Triggered (Hold Created)
    RESERVED --> CONSUMED: Visit Verified & Completed / SOS Resolved
    RESERVED --> RELEASED: Visit Cancelled / SOS Cancelled (Units Restored)
    CONSUMED --> [*]: Units Deducted from Available Balance
    RELEASED --> ALLOCATED: Available Balance Intact
```

---

### 🤝 C. Sathi Volunteer Match & Review Loop

```mermaid
sequenceDiagram
    autonumber
    actor Senior
    participant MobileApp as Mobile App (Expo)
    participant API as Primary API Backend (8001)
    participant DB as PostgreSQL Database
    actor Volunteer
    participant SathiApp as Sathi App (Expo)

    Senior->>MobileApp: Request Saathi Companion Visit
    MobileApp->>API: POST /api/v1/beneficiary/sathi-requests
    API->>DB: Check Beneficiary Package for SATHI_COMPANION benefit type
    DB-->>API: Package Validated (hasSathiBenefit = true)
    API->>DB: Create SathiVisitRequest record
    SathiApp->>API: Silent 1s Polling (GET /sathi-requests)
    Volunteer->>SathiApp: Accept Visit Request
    SathiApp->>API: Update Status -> ACCEPTED
    Volunteer->>SathiApp: Complete Visit & Checkout
    Senior->>MobileApp: Rate Visit (1-5 Stars) & Write Feedback
    MobileApp->>API: POST /sathi-requests/:id/review
    API->>DB: Save VolunteerReview & recalculate Volunteer Avg Rating
```

---

## 5. Database Schema & Models Reference

The database consists of **25+ relational models** defined in [`packages/database/prisma/schema.prisma`](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/packages/database/prisma/schema.prisma):

```
                       ┌───────────────────────┐
                       │         User          │
                       │ (role, phone, email)  │
                       └───────────┬───────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              │ 1:N                                     │ 1:N
              ▼                                         ▼
   ┌────────────────────┐                    ┌────────────────────┐
   │     Subscriber     │                    │    Beneficiary     │
   │ (subscribers table)│                    │(beneficiaries tbl) │
   └──────────┬─────────┘                    └──────────┬─────────┘
              │ 1:N                                     │ 1:N
              ▼                                         ▼
   ┌────────────────────┐                    ┌────────────────────┐
   │    Subscription    │──────── 1:N ──────>│SubscriptionBenefit │
   │(isActive, endDate) │                    │      Balance       │
   └──────────┬─────────┘                    └──────────┬─────────┘
              │ N:1                                     │ 1:N
              ▼                                         ▼
   ┌────────────────────┐                    ┌────────────────────┐
   │SubscriptionPackage │                    │ BenefitTransaction │
   │ (basePrice, MRP)   │                    │ (Double-Entry Log) │
   └──────────┬─────────┘                    └────────────────────┘
              │ 1:N
              ▼
   ┌────────────────────┐                    ┌────────────────────┐
   │   PackageBenefit   │──────── N:1 ──────>│      Benefit       │
   │  (unitsIncluded)   │                    │(benefitType, cost) │
   └────────────────────┘                    └──────────┬─────────┘
                                                        │ N:1
                                                        ▼
                                             ┌────────────────────┐
                                             │    BenefitType     │
                                             │  (code, isSystem)  │
                                             └────────────────────┘
```

### Primary Database Models

- **`User`**: Account identity supporting roles (`master_admin`, `admin`, `operations_manager`, `field_manager`, `care_companion`, `subscriber`, `beneficiary`, `volunteer`, `prospect`).
- **`Subscriber`**: Billing customer profile linked to payment records and subscriptions.
- **`Beneficiary`**: Senior receiving care services, linked to emergency contacts, medical conditions, medications, hobbies, and care companions.
- **`SubscriptionPackage`**: Product packages defined in Product Factory (includes `mrp`, `basePrice`, `discountPercentage`, `isCompared`, `isGlobal`).
- **`BenefitType`**: System benefit categories (e.g. `SATHI_COMPANION`, `NURSE_VISIT`, `TELE_CONSULT`). System types are protected (`isSystem: true`).
- **`Benefit`**: Library items with unit costs and labels.
- **`PackageBenefit`**: Junction table binding benefits and monthly quota units to packages.
- **`Subscription`**: Active subscriber package instance with start/end dates.
- **`SubscriptionBenefitBalance`**: Ledger tracking `totalUnits`, `usedUnits`, `reservedUnits`, and `availableUnits`.
- **`BenefitReservation`**: Active unit holds for scheduled visits or emergency SOS alerts (`HELD`, `CONSUMED`, `RELEASED`).
- **`BenefitTransaction`**: Immutable double-entry audit trail recording snapshots (`totalBefore`, `totalAfter`, `reservedBefore`, `reservedAfter`, `usedBefore`, `usedAfter`).
- **`Volunteer`**: Saathi companion volunteer profile with verification status (`SUBMITTED`, `UNDER_REVIEW`, `APPROVED`).
- **`VolunteerReview`**: Star ratings (1-5) and text reviews left by seniors for volunteers.
- **`Zone`**: Geographic coverage bounds linked to Operations Managers, Field Managers, and pincodes.

---

## 6. Security & Governance Architecture

The platform incorporates comprehensive security controls:

### 🛡️ 1. Environment-Isolated Backdoors
All internal dev tools and mock signatures (e.g., `DEV_MOCK_SIGNATURE`, dev reset routes) are guarded by `config.nodeEnv === 'development'`. In production, any attempt to pass mock headers returns an immediate HTTP `403 Forbidden`.

### 💰 2. Server-Side Price Verification
When purchasing subscriptions (`POST /subscriber/subscriptions/purchase`), the backend recalculates total pricing server-side using package rates and valid coupon rules (`calculatePricing`). Payment verification bypass is strictly restricted to valid 100% off coupons (`pricing.total === 0`).

### 🔑 3. Mandatory Secret Enforcement
`apps/api/app/core/config.ts` validates critical secrets on startup. If `JWT_SECRET` is missing in production mode, the API process halts immediately with a fatal error.

### 🚦 4. Rate Limiting
Strict IP and endpoint rate limiters prevent brute-force attacks:
- `otpLimiter`: Max 5 requests per window on OTP generation.
- `loginLimiter`: Max 10 requests per window on authentication.
- `callbackLimiter`: Protected rate limits on public callback routes.

### 🌐 5. CORS Hardening
CORS policies in `apps/api/app/main.ts` validate origins:
- Permits requests with **no origin header** (required for native iOS/Android apps).
- Validates web browser origin headers against trusted domain allowlists.

---

## 7. Mobile App Testing & Development Guide

> 📖 **Full Local Setup & Run Guide:** See [docs/devops/LOCAL_SETUP_AND_RUN_GUIDE.md](file:///c:/Users/harsh/OneDrive/Desktop/MHN/docs/devops/LOCAL_SETUP_AND_RUN_GUIDE.md) for complete all-in-one instructions.

Follow this guide to run **`apps/mobile-app`** or **`apps/sathi-app`** on the Android Emulator or physical device.

### 📱 Android Virtual Device / Emulator (Pixel 10)

1. **Launch the Pixel 10 Emulator** (Automatically boots & reverses ports):
   ```bash
   npm run emulator:pixel
   ```
2. **Start the Metro Bundler** (Auto-connects ports in background):
   ```bash
   npm run dev:mobile
   ```
3. **Run directly on Pixel 10** (or tap the app icon on the emulator):
   ```bash
   npm run android:pixel
   ```

---

### 🤖 Android Setup via USB (Physical Device)

Using USB debugging bypasses local Wi-Fi router AP isolation, ISP blockades, and Windows Firewall issues.

#### Step 1 — Add ADB to Windows PATH
1. Open PowerShell and run:
   ```powershell
   [System.Environment]::SetEnvironmentVariable("Path", $env:Path + ";$env:LOCALAPPDATA\Android\Sdk\platform-tools", "User")
   ```
2. Restart your terminal and verify:
   ```bash
   adb version
   ```

#### Step 2 — Enable USB Debugging on Phone
1. Go to **Settings ➔ About Phone** on your Android device.
2. Tap **Build Number** 7 times to enable Developer Options.
3. Go to **Settings ➔ Developer Options** and enable **USB Debugging**.

#### Step 3 — Configure `.env`
In `apps/mobile-app/.env`:
```env
EXPO_PUBLIC_ENV=local
EXPO_PUBLIC_PRODUCTION_API_URL=https://api.maihoonna.com/app-api/
EXPO_PUBLIC_LOCAL_IP=localhost
EXPO_PUBLIC_API_PORT=8001
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

#### Step 4 — Connect Phone & Port Forward
Plug in your phone via USB (select **File Transfer / USB Debugging**), then run:
```bash
adb devices
adb reverse tcp:8081 tcp:8081
adb reverse tcp:8001 tcp:8001
```

#### Step 5 — Start Backend & Expo
```bash
# Terminal 1: Start API Backend
cd apps/api
npm run dev

# Terminal 2: Start Expo Bundler in Localhost Mode
cd apps/mobile-app
npx expo start --localhost --go
```
Open **Expo Go** on your Android device and scan the QR code displayed in your terminal.

---

### 🍏 iOS Setup via Local Network (Wi-Fi / Hotspot)

iOS does not support `adb reverse`. Connect both your PC and iPhone to the same Wi-Fi network (or turn on **Personal Hotspot** on your iPhone and connect your PC to it).

#### Step 1 — Find your PC's Local IP
Run `ipconfig` in PowerShell and copy your IPv4 Address (e.g. `192.168.1.15`).

#### Step 2 — Update `.env`
In `apps/mobile-app/.env`:
```env
EXPO_PUBLIC_LOCAL_IP=192.168.1.15  # Replace with your PC's IP
```

#### Step 3 — Open Firewall Ports on PC
Run PowerShell as **Administrator**:
```powershell
New-NetFirewallRule -DisplayName "Allow Expo Metro 8081" -Direction Inbound -LocalPort 8081 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Allow API 8001" -Direction Inbound -LocalPort 8001 -Protocol TCP -Action Allow
```

#### Step 4 — Launch Expo
```bash
cd apps/mobile-app
npx expo start --go
```
Scan the QR code using your iPhone's **Camera App** to launch in Expo Go.

---

## 8. Environment Setup & Variable Matrix

Create `.env` files in the respective app directories:

### `packages/database/.env` & `apps/admin-backend/.env`
```env
PORT=3001
DATABASE_URL="postgresql://postgres:password@localhost:5432/maihoonna?schema=public"
JWT_SECRET="super_secret_jwt_key_maihoonna_2026"
NODE_ENV="development"
RAZORPAY_KEY_ID="rzp_test_XXXXXXXXXXXXXX"
RAZORPAY_KEY_SECRET="XXXXXXXXXXXXXXXXXXXXXXXX"
RAZORPAY_WEBHOOK_SECRET="whsec_XXXXXXXXXXXXXXXX"
SUPABASE_URL="https://xyz.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="ey..."
STORAGE_PROVIDER="supabase"
STORAGE_BUCKET="staff-documents"
```

### `apps/api/.env`
```env
PORT=8001
DATABASE_URL="postgresql://postgres:password@localhost:5432/maihoonna?schema=public"
JWT_SECRET="super_secret_jwt_key_maihoonna_2026"
NODE_ENV="development"
```

### `apps/mobile-app/.env` & `apps/sathi-app/.env`
```env
EXPO_PUBLIC_ENV=local
EXPO_PUBLIC_PRODUCTION_API_URL=https://api.maihoonna.com/app-api/
EXPO_PUBLIC_LOCAL_IP=localhost
EXPO_PUBLIC_API_PORT=8001
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...
```

---

## 9. Developer CLI Commands & Scripts

Run these commands from the repository root:

```bash
# ------------------------------------------------------------------
# Installation & Setup
# ------------------------------------------------------------------
npm install                                 # Install all root dependencies

# ------------------------------------------------------------------
# Database & Prisma Commands (packages/database)
# ------------------------------------------------------------------
npx prisma db push --schema=packages/database/prisma/schema.prisma    # Push schema changes to PostgreSQL
npx prisma generate --schema=packages/database/prisma/schema.prisma   # Generate Prisma Client
node packages/database/prisma/seed.js                                # Seed database test data

# ------------------------------------------------------------------
# Running Applications Concurrently / Individually
# ------------------------------------------------------------------
# Run from repository root:
npm run dev:api                             # Primary Client API (Port 8001)
npm run dev:admin                           # Admin Backend API (Port 3001)
npm run dev:admin-ui                        # Admin Frontend Dashboard (Port 5173)
cd apps/website && npm run dev              # Marketing Website Portal (Port 5174)
npm run worker                              # Notification Worker Engine

# Mobile App & Pixel 10 Emulator:
npm run emulator:pixel                      # Launch Pixel 10 Android Emulator
npm run dev:mobile                          # Start Metro Bundler (Port 8081)
npm run android:pixel                       # Build & Run on Pixel 10 Emulator
```

---

## 10. Troubleshooting & Frequently Asked Questions

### ❓ Q1: Why does `adb reverse` say "device not found"?
**Solution:** Ensure USB Debugging is turned on in Developer Options on your phone. Check that your cable supports data transfer (not charge-only). Run `adb devices` to confirm connection.

### ❓ Q2: Why does the Admin Backend fail with `EADDRINUSE: port 3001`?
**Solution:** A background Node process is holding port 3001. Stop hanging processes using PowerShell:
```powershell
Get-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess | Stop-Process -Force
```

### ❓ Q3: Why does Prisma give "Unknown argument" errors?
**Solution:** The Prisma Client generator needs to be re-run after schema modifications:
```bash
npx prisma generate --schema=packages/database/prisma/schema.prisma
```

### ❓ Q4: Why are seniors missing from the "Assign Senior to Volunteer" modal?
**Solution:** The volunteer modal filters beneficiaries strictly by active packages containing Sathi Companion benefits (`SATHI_COMPANION` code). Ensure the target senior is assigned an active subscription with a Sathi benefit.

---

## 📄 License & Intellectual Property

Copyright © 2026 **MaiHoonNa Eldercare Private Limited**.  
All rights reserved. Unauthorized copying, distribution, or modification of this codebase is strictly prohibited.
