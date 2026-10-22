# Unified Single-User Flow & Family Care Circle — Project Context & Architecture

> **Branch:** `feat/unified-single-user-flow`  
> **Last Updated:** October 2026  
> **Status:** Backend & Mobile Frontend Implemented & Typechecked (`tsc` passing 0 errors). Database pushed cleanly to Supabase.

---

## 1. Project Vision & Core Aim

### 1.1 The Problem with the Legacy Architecture
The legacy app enforced a rigid dichotomy between two distinct personas:
1. **Subscriber (Payer/Buyer):** Bought care packages, added beneficiaries, monitored visits and billing.
2. **Beneficiary (Care Recipient):** Elderly user with a dedicated dashboard viewing daily medications, emotional score, next visit, and care coordinator.

This broke down in real-world scenarios:
* **The "Dual Role" User (e.g. Anirudh):** An adult child who purchases care for their mother and father, but also wants their own wellness package or gym/companion benefits.
* **The "Family Circle" Scenario:** Son A buys a care plan for Mother B. Son A has a brother or sister (Person C) who also wants to check in on their mother's visits, review companion notes, view vitals, or help pay/renew packages without having to share Son A's login credentials.
* **The "Self-Managed Elder" Scenario:** An elderly user or independent adult manages their own care plan, but wants to invite their son or daughter into their profile to keep them updated on health vitals and doctor visits.

### 1.2 The Unified Vision
Create a **single unified mobile application experience** where:
1. Any user can be **both** a caregiver (managing beneficiaries/family) and a direct recipient (managing their own personal care).
2. If a user has no active personal package, they only see relevant family activity—no misleading "empty" stats or unassigned coordinators.
3. Users can create a **Care Circle** around any beneficiary or around their own profile, inviting co-caregivers (sons, daughters, siblings, spouses) with granular permission levels.

---

## 2. Granular Permissions: "View Only" vs "Can Edit"

To ensure medical safety and family privacy, members in a Care Circle have explicit access tiers:

| Permission | View Only (`role: 'viewer'`) | Can Edit (`role: 'editor'`) | Primary Sponsor (Owner) |
|---|---|---|---|
| **View Vitals & Trends** | ✅ Yes | ✅ Yes | ✅ Yes |
| **View Visit Reports & CC Notes** | ✅ Yes | ✅ Yes | ✅ Yes |
| **View Medications & Conditions** | ✅ Yes | ✅ Yes | ✅ Yes |
| **View Medical Records (PDFs)** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Add / Remove Medications** | ❌ Blocked (403 Forbidden) | ✅ Allowed | ✅ Allowed |
| **Upload / Delete Medical Records** | ❌ Blocked (403 Forbidden) | ✅ Allowed | ✅ Allowed |
| **Edit Beneficiary Profile Details** | ❌ Blocked (403 Forbidden) | ✅ Allowed | ✅ Allowed |
| **Renew / Purchase Care Plans** | Controlled via `canRenew` | Controlled via `canRenew` | ✅ Always Allowed |
| **Manage Care Circle Members** | ❌ No | ❌ No | ✅ Full Control |

---

## 3. Database & Schema Changes

### 3.1 Model Definition (`packages/database/prisma/schema.prisma`)
An additive model `CareCircleMember` was introduced with zero destructive migrations:

```prisma
model CareCircleMember {
  id              String      @id @default(uuid())
  beneficiaryId   String
  beneficiary     Beneficiary @relation(fields: [beneficiaryId], references: [id], onDelete: Cascade)
  userId          String?     // Nullable until invite code is claimed
  user            User?       @relation("CareCircleUser", fields: [userId], references: [id], onDelete: SetNull)
  role            String      @default("viewer") // 'viewer' | 'editor'
  relationship    String      @default("Family Member")
  canRenew        Boolean     @default(false)
  canViewVitals   Boolean     @default(true)
  canBookVisits   Boolean     @default(false)
  canEditDetails  Boolean     @default(false)
  status          String      @default("pending") // 'pending' | 'active' | 'revoked'
  inviteCode      String?     @unique
  invitedBy       String      // User ID of the primary sponsor who created the invite
  joinedAt        DateTime?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@index([beneficiaryId])
  @@index([userId])
  @@index([inviteCode])
}
```

