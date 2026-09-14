# API Security Implementation Plan

## Goal
Secure the backend Google Maps endpoints so only the mobile apps can access them using a shared secret.

## Changes
1. **apps/api/.env** - Update GOOGLE_MAPS_API_KEY and add MHN_APP_SECRET.
2. **apps/api/app/api/public/location.routes.ts** - Add middleware to verify the  header.
3. **apps/mobile-app/.env** & **apps/sathi-app/.env** - Add .
4. **AddressPicker.native.tsx (both apps)** - Pass the  header in the  requests.
