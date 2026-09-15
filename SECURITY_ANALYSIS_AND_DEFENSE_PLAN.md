# Security Threat Analysis & Platform Hardening Plan
**Platform:** My Health Needs (MHN)  
**Scope:** Main API (`apps/api`), Admin Backend (`apps/admin-backend`), Web App (`apps/website`), and Mobile Apps (`apps/mobile-app`, `apps/sathi-app`)  
**Date:** September 2026  
**Status:** Audit Completed / Action Plan Documented  

---

## 1. Executive Summary & Threat Matrix

| Threat Category | Risk Level | Current Codebase Status | Primary Threat Impact |
| :--- | :---: | :--- | :--- |
| **Brute Force (OTP Guessing)** | **HIGH** | IP-only rate limit (`10 req/15m`). No per-phone failure lockout. | Attacker rotates IPs via proxies/botnets to guess 6-digit OTP within 5-min TTL. |
| **SMS / OTP Bombing** | **HIGH** | Only IP-limited. No cooldown per phone number. | Financial drain on MSG91/Twilio wallet credits; SMS harassment of victim phones. |
| **Test OTP Bypass Leak** | **CRITICAL** (if deployed) | `ENABLE_OTP_BYPASS` & `OTP_BYPASS_ANY_PHONE` with static code `442233`. | If enabled in staging/prod, anyone can take over any account using `442233`. |
| **SQL Injection (SQLi)** | **LOW / SAFE** | Codebase exclusively uses Prisma ORM with parameterized queries. | No raw string-concatenated SQL (`$queryRawUnsafe`) was found in routes. |
| **Phone Change without OTP** | **HIGH** | Beneficiary `profile.routes.ts` allows updating `phone` directly via `prisma.user.update`. | Account takeover / identity spoofing without SMS proof of ownership. |
| **Insecure Token Storage** | **MEDIUM** | Web uses `localStorage`; Mobile uses unencrypted `AsyncStorage` + `allowBackup="true"`. | Token extraction via XSS (web) or ADB backup / rooted devices (mobile). |
| **In-Memory Rate Limiting** | **MEDIUM** | Uses local memory `express-rate-limit`. | Limits reset on server restarts and fail if multiple backend instances run behind a load balancer. |
| **Stored XSS** | **MEDIUM** | User inputs (notes, medical remarks, addresses) stored and rendered without explicit sanitization. | Malicious scripts could execute in Admin Dashboard or Web portal. |

---

## 2. Deep-Dive Vulnerability Analysis

### 2.1 Brute Force Attacks
#### A. OTP Verification Brute Force
- **Location:** `apps/api/app/api/auth/auth.routes.ts` (lines 15–25) and `apps/api/app/core/otp/StplProvider.ts` (lines 150–168).
- **The Vulnerability:**
  1. The OTP verification rate limiter is keyed **strictly to the requester's IP address** (`req.ip`):
     ```typescript
     const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
     ```
  2. In `StplProvider.ts`, if an incorrect code is entered, the database record is **not updated with failed attempt counts** and the OTP remains valid for the full 5 minutes:
     ```typescript
     const record = await prisma.otp.findUnique({ where: { phone } });
     if (!record || record.code !== code || record.expiresAt < new Date()) {
       return false; // Does not increment failures, does not lock out!
     }
     ```
  3. **Exploitation Scenario:** An attacker distributes requests across 100 residential proxies or cloud IPs. Since each IP gets 10 attempts, they can fire 1,000 attempts without tripping the rate limit, brute-forcing the 6-digit OTP code before it expires.

#### B. SMS Bombing / Financial Exhaustion
- **Location:** `POST /api/auth/send-otp` (`apps/api/app/api/auth/auth.routes.ts`)
- **The Vulnerability:** There is no per-phone throttle or resend cooldown in the backend (e.g., enforcing 60 seconds between OTP requests to the same number, and a max of 3–4 OTPs per hour per phone).
- **The Threat:** Attackers can script repeated OTP requests targeting a specific victim phone number, causing SMS gateway costs (MSG91/Twilio) to spike exponentially and disrupting service.