* **Relational hooks:**
  - `model Beneficiary`: Added `careCircleMembers CareCircleMember[]`.
  - `model User`: Added `careCircleMemberships CareCircleMember[] @relation("CareCircleUser")`.
* **Database Connection Note:**
  - Prisma DDL operations (`npx prisma db push`) must connect through **port 5432** (session mode) on Supabase via `DIRECT_URL` in `apps/api/.env`, because port 6543 (PgBouncer transaction pooler) does not support transactional schema locks.

---

## 4. Backend Implementation (`apps/api`)

### 4.1 New Routes (`apps/api/app/api/subscriber/care-circle.routes.ts`)
Mounted at `/api/subscriber/care-circle` in `apps/api/app/main.ts`:

1. `POST /invite`:
   - Checks that caller is either the primary sponsor (`subscriberId === userId`) or the self-managed user (`beneficiary.userId === userId`).
   - Generates a unique 6-character alphanumeric code (`NANP...`).
   - Saves record with `canEditDetails`, `role` (`'viewer'` or `'editor'`), `canRenew`, and `canViewVitals`.
2. `GET /:beneficiaryId/members`:
   - Returns the Primary Sponsor details and all Care Circle members (`active` and `pending`).
   - Identifies whether the current requesting user is the Primary Sponsor.
3. `POST /join`:
   - Body: `{ inviteCode: string }`.
   - Validates code, links the authenticated `userId`, updates status to `'active'`, and sets `joinedAt`.
4. `PATCH /:beneficiaryId/members/:memberId/permissions`:
   - Primary sponsor can toggle `canEditDetails` (`'viewer'` ↔ `'editor'`), `canRenew`, or `canViewVitals`.
5. `DELETE /:beneficiaryId/members/:memberId`:
   - Removes a co-caregiver from the Care Circle.

### 4.2 Security Guards & Permissions (`apps/api/app/controllers/subscriber/beneficiary.controller.ts`)
* **`verifyBeneficiaryAccess` (Read Guard):** Allows primary sponsor, admins, or active Care Circle members (`canViewVitals`).
* **`verifyBeneficiaryWriteAccess` (Mutation Guard):**
  - Confirms caller is primary sponsor or active Care Circle member with `canEditDetails === true` and `role === 'editor'`.
  - Strictly protects:
    - `PUT /subscriber/beneficiaries/:beneficiaryId`
    - `POST /subscriber/beneficiaries/:beneficiaryId/medications`
    - `DELETE /subscriber/beneficiaries/medications/:medicationId`
    - `POST /subscriber/beneficiaries/:beneficiaryId/medical-records/upload`
    - `PUT /subscriber/beneficiaries/medical-records/:recordId`
    - `DELETE /subscriber/beneficiaries/medical-records/:recordId`
  - Blocks View-Only members with HTTP `403 Forbidden`.
* **`getBeneficiaryProfile`:** Returns `canEditDetails: writeCheck.allowed` to the client so UI can adapt immediately.

### 4.3 Dashboard Endpoints
* **`apps/api/app/api/subscriber/dashboard.routes.ts`:**
  - Queries both directly owned beneficiaries and shared Care Circle beneficiaries.
  - Annotates shared beneficiaries with `isCareCircleMember`, `careCircleRole`, `canRenew`, `canViewVitals`, `canEditDetails`.
* **`apps/api/app/api/beneficiary/dashboard.routes.ts`:**
  - Returns `beneficiaryId` and `beneficiaryName` so that self-profile dashboards can launch Care Circle management directly.
* **`apps/api/app/api/subscriber/subscriptions.routes.ts`:**
  - Allows Care Circle members with `canRenew: true` to link packages to shared beneficiaries.

---

## 5. Mobile Application Implementation (`apps/mobile-app`)

### 5.1 Reusable API Service (`apps/mobile-app/services/api.ts`)
Unified, lightweight HTTP client wrapping `fetch` with automatic Bearer token resolution (`userToken` / `token`) and response normalization:
```ts
import api from '@/services/api';
// Supports api.get(), api.post(), api.put(), api.patch(), api.delete()
```

