# Branch Changes Summary (`feature/update-favicon-seo-metadata`)

This document outlines all the modifications, additions, and updates present in the `feature/update-favicon-seo-metadata` branch. You can review this list and choose which changes to keep, modify, or revert.

---

## Table of Contents
1. [Legal Framework & Policies](#1-legal-framework--policies)
2. [Favicon & Brand Assets](#2-favicon--brand-assets)
3. [SEO & Sitemap Clean-up](#3-seo--sitemap-clean-up)
4. [404 Error Page & Disabled Plans Flow](#4-404-error-page--disabled-plans-flow)
5. [App Store Links](#5-app-store-links)
6. [Footer Social Icons](#6-footer-social-icons)
7. [Saathi Enrollment Form](#7-saathi-enrollment-form)

---

## 1. Legal Framework & Policies
**Modified Files:**
- [`apps/website/src/pages/LegalPage.jsx`](file:///Users/shubhamtripathi/Downloads/MHN-stagging/apps/website/src/pages/LegalPage.jsx)
- [`apps/website/src/App.jsx`](file:///Users/shubhamtripathi/Downloads/MHN-stagging/apps/website/src/App.jsx)

### Changes:
- **Terms & Conditions Split**:
  - **Part A**: Terms and Conditions for Subscribers (Care packages, rollover hours, NOK responsibilities).
  - **Part B**: Terms and Conditions for Beneficiaries (Senior citizen care rights, privacy, emergency protocols).
  - **Part C (Appendix)**: Competitive Benchmark analysis (MaiHoonNa vs. Emoha vs. Samarth).
- **Privacy Policy**: Completely updated to full DPDPA 2023 / Rules 2025 compliance (Data fiduciary terms, consent architecture, senior citizen data security).
- **Refund Policy**: Formatted into official 3-clause breakdown (Renewal & cancellation, unused hours calculation, processing timeline).
- **Child Safety Policy**: Comprehensive child and minor protection policy.

---

## 2. Favicon & Brand Assets
**Modified / Added Files:**
- [`apps/website/index.html`](file:///Users/shubhamtripathi/Downloads/MHN-stagging/apps/website/index.html)
- [`apps/website/public/favicon-48x48.png`](file:///Users/shubhamtripathi/Downloads/MHN-stagging/apps/website/public/favicon-48x48.png) *(New)*
- [`apps/website/public/favicon.ico`](file:///Users/shubhamtripathi/Downloads/MHN-stagging/apps/website/public/favicon.ico) *(New)*
- [`apps/website/public/favicon.png`](file:///Users/shubhamtripathi/Downloads/MHN-stagging/apps/website/public/favicon.png) *(New)*
- [`apps/website/public/icon-192.png`](file:///Users/shubhamtripathi/Downloads/MHN-stagging/apps/website/public/icon-192.png) *(New)*
- [`apps/website/public/icon-512.png`](file:///Users/shubhamtripathi/Downloads/MHN-stagging/apps/website/public/icon-512.png) *(New)*
- [`apps/website/public/apple-touch-icon.png`](file:///Users/shubhamtripathi/Downloads/MHN-stagging/apps/website/public/apple-touch-icon.png) *(Updated)*
- [`apps/website/public/favicon.svg`](file:///Users/shubhamtripathi/Downloads/MHN-stagging/apps/website/public/favicon.svg) *(Updated)*

### Changes:
- Replaced the wide text banner with the **official circular MaiHoonNa emblem** in 1:1 square ratio.
- Created `favicon-48x48.png` specifically for **Google Search Results** (to replace the default generic orange "MHN" letter circle).
- Generated standard multi-platform icons: Apple touch icon (180x180), Android/PWA icons (192x192, 512x512), and desktop `.ico`.
- Linked all sizes properly inside `<head>` in `index.html`.

---

## 3. SEO & Sitemap Clean-up
**Modified Files:**
- [`apps/website/public/sitemap.xml`](file:///Users/shubhamtripathi/Downloads/MHN-stagging/apps/website/public/sitemap.xml)

### Changes:
- Removed `<loc>https://maihoonna.in/plans</loc>` from `sitemap.xml`.
- **Reason**: Since the `/plans` page is deactivated and returns a 404, removing it prevents Google Search Console from raising "Submitted URL not found (404)" crawl errors.

---

## 4. 404 Error Page & Disabled Plans Flow
**Modified Files:**
- [`apps/website/src/pages/NotFoundPage.jsx`](file:///Users/shubhamtripathi/Downloads/MHN-stagging/apps/website/src/pages/NotFoundPage.jsx)
- [`apps/website/src/App.jsx`](file:///Users/shubhamtripathi/Downloads/MHN-stagging/apps/website/src/App.jsx)

### Changes:
- Removed the **"View Plans"** button from the 404 (Not Found) error page so users only see **"🏠 Return to Homepage"** and **"Explore Services"**.
- Updated fallback navigation in `App.jsx` (e.g. from checkout / account) from `plans` to `services`.

---

## 5. App Store Links
**Modified Files:**
- [`apps/website/src/constants/links.js`](file:///Users/shubhamtripathi/Downloads/MHN-stagging/apps/website/src/constants/links.js)

### Changes:
- **Family Connect App Store Link**: Updated to `https://apps.apple.com/in/app/maihoonna/id6801516827`
- **Saathi App Store Link**: Updated to `https://apps.apple.com/in/app/maihoonna-saathi-app/id6802669670`

---

## 6. Footer Social Icons
**Modified Files:**
- [`apps/website/src/components/layout/Footer.jsx`](file:///Users/shubhamtripathi/Downloads/MHN-stagging/apps/website/src/components/layout/Footer.jsx)
- [`apps/website/src/constants/links.js`](file:///Users/shubhamtripathi/Downloads/MHN-stagging/apps/website/src/constants/links.js)

### Changes:
- Removed the **YouTube** icon and link from the footer social media links (only Instagram, X/Twitter, and Facebook remain).

---

## 7. Saathi Enrollment Form
**Modified Files:**
- [`apps/website/src/pages/SaathiPage.jsx`](file:///Users/shubhamtripathi/Downloads/MHN-stagging/apps/website/src/pages/SaathiPage.jsx)

### Changes:
- Added notice text right above *Areas of Interest*:
  > *"Now enrolling in NCR - more cities coming soon. Sign up anyway to be notified when we launch near you."*
- Styled in matching form label size (`13px`), weight (`500`), and orange brand color (`#FE6700`).

---

## File Summary Table

| Category | File Path | Status | Summary of Change |
|---|---|---|---|
| **Legal** | `apps/website/src/pages/LegalPage.jsx` | Modified | T&C (Part A, B, C), Privacy, Refund, Child Safety |
| **Legal / Router** | `apps/website/src/App.jsx` | Modified | Added legal routes, updated fallback navigations |
| **Favicon** | `apps/website/index.html` | Modified | Favicon tags for Google Search, Apple & Android |
| **Favicon** | `apps/website/public/favicon*`, `icon*`, `apple-touch-icon*` | Added/Updated | Generated official square brand icons |
| **SEO** | `apps/website/public/sitemap.xml` | Modified | Removed deactivated `/plans` URL |
| **UI / 404** | `apps/website/src/pages/NotFoundPage.jsx` | Modified | Removed "View Plans" button |
| **Links** | `apps/website/src/constants/links.js` | Modified | App Store URLs & removed YouTube link |
| **Footer** | `apps/website/src/components/layout/Footer.jsx` | Modified | Removed YouTube social icon |
| **Saathi** | `apps/website/src/pages/SaathiPage.jsx` | Modified | Added NCR enrollment notice in orange text |
