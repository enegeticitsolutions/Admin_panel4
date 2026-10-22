# Production Invoice Update & Deployment Guide (Deployer Runbook)
## Transition from HTML Invoices to Statutory S3 PDFs & Sequential Normalization

> **Audience:** DevOps Engineers, System Administrators, Production Deployers  
> **Environment:** Production (Ubuntu / Debian / Amazon Linux / Docker / PM2)  
> **Applicable Version:** v1.0.0+ (October 2026 Invoice Architecture Release)  
> **Estimated Execution Time:** ~3–5 minutes (Zero Downtime)

---

## 1. Executive Summary: What Changed?

In this release:
1. **Direct S3 PDF Delivery**:
   - Replaced client-side raw HTML rendering in both **Admin Panel** and **Mobile App** with high-fidelity, server-rendered statutory A4 PDFs.
   - All invoice PDFs are generated using headless Chrome (Puppeteer) and stored directly in your cloud storage (`invoices/MHN-INV-YYYY-YY-XXXXX.pdf`).
   - Served securely to subscribers and administrators via time-limited presigned URLs (1-hour expiry).
2. **Sequential Numbering Normalization (`MHN/INV/YYYY-YY/XXXXX`)**:
   - All past and future invoices follow the statutory Indian Financial Year format (e.g., `MHN/INV/2026-27/00001` to `00262+`).
   - Fixed historical inconsistencies (such as `ADM-ACT-...` manual activation strings) by creating canonical `Invoice` records and linking them to their corresponding `Payment` records.
   - Initialized and updated the statutory sequence counter in `invoice_counters` to guarantee collision-free future numbers.
3. **100% Tax & Math Safety Guarantee**:
   - **Zero financial logic was modified**. All base prices, GST amounts (CGST 9%, SGST 9%, IGST 18%), coupons, discounts, and customer details remain strictly identical to the original transaction records.

---

## 2. Server Prerequisites

### A. Linux Headless Chrome Dependencies (Ubuntu / Debian)
If running on a standard Linux host (e.g., AWS EC2 Ubuntu or Debian), ensure the required shared libraries for Puppeteer headless Chrome are installed:

```bash
sudo apt-get update && sudo apt-get install -y \
  libnss3 \
  libnspr4 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libpango-1.0-0 \
  libcairo2 \
  libasound2
```

*(If running on Amazon Linux 2023: `sudo dnf install -y nss atk at-spi2-atk cups-libs libdrm libxkbcommon libXcomposite libXdamage libXfixes libXrandr mesa-libgbm pango cairo alsa-lib`)*

### B. Environment Variables Verification
Ensure your production `.env` (in `apps/api` and `apps/admin-backend`) contains:
- `DATABASE_URL` — Connection string to the production PostgreSQL database
- S3 / Storage credentials:
  - If using AWS S3: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET_NAME`
  - If using Supabase Storage: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`

---

## 3. Step-by-Step Deployment Runbook

Execute these commands from the root directory of the repository (`/var/www/maihoonna` or your deployment path):

### Step 1: Pull Latest Code & Install Dependencies
```bash
cd /var/www/maihoonna

# Pull the latest release
git pull origin main

# Install dependencies across all workspaces
npm install
```

---

### Step 2: Apply Database Schema Changes
This applies two new non-breaking columns (`pdfUrl String?` and `pdfGeneratedAt DateTime?`) to the `invoices` table and generates the latest Prisma client:

```bash
npm run db:sync
```

---

### Step 3: Run Reconciliation Dry-Run (Safe Inspection)
Before making any database updates, run the safe dry-run mode. This verifies the database connection, inspects all successful payments, identifies missing invoices, and simulates sequential renumbering without modifying any data:

```bash
npm run invoices:reconcile:dry-run
```

**Expected output summary:**
```
======================================================
  STARTING INVOICE RECONCILIATION (dryRun = true)
======================================================
Total successful payments found: <N>
Reconciled all payments to invoice records.
[DRY RUN] Would assign sequential numbers MHN/INV/2026-27/00001 to ...
======================================================
  RECONCILIATION SUMMARY (DRY RUN)
======================================================
```

---