### 5.2 Care Circle UI Components
1. **`CareCircleModal.tsx` (`components/dashboard/CareCircleModal.tsx`):**
   - Renders Primary Sponsor card (Owner • Full Access).
   - Lists co-caregivers with `[Can Edit]` or `[View Only]` badges. Primary sponsor can tap badges to toggle permissions on the fly.
   - Form to invite members: phone number, name, relationship pills (Son, Daughter, Brother, Sister, etc.).
   - Access level selector cards:
     - **View Only:** *"Can monitor visits, vitals & companion updates. Cannot modify records."*
     - **Can Edit:** *"Full access: can edit medications, update records & details."*
   - Checkbox for *"Allow renewing or buying care plans"*.
   - Native Share button (`Share.share`) with pre-formatted invite text and code.
2. **`JoinCareCircleModal.tsx` (`components/dashboard/JoinCareCircleModal.tsx`):**
   - Modal for entering a 6-character code to join a loved one's Care Circle.
3. **`FamilyConnectIntroModal.tsx` (`components/dashboard/FamilyConnectIntroModal.tsx`):**
   - Educational onboarding modal for users who haven't yet added family members or bought plans.
4. **`FamilyCareSection.tsx` (`components/dashboard/FamilyCareSection.tsx`):**
   - Shows family members with `[Shared Care]` badge for Care Circle memberships.
   - Includes **`Care Circle (N)`** button to manage members.
   - Includes **`[Join Circle]`** button in header.
5. **`PersonalCareOverview.tsx` (`components/dashboard/PersonalCareOverview.tsx`):**
   - Top banner: **"My Care Circle — Share Access"** with **`[Share Access]`** button.
   - Allows users managing their own care plan to invite family members into their profile.
6. **`beneficiary-profile.tsx` (`app/(subscriber)/beneficiary-profile.tsx`):**
   - Replaces header pencil with `[View Only]` badge when user lacks edit permissions.
   - Disables avatar photo editing for View-Only members.
   - Adds **`[Care Circle]`** button to the profile hero card.
   - Embeds `CareCircleModal`.
7. **`MedicalTab.tsx` (`app/(subscriber)/components/beneficiary/MedicalTab.tsx`):**
   - Hides document upload button for View-Only members (shows *"View-only access: Document uploads restricted"*).
   - Hides document rename and delete buttons.
   - Hides medication `Add` button and trash removal buttons.
8. **`beneficiary-edit.tsx` (`app/(subscriber)/beneficiary-edit.tsx`):**
   - Displays View-Only access banner.
   - Disables Save Changes button (shows *"View Only (Read Only)"*).

---

## 6. Verification & Compilation Status

| Target | Command | Result |
|---|---|---|
| **Database Sync** | `npx prisma db push` | Succeeded (0 data loss, existing columns preserved) |
| **Prisma Client** | `npx prisma generate` | Generated v7.10.0 |
| **API Typecheck** | `npx tsc --noEmit` in `apps/api` | **0 errors (Exit code 0)** |
| **Mobile App Typecheck** | `npx tsc --noEmit` in `apps/mobile-app` | **0 errors (Exit code 0)** |

---

## 7. What's Left & Next Steps

1. **SMS & WhatsApp Dispatch Integration:**
   - Currently, invite codes are displayed on screen and can be shared using the native mobile share sheet (`Share.share`).
   - *Next step:* Hook up direct SMS/WhatsApp notifications via backend provider (Twilio / Gupshup / Fast2SMS) when `POST /invite` is called.
2. **Push Notifications for Circle Events:**
   - Send push notifications to circle members when a new CC visit report is published or when vital signs are logged.
   - Notify the primary sponsor when a co-caregiver joins via invite code.
3. **Multi-User Real Device Smoke Testing:**
   - Log in as User A (Son): Buy package for Mother, invite Brother B with "View Only".
   - Log in as User B (Brother): Join circle using code, verify Mother appears with `[Shared Care]` badge, verify medical edits are blocked.
   - Log in as User A: Toggle Brother B to "Can Edit", verify edit buttons unlock for Brother B.
4. **Merge Plan:**
   - Branch: `feat/unified-single-user-flow` is ready for review and client demo.
   - Merge into `main` after client sign-off.
