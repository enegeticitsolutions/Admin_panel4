# Legacy Circle Feature — Complete Implementation Documentation

This document provides a comprehensive record of all changes implemented across the database schema, core backend API, admin backend, admin frontend, and mobile application for the **Legacy Circle** feature.

---

## 1. Executive Summary

The **Legacy Circle** is a community initiative for senior beneficiaries to share their professional expertise, mentor others, and have their bios published on the organization's public platform. 

### Key Flow:
1. **Beneficiary Submission (Mobile)**: Beneficiaries submit their professional details (headline, years of experience, industry, contact email, and agree to Terms & Conditions).
2. **Review & Approval (Admin Panel)**: Administrators review incoming requests under a dedicated "Legacy Circle Approval" tab and approve profiles.
3. **Real-time Synchronization**: Approving a profile updates its status in PostgreSQL, emits real-time/notification events, and immediately unlocks the "Approved" live view on the mobile app upon screen focus.
4. **Public Profile & Engagement (Mobile)**: Approved beneficiaries see their live profile card with a branded hero banner (city network motif), statistics (connect requests, profile strength), and WhatsApp profile sharing.

---

## 2. Database Schema Changes

### File: [`packages/database/prisma/schema.prisma`](file:///Users/puneet/Desktop/MHN/packages/database/prisma/schema.prisma)

#### Model Definition
Added the `LegacyCircleProfile` model and connected it to the existing `Beneficiary` model:

```prisma
model Beneficiary {
  // ... existing fields ...
  legacyCircleProfile  LegacyCircleProfile?
}

model LegacyCircleProfile {
  id                String      @id @default(uuid())
  beneficiaryId     String      @unique
  title             String
  yearsOfExperience String
  headline          String      @db.VarChar(500)
  industry          String
  email             String
  agreedToTerms     Boolean     @default(false)
  status            String      @default("pending") // "pending", "approved", "rejected"
  connectRequests   Int         @default(0)
  profileStrength   Int         @default(100)
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt

  beneficiary       Beneficiary @relation(fields: [beneficiaryId], references: [id], onDelete: Cascade)

  @@map("legacy_circle_profiles")
}
```

#### Key Schema Decisions:
- **`@unique` on `beneficiaryId`**: Restricts each beneficiary to one active Legacy Circle profile.
- **Cascade Delete**: Deleting a beneficiary automatically cleans up their legacy profile.
- **Status field**: Defaults to `"pending"` until administrative review approves it to `"approved"`.

---

## 3. Core Backend API (`apps/api`)

### Route File: [`apps/api/app/api/beneficiary/legacy-circle.routes.ts`](file:///Users/puneet/Desktop/MHN/apps/api/app/api/beneficiary/legacy-circle.routes.ts)
### Route Registration: [`apps/api/app/main.ts`](file:///Users/puneet/Desktop/MHN/apps/api/app/main.ts)

#### Endpoints Implemented:

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/beneficiary/legacy-circle/profile` | Fetches the legacy profile of the authenticated beneficiary | Yes (JWT) |
| `POST` | `/api/beneficiary/legacy-circle/profile` | Creates or updates the beneficiary's legacy profile (submits for review) | Yes (JWT) |
| `GET` | `/api/beneficiary/legacy-circle/industries` | Returns the curated list of standardized industry categories | Yes (JWT) |

#### Server Registration in `apps/api/app/main.ts`:
```typescript
import legacyCircleRoutes from './api/beneficiary/legacy-circle.routes';
// ...
app.use('/api/beneficiary/legacy-circle', legacyCircleRoutes);
```

---

## 4. Admin Backend (`apps/admin-backend`)

### Route File: [`apps/admin-backend/routes/legacy-circle.js`](file:///Users/puneet/Desktop/MHN/apps/admin-backend/routes/legacy-circle.js)
### Server Mount: [`apps/admin-backend/server.js`](file:///Users/puneet/Desktop/MHN/apps/admin-backend/server.js)

#### Endpoints Implemented:

| Method | Endpoint | Query / Params | Description |
|---|---|---|---|
| `GET` | `/api/legacy-circle` | `?status=pending` or `?status=approved` | Lists requests ordered by `createdAt DESC`, joining `beneficiary` details (name, phone, city, photo, subscriber info) |
| `PATCH` | `/api/legacy-circle/:id/approve` | `id` = LegacyCircleProfile ID | Approves the profile, sets `status = "approved"`, and triggers notification dispatch |

#### Security & Middleware:
Mounted under `adminsOnly` middleware in [`apps/admin-backend/server.js`](file:///Users/puneet/Desktop/MHN/apps/admin-backend/server.js):
```javascript
app.use('/api/legacy-circle', adminsOnly, require('./routes/legacy-circle'));
```

#### Idempotency & Notifications:
- Safe to invoke repeatedly; if already approved, returns existing profile without duplicate notifications.
- Automatically dispatches WhatsApp and Push notifications upon approval via the notification service.

---

## 5. Admin Frontend (`apps/admin-frontend`)

### 5.1 API Client: [`apps/admin-frontend/src/services/api.ts`](file:///Users/puneet/Desktop/MHN/apps/admin-frontend/src/services/api.ts)
Added `legacyCircleApi` and interface `LegacyCircleRequest`:
```typescript
export interface LegacyCircleRequest {
  id: string;
  beneficiaryId: string;
  title: string;
  yearsOfExperience: string;
  headline: string;
  industry: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  connectRequests: number;
  profileStrength: number;
  createdAt: string;
  updatedAt: string;
  beneficiary?: {
    id: string;
    name: string;
    phone: string;
    city?: string;
    photo?: string;
    subscriber?: {
      id: string;
      name: string;
      phone: string;
    };
  };
}

