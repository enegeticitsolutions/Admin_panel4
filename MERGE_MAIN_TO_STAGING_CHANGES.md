# Merge Changelog: Syncing `main` into `staging`

> **Date:** November 16, 2026  
> **Merge Commit:** `46b75c2`  
> **Status:** `staging` is now **0 commits behind `main`** (Clean fast-forwardable merge into `main` with zero conflicts).

---

## 1. Overview for Developers

`main` had 8 commits merged into it that were not yet in `staging`. When merging `harshit/main` into `staging`, two files had overlapping edits and were manually resolved to preserve the functionality of **both** branches.

This document describes exactly what changed in those two files, why, and how to revert or tweak any part.

---

## 2. Detailed Conflict Resolutions

### File 1: `apps/website/src/App.jsx`

#### Background:
- **`main` introduced:** Hero email pre-fill logic (`initialEmail`). If an email was entered on the hero section, the modal opened with title *"Join the Waitlist"*, badge *"Early Access"*, otherwise *"Customize Your Eldercare Plan"*.
- **`staging` introduced:** Multi-source origin tracking (`modalSource` / `sourceTag`), allowing sections like *"NRI Family Section"* to dynamically customize the modal's title (*"Join as NRI Family"*), badge (*"NRI Eldercare"*), and subtitle.

#### What was resolved:
We unified both intents into one clean condition. If the user comes from the NRI section, it displays the NRI copy. If an `initialEmail` is present or the source is "Waitlist", it displays the Waitlist copy. Otherwise, it defaults to the Bespoke Plan copy.

```jsx
// File: apps/website/src/App.jsx (Lines ~335-365)
<CustomizePlanModal
  isOpen={isModalOpen}
  onClose={closeForm}
  initialEmail={initialEmail}
  source={modalSource}
  title={
    modalSource.includes("NRI")
      ? "Join as NRI Family"
      : initialEmail || modalSource.includes("Waitlist")
      ? "Join the Waitlist"
      : "Customize Your Eldercare Plan"
  }
  badge={
    modalSource.includes("NRI")
      ? "NRI Eldercare"
      : initialEmail || modalSource.includes("Waitlist")
      ? "Early Access"
      : "Bespoke Care Plan"
  }
  subtitle={
    modalSource.includes("NRI")
      ? "Stay actively involved in your parents' daily care from anywhere in the world. Our team will reach out within 24 hours."
      : initialEmail || modalSource.includes("Waitlist")
      ? "Tell us about your eldercare needs and we'll reach out within 24 hours to get you started."
      : "Tell us about your family’s unique requirements. Our care advisory team will design a customized care plan and reach out to you within 24 hours."
  }
  successMsg={
    modalSource.includes("NRI") || initialEmail || modalSource.includes("Waitlist")
      ? "You're on the list! Our care advisory team will call you shortly to understand your requirements."
      : "Your custom care request has been submitted directly to our Care Advisory Team. We will review your requirements and call you shortly to formulate the perfect care plan."
  }
/>
```

---

### File 2: `apps/website/src/components/modals/CustomizePlanModal.jsx`

#### Background:
1. **Props Header:**
   - `main` had: `title`, `badge`, `subtitle`, `successMsg`.
   - `staging` had added: `source = "Customize Plan Page"` for Zoho lead origin tracking.
   - **Resolution:** Retained all props including `source`.

2. **Email Sync & Tracking Script:**
   - `main` had injected a legacy client-side Zoho webform tracking script (`zoho-webform-tracking-1342119000000860003`).
   - `staging` had migrated custom plan submissions to **server-side API** (`POST /api/website/custom-plan`), which securely handles Zoho Leads on the backend without exposing Zoho credentials or running client-side tracking scripts.
   - **Resolution:** Retained the clean `useEffect` synchronizing `initialEmail` and auto-focusing the input; omitted the redundant client-side tracking script.

3. **Subtitle Styling:**
   - Both branches had identical text with minor newline formatting.
   - **Resolution:** Clean single-line `<p className="mt-1 text-sm text-slate-600 leading-relaxed">{subtitle}</p>`.

---

## 3. List of 8 Commits Brought from `main` into `staging`

| Commit Hash | Description | Key Files Affected |
|-------------|-------------|-------------------|
| `68afc46` / `68a072a` | Added GA4 tracking via environment variables and dynamic SPA pageview service | `apps/website/src/services/analytics.js`, `SeoHead.jsx`, `.env.production` |
| `81792f3` / `b3bbcd0` | Aligned sitemap, robots.txt, and metadata to `www.maihoonna.com` | `public/sitemap.xml`, `public/robots.txt` |
| `719cce4` | Pre-select Care Mitra packages and order before Saathi | `apps/website/src/pages/PlansPage.jsx` |
| `0f8b4a5` / `7f55d2b` / `89ef6ac` | Hero redesign, helpline badge, and waitlist modal email pre-fill | `apps/website/src/components/home/HeroSection.jsx`, `apps/website/src/App.jsx` |

---

## 4. How to Inspect, Revert, or Modify

### To view the exact changes in the merge commit:
```bash
git show 46b75c2
```

### To view only the two conflicted files in this merge:
```bash
git diff 46b75c2~1 46b75c2 -- apps/website/src/App.jsx apps/website/src/components/modals/CustomizePlanModal.jsx
```

### If you want to revert this merge completely:
```bash
git revert -m 1 46b75c2
```
*(This creates an inverse commit restoring staging to its exact pre-merge state while keeping git history safe).*

### If you want to change any specific prop or copy:
Directly edit `apps/website/src/App.jsx` or `apps/website/src/components/modals/CustomizePlanModal.jsx` and commit as normal.
