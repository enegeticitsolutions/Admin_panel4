# Architecture: S3 Presigned URL Resolution

## Overview

Historically, profile images and visit photos were stored in a private AWS S3 bucket, and their raw S3 paths (e.g., `profiles/xyz.jpg`) were stored directly in the database. When the backend APIs returned data to the web or mobile clients, they returned these raw paths, leaving it up to the client to figure out how to retrieve the image. 

This led to broken images across the Admin Portal and Website, because the S3 bucket is strictly configured for private access. 

To resolve this issue securely, we implemented an **S3 Presigned URL Architecture**. This pattern intercepts image and file paths before they are sent to the client and converts them into time-limited, cryptographically signed HTTP URLs that grant temporary read access.

## Implementation Details

### 1. The `urlResolver.js` Utility
At the core of the resolution process is the `urlResolver.js` utility (added to both `apps/api/` and `apps/admin-backend/`).

This utility does two things:
1. **`extractStorageKey(url)`**: Normalizes paths. It skips URLs that are already presigned, external URLs (like Unsplash), and extracts the raw S3 Key if the URL is formatted as `s3://bucket/...` or `/profiles/...`.
2. **`resolveFileUrl(keyOrUrl)`**: Asynchronously talks to the S3 Client (via `StorageService`) and calls `getSignedUrl(GetObjectCommand)`. It returns an `https://...` URL valid for a strict timeframe (default 15 to 30 minutes).

### 2. Backend API Middleware & Mappers
Rather than pushing the responsibility to the frontends (which would require hundreds of individual async API calls per page load just to fetch image URLs), the resolution occurs directly in the backend route controllers.

When mapping database records to the JSON payload, we use `Promise.all` alongside our synchronous/asynchronous mapping functions to resolve all images in parallel before sending the response:

```javascript
const mapped = await Promise.all(beneficiaries.map(async (b) => {
  return {
    ...b,
    photo: b.photo ? await resolveFileUrl(b.photo) : null,
  };
}));
```

#### Affected Entities:
The following entities have been updated in `admin-backend` to resolve S3 URLs seamlessly:
- **Subscribers** (`routes/subscribers.js`)
- **Beneficiaries** (`routes/beneficiaries.js`)
- **Volunteers / Saathis** (`routes/volunteers.js`)
- **Care Companions** (`routes/users.js`)
- **Field Managers** (`routes/users.js`)
- **Operations Managers** (`routes/users.js`)
- **Visit Images** (`routes/visits.js` - properly parsing the `imageUrls` JSON array and resolving all strings within)

### 3. Document Resolution
Staff Documents and Medical Records uploaded by subscribers handle resolution differently. Since documents are sensitive and often viewed on-demand rather than listed collectively in a feed, they use a dedicated `FileResource` pattern (`fileAccessApi.getPresignedUrl('medical_record', doc.id)` in the frontend). The frontend specifically queries `GET /api/files/presigned` when a user clicks "View Document", ensuring document URLs are generated precisely at the moment of access.

## Security Benefits
1. **Zero Public Access**: The S3 Bucket `Block Public Access` settings remain strictly on.
2. **Ephemeral Access**: Presigned URLs expire. If a URL leaks, it is useless after 15 minutes.
3. **Immutability**: Presigned URLs are tied strictly to the exact S3 key and HTTP method (GET). They cannot be maliciously tampered with to access other files in the bucket.