export const legacyCircleApi = {
  getRequests: (status?: 'pending' | 'approved') =>
    apiClient.get<LegacyCircleRequest[]>('/legacy-circle', { params: { status } }),
  approveRequest: (id: string) =>
    apiClient.patch<LegacyCircleRequest>(`/legacy-circle/${id}/approve`),
};
```

### 5.2 Page Component: [`apps/admin-frontend/src/app/pages/LegacyCirclePage.tsx`](file:///Users/puneet/Desktop/MHN/apps/admin-frontend/src/app/pages/LegacyCirclePage.tsx)
Built a feature-complete dashboard with:
- **Two Sub-Tabs**: **"Requests"** (Pending) and **"Approved"**.
- **Search & Filter**: Real-time filtering by applicant name, phone number, headline, or industry.
- **Detailed Card View**: Shows photo/initials, full name, phone number, subscriber info, location, industry tag, years of experience, and bio/headline.
- **Approval Modal & Feedback**: Confirmation dialog with loading states, success toast, and automatic tab-counter refresh.
- **Empty States & Skeletons**: Polished states when no pending requests or approved members exist.

### 5.3 Route & Navigation:
- **Route**: Added `/legacy-circle` in [`apps/admin-frontend/src/app/routes.tsx`](file:///Users/puneet/Desktop/MHN/apps/admin-frontend/src/app/routes.tsx).
- **Sidebar**: Inserted **Legacy Circle Approval** with `Crown` icon under the **OPERATIONS** section directly below **"Saathi Onboarding"** in [`apps/admin-frontend/src/app/components/layout/DashboardLayout.tsx`](file:///Users/puneet/Desktop/MHN/apps/admin-frontend/src/app/components/layout/DashboardLayout.tsx).

---

## 6. Mobile Application (`apps/mobile-app`)

### 6.1 Menu Entry: [`apps/mobile-app/app/(beneficiary)/more.tsx`](file:///Users/puneet/Desktop/MHN/apps/mobile-app/app/(beneficiary)/more.tsx)
Added "Legacy Circle" item navigating to `/(beneficiary)/legacy-circle` with crown icon and subtitle.

### 6.2 Main Screen: [`apps/mobile-app/app/(beneficiary)/legacy-circle.tsx`](file:///Users/puneet/Desktop/MHN/apps/mobile-app/app/(beneficiary)/legacy-circle.tsx)
The screen handles three distinct states:

#### State 1: Registration Form (Initial)
- Fields: Professional Title, Years of Experience, Professional Headline (with 500-char counter), Industry Category Picker, and Email Address.
- **Industry Selector**: Bottom-sheet modal with searchable standard list.
- **Terms & Conditions Box**:
  - Checkbox with bold label **"I agree to the Terms & Conditions."**
  - Informational text displayed on the next line.
  - Interactive link to open full Terms & Conditions in a modal viewer.
  - Form submission disabled until the checkbox is checked.

#### State 2: Under Review / Pending
- Clean status view showing that the profile has been submitted and is currently being reviewed by administrators.
- **Stale Cache Solution**:
  - Added `staleTime: 0` to the React Query configuration.
  - Added `useFocusEffect` to automatically invalidate and refetch `['legacyCircleProfile']` whenever the screen regains focus, ensuring immediate status updates upon admin approval.

#### State 3: Approved Profile (Live)
- **Hero Banner**:
  - Background image: [`assets/images/legacy-circle-bg.png`](file:///Users/puneet/Desktop/MHN/apps/mobile-app/assets/images/legacy-circle-bg.png) (high-resolution city network illustration).
  - Overlay: Warm brand amber/orange overlay (`rgba(234, 88, 12, 0.50)`).
  - Overlapping Avatar: Circular profile photo with a crisp white border (`#FFFFFF`) positioned across the banner and card boundary without clipping.
