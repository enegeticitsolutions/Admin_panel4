# Production Deployment & Invoice Reconciliation Guide
## Standard Statutory Invoice PDF Engine & Numbering Normalization

> **Target Audience:** DevOps Engineers, Backend Engineers, System Administrators  
> **Applicable Environments:** Production (AWS EC2 / ECS / Ubuntu) & Staging  
> **Date:** October 2026  
> **Objective:** Transition invoice delivery from client-side HTML rendering to pre-generated statutory PDFs stored in Amazon S3, and normalize all historical invoice numbers sequentially.

---

## 1. What Changed in this Release?

1. **Direct S3 PDF Storage**:
   - Invoices are no longer rendered as raw HTML in the Mobile App or Admin Panel.
   - Canonical statutory A4 PDFs are rendered server-side via Puppeteer, uploaded directly to S3 (`invoices/MHN-INV-YYYY-YY-XXXXX.pdf`), and delivered via secure, time-limited presigned URLs (1-hour TTL).
   - Automatic on-demand generation fallback: if an existing invoice ever has `pdfUrl = null`, the API automatically renders and uploads it to S3 on the first view/download request.

2. **Sequential Canonical Numbering (`MHN/INV/YYYY-YY/XXXXX`)**:
   - All invoices follow Indian Financial Year statutory formatting (e.g. `MHN/INV/2026-27/00001` to `00262+`).
   - Manual admin activations that previously used legacy strings (e.g., `ADM-ACT-...`) now generate canonical invoices and sequential numbers via `generateInvoiceNumber(tx)`.
   - Initialized and updated the statutory sequence counter in `invoice_counters` to guarantee collision-free future numbers.

3. **100% Intact Calculation Rules**:
   - Zero changes to tax math, base prices, GST percentages (18%, CGST 9%, SGST 9%, IGST 18%), coupons, saathi discounts, or rounding.

---

## 2. Server Prerequisites (Ubuntu / AWS EC2)

Ensure the server has standard headless Chromium dependencies installed for Puppeteer PDF rendering:

```bash
# On Ubuntu / Debian server (one-time setup if not already present):
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

*(On Amazon Linux 2023: `sudo dnf install -y nss atk at-spi2-atk cups-libs libdrm libxkbcommon libXcomposite libXdamage libXfixes libXrandr mesa-libgbm pango cairo alsa-lib`)*

---

## 3. Step-by-Step Production Deployment Procedure

Execute all commands from the repository root (`/var/www/maihoonna` or your deployment directory):

### Step 1: Pull Latest Code & Install Dependencies
```bash
cd /var/www/maihoonna

# 1. Pull latest release code
git pull origin main

# 2. Install dependencies across all workspaces
npm install
```

---

### Step 2: Synchronize Database Schema (Add PDF Columns)
This pushes the two new non-breaking fields (`pdfUrl String?` and `pdfGeneratedAt DateTime?`) to the PostgreSQL `invoices` table and generates the updated Prisma Client.

```bash
npm run db:sync
```

---

### Step 3: Run Reconciliation Dry-Run (Verification Only)
Before making any database modifications, execute the dry-run command. This inspects all real payments in your production database and outputs what will be updated:

```bash
npm run invoices:reconcile:dry-run
```

**Expected Dry-Run Output:**
```
======================================================
  STARTING INVOICE RECONCILIATION (dryRun = true)
======================================================

Total successful payments found: 262
Reconciled all payments to invoice records.
[DRY RUN] Would assign sequential numbers MHN/INV/2026-27/00001 to 00262
```

---

### Step 4: Execute Live Reconciliation & S3 PDF Upload
Run the live reconciliation command. This will:
1. Create statutory `Invoice` records for any past payments that had none.
2. Sequentially renumber all historical invoices from `MHN/INV/2026-27/00001` upwards.
3. Synchronize `payment.invoiceNumber` and `payment.invoiceId` on all payment records.
4. Update the `invoice_counters` table for `2026-27` to match the latest sequence.
5. Generate standard A4 PDFs and upload them to your production S3 bucket (`invoices/MHN-INV-2026-27-XXXXX.pdf`).

```bash
npm run invoices:reconcile
```

*(Takes approximately 30–60 seconds for ~260 invoices).*

---

### Step 5: Build Monorepo & Restart Services
Rebuild shared packages and restart your API and backend services:

```bash
# 1. Build billing, notifications, and apps
npm run build:packages

# 2. Build API & Admin Backend
npm --prefix apps/api run build
npm --prefix apps/admin-frontend run build

# 3. Restart PM2 processes
pm2 restart all
```

*(If using Docker Compose: `docker compose build && docker compose up -d`)*

---

## 4. Post-Deployment Verification

Run this one-line command from the root to verify that your production database is 100% reconciled:

```bash
npx tsx -e "
import prisma from './apps/api/app/core/database';
async function main() {
  const invoiceCount = await prisma.invoice.count();
  const counter = await (prisma as any).invoiceCounter.findUnique({ where: { financialYear: '2026-27' } });
  const unlinkedPayments = await prisma.payment.count({ where: { paymentStatus: 'success', invoiceId: null } });
  const missingPdfs = await prisma.invoice.count({ where: { pdfUrl: null } });
  console.log({ invoiceCount, counter, unlinkedPayments, missingPdfs });
}
main().catch(console.error).finally(() => prisma.\$disconnect());
"
```

**Expected Result:**
- `invoiceCount`: Matches total successful payments
- `counter.lastCount`: Matches total successful payments
- `unlinkedPayments`: **0**
- `missingPdfs`: **0**

---

## 5. Rollback & Emergency Fallback
- All raw amounts, tax rates, CGST/SGST/IGST, customer IDs, and payment references were preserved exactly as recorded.
- In the event of any external S3 network issue, `apps/api` and `apps/admin-backend` continue serving the fallback endpoint `/subscriber/invoices/:id/html` and `/api/invoices/:id/html`.
- Invoices without existing PDFs will automatically generate and upload on-demand whenever requested.
