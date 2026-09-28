# S3 Profile Photo Architecture & Production Troubleshooting Guide

This document captures the root causes, architecture, code changes, and production verification procedures for the S3 profile photo loading issue (where photos disappeared after logout / few hours for Operations Managers, while working for Care Companions).

---

## 1. Problem Statement

- **Symptom**: When an Operations Manager's profile photo was uploaded in the admin portal, it appeared fine immediately. However, after logging out and logging back in after a few hours, the photo failed to display (broken image).
- **Comparison**: Care Companion profile photos continued to work, whereas Operations Manager photos did not.

---

## 2. Root Cause Analysis

### Cause 1: Expiring Presigned S3 URLs Saved Directly in Database
- In AWS S3, a presigned URL (`https://<bucket>.s3.amazonaws.com/<key>?X-Amz-Algorithm=...&X-Amz-Signature=...`) is temporary and expires within a set TTL (typically 15 to 30 minutes).
- When a user uploaded an Operations Manager photo via `ProfilePhotoUploader.tsx`, the frontend component received `{ url }` (the temporary display URL) and stored it into the form state.
- Upon saving (`PUT /staff/:userId`), that full expiring URL was persisted into the database (`users.profilePhoto`).
- **Result**: After the TTL expired, any browser attempting to fetch the image received `HTTP 403 Forbidden` (`Request has expired`).

### Cause 2: Desynchronized Database Fields
- Care Companions have their photo saved in both `users.profilePhoto` and `care_companions.photo`.
- Operations Managers have both `users.profilePhoto` and `operations_managers.photo`.
- Previously, `onboard` and `PUT /staff/:userId` in `routes/users.js` only updated `user.profilePhoto`, leaving `operations_managers.photo` null or out-of-sync.
- In `GET /staff/:userId`, if `user.profilePhoto` was missing or null, it did not fall back to `operationsManagerProfile.photo`.