- **Live Badge**: "Live on Website" green pill indicator.
- **Profile Details**: Name, Title, Headline, Industry badge, and approval timestamp.
- **Metrics Grid**: "Connect Requests" and "Profile Strength (100%)".
- **WhatsApp Share Action**: Pre-formatted profile link sharing card with one-tap action.

### 6.3 Local Assets:
- [`apps/mobile-app/assets/images/legacy-circle-bg.png`](file:///Users/puneet/Desktop/MHN/apps/mobile-app/assets/images/legacy-circle-bg.png)
- [`apps/mobile-app/assets/images/legacy-circle-bg.jpg`](file:///Users/puneet/Desktop/MHN/apps/mobile-app/assets/images/legacy-circle-bg.jpg)

---

## 7. Verification & Testing Matrix

| Component | Test Case | Status |
|---|---|---|
| **Database** | Migration / Prisma push for `LegacyCircleProfile` | Passed |
| **Admin Backend** | `GET /api/legacy-circle?status=pending` returns unapproved requests | Verified |
| **Admin Backend** | `PATCH /api/legacy-circle/:id/approve` updates status and sends notification | Verified |
| **Admin Frontend** | "Legacy Circle Approval" tab renders below "Saathi Onboarding" | Verified |
| **Admin Frontend** | Approve action moves request from "Requests" tab to "Approved" tab | Verified |
| **Admin Frontend** | TypeScript compilation (`npx tsc --noEmit`) passes with 0 errors | Verified |
| **Mobile App** | Form validation requires all fields + Terms & Conditions agreement | Verified |
| **Mobile App** | Screen invalidates cache on screen focus and transitions from Pending to Approved without restarting app | Verified |
| **Mobile App** | Approved view displays city network background image with orange overlay and overlapping avatar matching Figma | Verified |

---

## 8. Website Public Portal & Deep Linking (Session 2 Updates)

### 8.1 Public API (`apps/api`)
- **Endpoint**: `GET /api/website/content/legacy-circle/:id`
- **Description**: Exposes a public, unauthenticated route to fetch an approved legacy profile by ID. Ensures `isActive` and `status === 'approved'` checks are strictly enforced.

### 8.2 Admin Panel Link Generation
- **Environment Awareness**: Updated `LegacyCirclePage.tsx` to conditionally build the share URL using `import.meta.env.DEV ? 'http://localhost:5174' : 'https://maihoonna.com'`.

### 8.3 Mobile App Share Modal (`apps/mobile-app`)
- **Share Profile Button**: Added to the Approved Profile view.
- **Custom Bottom Sheet**: Built a completely custom, native-feeling share modal in `legacy-circle.tsx` to handle the `https://maihoonna.com/legacy/:id` link.
- **Functionality**:
  - `expo-clipboard` integration for quick copy-to-clipboard functionality.
  - Native quick-share handlers for **WhatsApp**, **Email**, **SMS**, and a fallback to the system **Share dialog (More)**.
  - Correctly split the string message and URL in the iOS `Share.share()` API to prevent duplicate URLs from being appended by the system.

### 8.4 Website Public Views (`apps/website`)
- **Legacy Page (`LegacyPage.jsx`)**: Implemented a public landing page featuring a grid of legacy experts with a dynamic location filter.
- **Profile Modal (`LegacyExpertProfile.jsx`)**: Built a compact, visually appealing modal overlay to view the full details of a specific expert and initiate a connection request, replacing the previous full-page approach.