### Step 4: Execute Live Reconciliation & S3 PDF Upload
Run the live reconciliation script. This performs the complete update:
1. Backfills statutory `Invoice` and `InvoiceItem` records for any past payments that lacked them.
2. Sequentially numbers all historical invoices starting from `MHN/INV/2026-27/00001`.
3. Synchronizes `invoiceNumber` and `invoiceId` on all `Payment` records.
4. Updates the `invoice_counters` table for `2026-27` to reflect the latest count.
5. Renders high-quality statutory A4 PDFs and uploads them to S3 storage (`invoices/MHN-INV-2026-27-XXXXX.pdf`).

```bash
npm run invoices:reconcile
```

> **Execution Time:** ~30–60 seconds for ~260 records. You will see progress logs with green checkmarks (`✓`) for each batch uploaded to S3.

---

### Step 5: Build Packages & Restart Production Services
Rebuild the monorepo packages and restart PM2 / systemd services:

```bash
# 1. Build billing, notifications, and shared packages
npm run build:packages

# 2. Build API and Admin Frontend
npm --prefix apps/api run build
npm --prefix apps/admin-frontend run build

# 3. Restart PM2 processes
pm2 restart all
```

*(If using Docker Compose: `docker compose build && docker compose up -d`)*

---

## 4. Post-Deployment Verification

### 1. Database Health Check (Run from Root)
Execute this one-liner to verify that the database is 100% reconciled:

```bash
npx tsx -e "
import prisma from './apps/api/app/core/database';
async function main() {
  const invoiceCount = await prisma.invoice.count();
  const counter = await (prisma as any).invoiceCounter.findUnique({ where: { financialYear: '2026-27' } });
  const unlinkedPayments = await prisma.payment.count({ where: { paymentStatus: 'success', invoiceId: null } });
  const missingPdfs = await prisma.invoice.count({ where: { pdfUrl: null } });
  console.log('\n--- VERIFICATION RESULT ---');
  console.log({
    'Total Invoices': invoiceCount,
    'FY 2026-27 Counter': counter?.lastCount,
    'Unlinked Successful Payments': unlinkedPayments,
    'Invoices Missing S3 PDF': missingPdfs
  });
}
main().catch(console.error).finally(() => prisma.\$disconnect());
"
```

**Passing Criteria:**
- `Total Invoices` = Matches total successful payments
- `FY 2026-27 Counter` = Matches total successful payments
- `Unlinked Successful Payments` = **0**
- `Invoices Missing S3 PDF` = **0**

---

### 2. Live API Test
Verify that the API returns a valid presigned S3 download URL:

```bash
# Replace <INVOICE_ID> and <JWT_TOKEN> with valid values:
curl -H "Authorization: Bearer <JWT_TOKEN>" \
  https://api.maihoonna.com/subscriber/invoices/<INVOICE_ID>/pdf-url
```

**Expected JSON Response:**
```json
{
  "success": true,
  "data": {
    "pdfUrl": "https://<your-bucket>.s3.<region>.amazonaws.com/invoices/MHN-INV-2026-27-00001.pdf?X-Amz-Algorithm=...",
    "invoiceNumber": "MHN/INV/2026-27/00001",
    "expiresIn": 3600
  }
}
```

---

## 5. Frequently Asked Questions & Troubleshooting

### Q1: Is this operation idempotent? Can I run it more than once?
**Yes.** The script checks existing invoices, sequence numbers, and S3 URLs. If you run it again, it will detect that all invoices are already sequentially numbered and have PDFs generated, completing in under 2 seconds.

### Q2: What if Puppeteer throws `error while loading shared libraries`?
This means one or more headless Linux graphic libraries are missing on your host. Simply run the `sudo apt-get install` command listed in **Section 2A** and rerun `npm run invoices:reconcile`.

### Q3: What happens if an invoice somehow doesn't have an S3 PDF yet?
We implemented an **automatic on-demand fallback**. Whenever any user (via Mobile App or Admin Panel) requests `/pdf-url` or `/pdf` for an invoice that lacks a stored PDF, the backend automatically generates the PDF, uploads it to S3, updates the database, and returns the presigned URL immediately.

### Q4: Does this require maintenance downtime?
**No.** All database migrations add optional nullable fields (`pdfUrl`, `pdfGeneratedAt`), and existing APIs remain backward-compatible throughout the deployment.