### Cause 3: Incomplete File Access Resource Handler
- [AdminProfilePhotoResource.js](file:///apps/admin-backend/services/file-access/resources/AdminProfilePhotoResource.js) (the authenticated streaming fallback route `/api/admin/files/profile-photo/:resourceId`) had lookups for:
  - `User`
  - `CareCompanion`
  - `Volunteer`
  - `Beneficiary`
- It was completely missing `OperationsManager`, `FieldManager`, and `CustomerServiceAgent`.

### Cause 4: Flawed S3 Key Extractor & Hardcoded Bucket Strings
- [urlResolver.js](file:///apps/admin-backend/services/storage/urlResolver.js) originally returned `null` whenever a URL contained `X-Amz-Signature`. This meant that once an expired URL was stored in the database, the resolver refused to process it and returned `null`, rendering the image permanently broken.
- It also contained hardcoded strings (`maihoonna-media-prod`, `maihoonna-media-staging`) rather than reading exclusively from `process.env.STORAGE_BUCKET`.

---

## 3. The Solution Architecture

### Correct Pattern: Raw Storage Keys in Database
```
[Browser Upload]
       │
       ▼
[Backend: S3 Upload]
       │  S3 writes object to bucket: e.g., profiles/1727519234-om-photo.jpg
       ▼
[Upload Response]
       ├── url: https://<bucket>.s3...?... (Fresh presigned URL for instant browser preview)
       └── storageKey: "profiles/1727519234-om-photo.jpg" (Raw permanent key)
       │
       ▼
[Database Persistence]
       Database MUST only store the raw key: "profiles/1727519234-om-photo.jpg"
       │
       ▼
[Admin Fetch (GET /staff/:userId)]
       Backend reads raw key from DB -> calls resolveFileUrl(key)
       -> AWS SDK generates a fresh 30-minute presigned URL using EC2/ECS IAM Role
       -> Browser loads photo with zero expiration issues
```

---

## 4. Code Changes Summary

### 1. `apps/admin-backend/services/storage/urlResolver.js`
- **Dynamic Environment Configuration**: Uses `process.env.STORAGE_BUCKET` exclusively to strip bucket prefixes from path-style URLs (`https://s3.ap-south-1.amazonaws.com/<bucket>/<key>`).
- **Query String Stripping**: Added `.split('?')[0]` to strip any residual presigned parameters (`X-Amz-Signature`, `X-Amz-Credential`, etc.) if a full URL was ever previously stored.
- **Removed False Rejection**: Removed `if (trimmed.includes('X-Amz-Signature')) return null;` so legacy records in production DB can self-heal dynamically.

### 2. `apps/admin-backend/routes/users.js`
- Imported `extractStorageKey` from `urlResolver.js`.
- In `POST /staff/onboard` and `PUT /staff/:userId`:
  ```javascript
  const rawPhoto = personal.photoUrl;
  const cleanPhoto = rawPhoto ? (extractStorageKey(rawPhoto) || rawPhoto) : null;
  ```
- Persists `cleanPhoto` into both `User.profilePhoto` and `OperationsManager.photo` (as well as `FieldManager.photo`, `CareCompanion.photo`, and `CustomerServiceAgent.photo`).
- In `GET /staff/:userId`, added full fallback cascade:
  ```javascript
  const staffPhoto =
    user.profilePhoto ||
    user.operationsManagerProfile?.photo ||
    user.careCompanionProfile?.photo ||
    user.fieldManagerProfile?.photo ||
    user.customerServiceProfile?.photo ||
    null;
  ```

### 3. `apps/admin-backend/services/file-access/resources/AdminProfilePhotoResource.js`
- Added support for `OperationsManager`, `FieldManager`, and `CustomerServiceAgent` by ID.
- Wrapped returned values in `clean(val)` to guarantee raw storage keys are returned.

### 4. `apps/admin-frontend/src/services/api.ts`
- Updated `uploadApi.uploadProfilePhoto` to return both `url` and `storageKey`:
  ```typescript
  return {
    url: result.url,
    storageKey: result.storageKey || result.url,
    data: result.data,
    entityType: result.entityType,
    targetId: result.targetId,
  };
  ```

### 5. `apps/admin-frontend/src/app/components/common/ProfilePhotoUploader.tsx`
- Updated `AdminPhotoUploaderConfig` to pass `storageKey` through `onSuccess(url, storageKey)`.

### 6. `apps/admin-frontend/src/app/components/StaffEditModal.tsx`
- Updated `onSuccess` handler to store `storageKey || url` in `formState.personal.photoUrl`.

---

## 5. AWS IAM Role Compatibility

In production (e.g. AWS EC2 / ECS / EKS):
1. **No Hardcoded Keys**: The AWS SDK (`@aws-sdk/client-s3`) automatically retrieves temporary session credentials from the EC2 instance metadata or ECS task role endpoint (`169.254.169.254`).
2. **Presigned URL Generation**: `@aws-sdk/s3-request-presigner` automatically appends `X-Amz-Security-Token` for STS session credentials.
3. **Validity**: Because presigned URLs are generated **on-the-fly on every request** in `GET /staff/:userId`, photos will never expire even across hours, days, or months.

---

## 6. Production Troubleshooting & Verification Runbook

### Step 1: Check Database Contents
Run the following SQL queries in your production PostgreSQL database:
```sql
-- Check User records for Operations Managers
SELECT id, name, role, "profilePhoto" 
FROM users 
WHERE role = 'operations_manager';

-- Check OperationsManager records
SELECT id, "userId", name, photo 
FROM operations_managers;
```
- **Healthy Value**: A clean S3 storage key:
  ```
  profiles/1727519234567-photo.jpg
  ```
- **Legacy Value (Full URL)**: If it begins with `https://...amazonaws.com/...`, `urlResolver.js` will automatically extract the key. However, for clean data hygiene, you can update it to the key portion.

### Step 2: Check Backend Logs for Presigning
Look for the following log output in production:
```
[urlResolver] Presigning key: profiles/1727519234567-photo.jpg
```
If you encounter `[urlResolver] Failed to presign URL for key ...`:
1. Check that `STORAGE_BUCKET=maihoonna-media-prod` is present in the production `.env`.
2. Check that the IAM Role attached to the EC2/ECS instance has the following IAM policy:
   ```json
   {
     "Effect": "Allow",
     "Action": [
       "s3:GetObject",
       "s3:PutObject"
     ],
     "Resource": "arn:aws:s3:::maihoonna-media-prod/*"
   }
   ```

### Step 3: Verify Object Existence in S3 Bucket
Using AWS CLI:
```bash
aws s3 ls s3://maihoonna-media-prod/profiles/
```
Confirm that the key stored in the DB matches an existing file in the S3 bucket.
