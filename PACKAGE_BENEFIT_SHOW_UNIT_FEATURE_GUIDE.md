# Package Benefit "Show Quantity/Unit" Feature & Bug Fix Guide

## 1. Overview & Business Requirement

In the Admin Panel's Subscription Package Wizard, each package benefit has a configuration toggle:
> **"Show quantity/unit to users on mobile app and website (Uncheck to only show benefit name)"**

### Marketing Strategy vs. Checkout Transparency
- **Marketing & Catalog Browsing (Website & Mobile App):**
  - **Checked (Default):** Displays quantity, unit, and cadence alongside the benefit name (e.g., `4 visits/month • General physician` or `Unlimited • 24/7 Care Coordination`).
  - **Unchecked:** Hides the quantity and frequency on marketing surfaces, showing only the clean benefit title (e.g., `General physician`) or marked as `Included` on comparison tables. This is utilized for marketing appeal where showcasing raw numbers upfront may detract from perceived value.
- **Checkout Page (Subscriber Transparency):**
  - Regardless of the marketing toggle, the **Checkout Page** purposefully **always shows the exact quantities and units** included. Subscribers must have 100% clarity and transparency on what they are paying for before finalizing their subscription.

---

## 2. Root Cause Analysis of the Issue

### The Bug
When an administrator unchecked *"Show quantity/unit to users"* and saved changes to an existing package, reopening the package to view or edit showed the checkbox **checked** again.

### Why It Happened
1. **Frontend State Hydration in Edit Mode (`SubscriptionsPage.tsx`):**
   - In `handleEdit(pkg)`, when reading `pkg.packageBenefits`, the config object `configs[bId]` populated `quantity`, `frequency`, `allocationBasis`, `minSubscriptionMonths`, `allowRollover`, `maxRolloverUnits`, and `isUnlimited`.
   - **`showUnit` was omitted** when constructing `configs[bId]`, leaving it `undefined`.
2. **Checkbox Default Truthiness:**
   - In Step 3 (*Set Units*), the checkbox checked condition was:
     ```tsx
     checked={cfg.showUnit !== false} // default true
     ```
   - Because `cfg.showUnit` was `undefined`, `undefined !== false` evaluated to `true`, forcing the UI to display the checkbox as checked every time an existing package was loaded.
3. **Re-saving Overwrite:**
   - Upon re-saving the package, `handlePublish` evaluated `cfg.showUnit !== undefined ? cfg.showUnit : true`, saving `true` back to the database.
4. **Backend Version Change Detection (`packageVersionHelper.js`):**
   - The package versioning helper compared differences between `pkg.packageBenefits` and `latestVersion.versionBenefits` across all fields except `showUnit`. A change purely to `showUnit` was not flagged as a change in benefit composition.

---

## 3. Step-by-Step Implementation

### Step 1: Fix Admin Frontend Hydration & Fallbacks
**File:** [`apps/admin-frontend/src/app/pages/SubscriptionsPage.tsx`](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/apps/admin-frontend/src/app/pages/SubscriptionsPage.tsx)

1. **Hydrate `showUnit` in `handleEdit`:**
   ```typescript
   configs[bId] = {
     quantity: qty,
     frequency: (b.unitsPeriod as any) || 'monthly',
     allocationBasis: (b.allocationBasis as any) || 'per_billing_cycle',
     minSubscriptionMonths: b.minSubscriptionMonths || 1,
     allowRollover: !!b.allowRollover,
     maxRolloverUnits: b.maxRolloverUnits || undefined,
     isUnlimited: !!b.isUnlimited,
     showUnit: b.showUnit !== undefined ? Boolean(b.showUnit) : true, // <-- Persist DB value
   };
   ```
2. **Explicit defaults in benefit state handlers:**
   - `initialSetting` in `toggleBenefit` sets `showUnit: true`.
   - Fallback objects in `updateUnits`, `updateBenefitSetting`, and `handlePublish` explicitly include `showUnit: true`.
3. **Admin Review Step Visual Feedback:**
   - Added a badge in Step 4 (*Review*) under each benefit indicating when units are hidden:
     ```tsx
     {cfg.showUnit === false && (
       <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
         Units hidden for users
       </span>
     )}
     ```

---

### Step 2: Backend Persistence & Coercion
**File:** [`apps/admin-backend/routes/packages.js`](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/apps/admin-backend/routes/packages.js)

Updated package creation (`POST /`), package update (`PUT /:id`), and benefit updates (`POST /:id/benefits`) to safely coerce boolean or string representations:
```javascript
showUnit: b.showUnit !== undefined && b.showUnit !== null 
  ? (b.showUnit === false || b.showUnit === 'false' ? false : true) 
  : true,
```