#### C. Testing OTP Bypass in Production
- **Location:** `apps/api/app/core/otp/otp_bypass.ts` (lines 13–42)
- **The Vulnerability:**
  ```typescript
  export function isOtpBypassEnabled(): boolean {
    return process.env.ENABLE_OTP_BYPASS === 'true';
  }
  ```
  There is no hard fail check ensuring `process.env.NODE_ENV !== 'production'`. If `.env` on the production server accidentally includes `ENABLE_OTP_BYPASS=true` or `OTP_BYPASS_ANY_PHONE=true`, anyone entering `442233` can log into any subscriber, care companion, or admin account.

---

### 2.2 SQL Injection (SQLi) Assessment
- **Status:** **Secure Against SQL Injection.**
- **Details:** The backend utilizes Prisma ORM across all controllers and services. Queries rely on Prisma's type-safe object syntax (e.g., `prisma.user.findUnique({ where: { phone } })`).
- **Audit Findings:** No occurrences of raw SQL execution (`$queryRaw`, `$queryRawUnsafe`, `executeRaw`, or custom SQL string concatenations) exist in `apps/api` or `apps/admin-backend`.
- **Precaution Needed:** Ensure developers never introduce `$queryRawUnsafe` with dynamic string templates when adding complex reporting or analytics queries in the future.

---

### 2.3 Account Takeover via Unverified Phone Update
- **Location:** `apps/api/app/api/beneficiary/profile.routes.ts` (lines 76–85)
- **The Vulnerability:**
  ```typescript
  // In POST /beneficiary/profile/me
  if (phone || email || name) {
    await prisma.user.update({
      where: { id: beneficiary.userId },
      data: {
        ...(phone && { phone }),
        ...(email && { email }),
        ...(name && { name })
      }
    });
  }
  ```
  The authenticated user can change their login `phone` number without providing an OTP verification code for the new number.
- **The Threat:** If a session is hijacked or a device is left unattended, an adversary can change the account's registered phone number to their own, locking out the legitimate user.

---

### 2.4 Client-Side & Token Storage Vulnerabilities
#### A. Mobile App (`apps/mobile-app` & `apps/sathi-app`)
1. **Unencrypted Token Storage:** `apps/mobile-app/contexts/AuthContext.tsx` stores `userToken` in `AsyncStorage`. On Android, `AsyncStorage` saves plain text in SQLite/XML under `/data/data/<package>/`.
2. **Android ADB Backup Enabled:** In `apps/mobile-app/android/app/src/main/AndroidManifest.xml` (line 20), `android:allowBackup="true"` is set. An attacker with physical access or ADB access can extract app data and recover the JWT token via `adb backup`.

#### B. Web Frontend (`apps/website`)
- **Location:** `apps/website/src/App.jsx` stores `mhn_token` in `localStorage`.
- **The Threat:** Any stored or DOM-based Cross-Site Scripting (XSS) vulnerability can read `localStorage.getItem('mhn_token')` and exfiltrate user credentials.

---

### 2.5 In-Memory Rate Limiting Weakness
- **Location:** `express-rate-limit` in `apps/api/app/main.ts` and `apps/admin-backend/server.js`.
- **The Vulnerability:** Rate limiting counters are stored in the server process's local memory.
  - Every time the application is deployed, crashes, or restarts, counters reset to 0.
  - In production with multi-instance clustering (PM2 or Docker/Kubernetes replicas), each container maintains its own separate counter, diluting the effective limit by the number of instances.

---

## 3. Backend Hardening Plan

```
+-------------------------------------------------------------------------+
|                              Client Request                             |
+-------------------------------------------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                           WAF / Cloudflare                              |
+-------------------------------------------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                  Helmet Security Headers & CORS Filter                  |
+-------------------------------------------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                      Redis Distributed Rate Limiter                      |
|                 (Composite Key: IP + Target Phone Number)                |
+-------------------------------------------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                 OTP Attempt Limiter (Max 5 Failed Attempts)             |
+-------------------------------------------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                     Zod Input Schema Validation                         |
+-------------------------------------------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                     Prisma Parameterized Database Query                 |
+-------------------------------------------------------------------------+
```

### Action 1: Enforce Account Lockout & Max OTP Attempts
Instead of relying solely on IP rate limiting, store attempts against the target phone number:
1. When generating an OTP, store `attempts: 0` and `maxAttempts: 5`.
2. On `verifyOtp`, increment the attempt count on failure.
3. If `attempts >= 5`:
   - Delete the OTP immediately.
   - Lock out the phone number for 15 minutes.
   - Return `429 Too Many Requests` ("Too many incorrect attempts. This OTP has been invalidated. Please request a new one after 15 minutes.").

