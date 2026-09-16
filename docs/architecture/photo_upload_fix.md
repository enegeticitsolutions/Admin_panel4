# Profile Photo Upload Fix (Android vs iOS)

## Overview
This document outlines the investigation and resolution of a persistent bug where profile photo uploads from the Android app failed to render successfully for newly created accounts, despite the API returning a `200 OK` status and saving the file to AWS S3.

## The Bug Symptoms
1. **Android First Upload:** When a newly created account attempted its first profile photo upload from an Android device, the upload succeeded but the image rendered completely blank/white on both Android and iOS devices.
2. **iOS First Upload:** If the same newly created account performed its first upload from an iOS device, the upload succeeded and the image rendered perfectly on all devices.
3. **Android Second Upload:** Interestingly, if the account already had a valid profile photo (e.g., uploaded via iOS first), subsequent uploads from Android worked correctly.

## Root Cause Analysis

We identified two separate but compounding issues across the mobile app and the backend:

### 1. React Native `fetch` Multipart Bug
Initially, the React Native app was using the standard `fetch` API to upload `FormData`. On Android, React Native's `fetch` implementation historically struggles with binary file uploads because it intercepts the payload and appends `charset=utf-8` to the `Content-Type` boundary header, which can corrupt binary image buffers in transit.

### 2. Android `content://` URI Missing Extensions
The main reason for the OS-specific failure came down to how Android's `ImagePicker` handles file URIs versus how the backend parses them:
- On **iOS**, the `ImagePicker` returns file paths containing explicit extensions (e.g., `file:///.../image.jpg`).
- On **Android**, the `ImagePicker` often returns `content://` URIs without any file extensions (e.g., `content://media/external/images/media/42`).

When the Expo FileSystem uploaded the Android file, Multer (on the backend) interpreted the filename as `42`. The backend function responsible for generating S3 paths (`generateProfilePath`) blindly extracted the extension using `originalName.split('.').pop()`. Because there was no dot, it used the entire string `42` as the file extension.

This resulted in S3 object keys like:
`profiles/volunteer/123/123456789_uid.42`

**Why this broke the UI:** React Native's `<Image>` component relies strictly on the file extension in the URL to determine which internal image decoder to use. Because `.42` is not a recognized image extension, the UI silently failed to render the image.

## The Solution

### Mobile App (Client-side)
We replaced the standard `fetch` call with Expo's `FileSystem.uploadAsync`. This ensures that `multipart/form-data` uploads are handled natively and securely on both iOS and Android, bypassing the `charset=utf-8` payload corruption issue.

**File modified:** `apps/sathi-app/app/(sathi)/profile.tsx`

### API (Server-side)
We updated the `generateProfilePath` function in the backend to explicitly validate the extracted file extension. If the extracted extension is not a recognized image format (e.g., if it's just a number from an Android URI), the backend now forces the extension to `.jpg`.

**File modified:** `apps/api/app/api/shared/profile-photo.routes.ts`

```typescript
function generateProfilePath(entityType: string, entityId: string, originalName: string): string {
  let ext = originalName.split('.').pop() || 'jpg';
  
  // Whitelist of valid image extensions
  const validExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'];
  
  // If the extension is not valid (e.g. just a number from an Android URI), force it to jpg
  if (!validExts.includes(ext.toLowerCase())) {
    ext = 'jpg';
  }
  
  const timestamp = Date.now();
  const uid = uuidv4().split('-')[0];
  return `profiles/${entityType}/${entityId}/${timestamp}_${uid}.${ext}`;
}
```

## Conclusion
This fix ensures that all profile photos, regardless of the device they are uploaded from, are stored with valid image extensions. As a result, React Native's `<Image>` component can successfully decode and render the images across all platforms.