---

### Step 3: Package Versioning Change Detection
**File:** [`apps/admin-backend/utils/packageVersionHelper.js`](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/apps/admin-backend/utils/packageVersionHelper.js)

Added `c.showUnit !== p.showUnit` to the benefit comparison check so modifying `showUnit` triggers a version publish when applicable:
```javascript
if (
  c.benefitId !== p.benefitId ||
  c.unitsIncluded !== p.unitsIncluded ||
  c.unitsPeriod !== p.unitsPeriod ||
  c.allocationBasis !== p.allocationBasis ||
  c.minSubscriptionMonths !== p.minSubscriptionMonths ||
  c.allowRollover !== p.allowRollover ||
  c.maxRolloverUnits !== p.maxRolloverUnits ||
  c.isUnlimited !== p.isUnlimited ||
  c.showUnit !== p.showUnit // <-- Detect toggle change
) {
  benefitsChanged = true;
  break;
}
```

---

### Step 4: Marketing Surfaces vs. Checkout Separation

#### Marketing Touchpoints (Hide units when unchecked)
- **Website Package Cards:** [`apps/website/src/components/packages/PackageCard.jsx`](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/apps/website/src/components/packages/PackageCard.jsx)
  ```javascript
  if (pb.showUnit === false) {
    displayText = benefitName;
  }
  ```
- **Website Plan Details Modal:** [`apps/website/src/components/modals/PlanDetailsModal.jsx`](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/apps/website/src/components/modals/PlanDetailsModal.jsx)
  ```javascript
  if (pb.showUnit === false) {
    displayText = benefitName;
  }
  ```
- **Website Plan Comparison Table:** [`apps/website/src/pages/PlansPage.jsx`](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/apps/website/src/pages/PlansPage.jsx)
  ```javascript
  if (matchedPb.showUnit === false) {
    displayVal = "Included";
  }
  ```
- **Mobile Catalog Packages List:** [`apps/mobile-app/app/(setup)/subscription-packages.tsx`](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/apps/mobile-app/app/(setup)/subscription-packages.tsx)
  ```tsx
  {pb.showUnit !== false ? (
    <Text style={{ fontWeight: '800' }}>
      {pb.isUnlimited ? 'Unlimited' : `${baseUnit}${formattedLabel}${periodText}`}{' • '}
    </Text>
  ) : null}
  {formattedName}
  ```

#### Checkout Touchpoint (Always transparent)
- **Mobile Checkout:** [`apps/mobile-app/app/(setup)/checkout.tsx`](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/apps/mobile-app/app/(setup)/checkout.tsx)
  - Intentionally does **not** hide units. Subscribers see the full breakdown (e.g., `4 visits • General physician`) to guarantee 100% price and service clarity.
- **Website Checkout:** [`apps/website/src/pages/CheckoutPage.jsx`](file:///c:/Users/91930/OneDrive/Desktop/Mai-Hoonaa/apps/website/src/pages/CheckoutPage.jsx)
  - Restricted commitments exclusively to **3 Months**, **6 Months**, and **1 Year** (1 Month option removed).
  - Automatically initializes to the duration chosen on the plans page (defaulting to 3 months).

---

## 4. Database Schema Reference

Prisma models involved:
```prisma
model PackageBenefit {
  id                    String              @id @default(uuid())
  packageId             String
  benefitId             String
  unitsIncluded         Int                 @default(1)
  unitsPeriod           String              @default("monthly")
  showUnit              Boolean             @default(true)
  // ...
}

model PackageVersionBenefit {
  id                    String              @id @default(uuid())
  packageVersionId      String
  benefitId             String
  unitsIncluded         Int                 @default(1)
  unitsPeriod           String              @default("monthly")
  showUnit              Boolean             @default(true)
  // ...
}
```

---

## 5. Verification Checklist

1. **Admin Panel:**
   - [x] Edit an existing package and navigate to Step 3 (*Set Units*).
   - [x] Uncheck *"Show quantity/unit to users on mobile app and website"*.
   - [x] Review Step 4 shows the amber badge `"Units hidden for users"`.
   - [x] Click **Update Package**.
   - [x] Reopen the package via **Edit** — verify the checkbox remains **unchecked**.
2. **Website / Mobile Browsing:**
   - [x] Benefit shows only its title (e.g. `General physician`) without unit quantity.
   - [x] Comparison table shows `Included` rather than `X/month`.
3. **Checkout Screen:**
   - [x] Full units (e.g. `4 visits • General physician`) remain fully visible for subscriber transparency.