### Action 2: Phone-Based Cooldown on `send-otp` (Stop SMS Bombing)
1. **60-Second Cooldown:** Reject requests to the same phone number if an OTP was issued less than 60 seconds ago.
2. **Hourly Limit:** Enforce a maximum of 4 OTP requests per phone number per hour.
3. **Daily Limit:** Enforce a maximum of 10 OTP requests per phone number per 24 hours.

### Action 3: Production Guard on OTP Bypass
Modify `apps/api/app/core/otp/otp_bypass.ts` to strictly refuse bypass mode if `NODE_ENV === 'production'`:
```typescript
export function isOtpBypassEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false; // Hard-coded safety lock for production
  }
  return process.env.ENABLE_OTP_BYPASS === 'true';
}
```

### Action 4: Require OTP for Sensitive Profile Changes
In `apps/api/app/api/beneficiary/profile.routes.ts`:
- Do **not** allow updating `phone` directly in `POST /me`.
- Require a dedicated `POST /auth/change-phone/request` and `POST /auth/change-phone/verify` endpoint where an OTP sent to the *new* phone number must be verified before updating the user record.

### Action 5: Distributed Rate Limiting via Redis
Replace in-memory stores in `apps/api` and `apps/admin-backend` with `rate-limit-redis`:
- Shared state across PM2 worker processes or clustered servers.
- Composite rate limit key: `${req.ip}:${req.body?.phone || ''}` to protect both the user identity and the IP address.

---

## 4. Frontend & Mobile Hardening Plan

### Action 1: Mobile Secure Token Storage (`apps/mobile-app` & `apps/sathi-app`)
1. **Migrate to `expo-secure-store`:**
   Replace `AsyncStorage.setItem('userToken', token)` with `SecureStore.setItemAsync('userToken', token)` in `AuthContext.tsx`.
   - On iOS: Stores in the encrypted **iOS Keychain**.
   - On Android: Encrypts data in **Android Keystore / EncryptedSharedPreferences**.
2. **Disable Android ADB Backups:**
   In `apps/mobile-app/android/app/src/main/AndroidManifest.xml`:
   ```xml
   <!-- Change allowBackup to false -->
   <application
     ...
     android:allowBackup="false">
   ```

### Action 2: Web Client Security (`apps/website`)
1. **Token Hygiene:** If using `localStorage`, ensure strict sanitization on all dynamic HTML rendering:
   - Use `DOMPurify` on any rich text / HTML content rendered on the website or admin dashboard.
   - Avoid `dangerouslySetInnerHTML` with unsanitized user inputs.
2. **CORS & Cookies Alternative:** For the web app, consider migrating session tokens to `HttpOnly; SameSite=Strict; Secure` cookies. This makes tokens completely inaccessible to malicious JavaScript.

### Action 3: UI-Level Request Throttling & Debouncing
1. **OTP Resend Button:**
   - Display an active 60-second visual countdown timer on the "Resend OTP" button.
   - Disable the button both visually and logically until the countdown hits zero.
2. **Submit Button Debouncing:**
   - Disable the submit button immediately upon press to prevent accidental double-submission or automated rapid firing.

---

## 5. Implementation Roadmap

### Phase 1: Critical (Immediate - Day 1)
- [ ] Add production lock in `otp_bypass.ts` to prevent bypass in production.
- [ ] Add OTP attempt counter (`max: 5`) and immediate invalidation in `StplProvider.ts`.
- [ ] Set `android:allowBackup="false"` in `apps/mobile-app/android/app/src/main/AndroidManifest.xml`.
- [ ] Remove unverified `phone` updates from beneficiary `profile.routes.ts`.

### Phase 2: High Priority (Week 1)
- [ ] Migrate mobile `userToken` storage from `AsyncStorage` to `expo-secure-store`.
- [ ] Add 60-second resend cooldown and 4-per-hour limit on `POST /api/auth/send-otp` per phone number.
- [ ] Add phone resend countdown timers and submit button throttling on web and mobile UI.

### Phase 3: Infrastructure Hardening (Week 2)
- [ ] Connect Redis to `express-rate-limit` for cluster-wide rate limiting.
- [ ] Add account lockout after 5 consecutive failed password attempts in `apps/admin-backend`.
- [ ] Audit all Admin Frontend inputs with `DOMPurify` to prevent Stored XSS.
