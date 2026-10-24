# MaiHoonNa — Server Run & Deployment Guide
## Post-Billing & Centralized Invoice Engine Architecture

> **Target Audience:** DevOps Engineers, Backend Engineers, Cloud Administrators  
> **Environment:** Ubuntu Linux / AWS EC2 / Production & Staging Servers  
> **Last Updated:** October 2026

---

## 1. What Changed in the Runtime Architecture?

Following the billing refactor and statutory tax integration:

1. **Centralized Billing Package (`@maihoonna/billing`)**:
   - Financial mathematics, statutory invoice numbering (`MHN/INV/YYYY-YY/XXXXX`), pro-rata discount allocation, and tax resolution now live inside `packages/billing`.
   - Both `apps/api` (TypeScript) and `apps/admin-backend` (Node.js/CommonJS) depend on `@maihoonna/billing`.
   - **Crucial Rule:** `packages/billing` must be compiled (`tsc` to `dist/`) before either API can run. If missing, Node crashes with `Cannot find module '@maihoonna/billing'`.

2. **Database-Driven Benefit Tax Classifications**:
   - GST is no longer a hardcoded 18%.
   - Every Benefit has a statutory classification (`taxCategory`, `gstRate`, `hsnSacCode`, `isGstExempt`).
   - Intra-state (CGST + SGST) vs Inter-state (IGST) is computed dynamically based on Place of Supply (POS) and company state (`Haryana`).

3. **Lightweight Statutory HTML Invoices (No Puppeteer/Chromium on Server)**:
   - Invoices are rendered directly as self-contained statutory HTML documents via `/invoices/:id/html`.
   - Client applications (Mobile App & Admin UI) render/print PDF client-side or display the HTML directly.
   - **No headless Chrome/Chromium installation or high-RAM browser dependencies are needed on the server.**

4. **Decoupled Notification Queue (Redis Streams)**:
   - Payment confirmation and invoice generation trigger events processed asynchronously by `maihoonna-notification-worker` via Redis.

---

## 2. Server Architecture Overview

```
                          ┌──────────────────────────────────────────────┐
                          │             Nginx (Port 80 / 443)            │
                          └──────┬──────────────────┬─────────────────┬──┘
                                 │                  │                 │
                         /api/   │     /admin-api/  │         /admin  │
                                 ▼                  ▼                 ▼
                       ┌──────────────────┐ ┌───────────────┐ ┌────────────────┐
                       │  maihoonna-api   │ │ admin-backend │ │ admin-frontend │
                       │   (Port 8001)    │ │  (Port 3001)  │ │ (Static SPA)   │
                       └─────────┬────────┘ └───────┬───────┘ └────────────────┘
                                 │                  │
                                 │       Uses       │
                                 ▼                  ▼
                       ┌────────────────────────────────────┐
                       │      @maihoonna/billing (dist)     │
                       │      @maihoonna/database (Prisma)  │
                       └────────────────────────────────────┘
                                 │
                       ┌─────────▼──────────────────────────┐
                       │      Redis (ElastiCache / Local)   │
                       └─────────────────┬──────────────────┘
                                         │
                       ┌─────────────────▼──────────────────┐
                       │   maihoonna-notification-worker    │
                       │   (packages/notifications daemon)  │
                       └────────────────────────────────────┘
```

---

## 3. Step-by-Step Server Setup & Build Sequence

Execute all commands from the **monorepo root directory** (`/var/www/maihoonna` or your deployment directory):

### Step 1: Clone / Pull Latest Code & Install Monorepo Dependencies
```bash
cd /var/www/maihoonna

# Pull latest main branch
git pull origin main

# Install all workspace dependencies and create symlinks
npm install
```

---

### Step 2: Sync Prisma Database Client
```bash
# Push schema changes (or run migrations) and generate Prisma client
npm run db:sync
```

If initializing a fresh server or resetting config:
```bash
# Seed statutory company info (GSTIN, legal name, PAN, address for invoices)
npm run seed:config

# Ensure benefit tax categories & HSN/SAC codes exist in DB
npm run seed:benefit-types
```

---

### Step 3: Build Monorepo Shared Packages (CRITICAL)
This compiles TypeScript in `packages/billing` and `packages/notifications` into their respective `dist/` directories:

```bash
npm run build:packages
```

*(Alternatively, run manually if needed:)*
```bash
npm run build --workspace=@maihoonna/billing
npm run build --workspace=@maihoonna/notifications
```

---

### Step 4: Build Application Artifacts
```bash
# 1. Compile Primary API (TypeScript -> dist/app/run.js)
npm run build --workspace=apps/api

# 2. Build Admin Frontend (Vite static bundle -> apps/admin-frontend/dist)
npm run build --workspace=apps/admin-frontend
```

---

### Step 5: Environment Variables Checklist

Ensure `.env` files are configured in the corresponding application directories:

#### In `apps/api/.env`:
```ini
NODE_ENV=production
PORT=8001

# PostgreSQL
DATABASE_URL="postgresql://username:password@rds-host:5432/maihoonna?schema=public"

# Redis (for notifications & queues)
REDIS_HOST="127.0.0.1"
REDIS_PORT=6379
REDIS_PASSWORD=""

# Statutory Billing Configuration
COMPANY_STATE="Haryana"
COMPANY_NAME="MaiHoonNa Care Private Limited"
COMPANY_GSTIN="06XXXXX0000X1Z5"

# Security & Razorpay
JWT_SECRET="your-secure-jwt-secret"
RAZORPAY_KEY_ID="rzp_live_..."
RAZORPAY_KEY_SECRET="..."
RAZORPAY_WEBHOOK_SECRET="..."
```

#### In `apps/admin-backend/.env`:
```ini
NODE_ENV=production
PORT=3001
FRONTEND_URL="https://admin.maihoonna.com"

# PostgreSQL
DATABASE_URL="postgresql://username:password@rds-host:5432/maihoonna?schema=public"

# Redis
REDIS_HOST="127.0.0.1"
REDIS_PORT=6379
REDIS_PASSWORD=""

# Statutory Billing Configuration
COMPANY_STATE="Haryana"
```

---

## 4. Process Manager (PM2) Setup

Use `ecosystem.config.js` located in the root of the monorepo to manage all server daemons.

### Running with PM2:
```bash
# Start all 3 applications
pm2 start ecosystem.config.js

# Save process list so they automatically boot after server reboot
pm2 save
pm2 startup
```

### Zero-Downtime Reload After Git Pull:
```bash
git pull origin main
npm run build:packages
npm run build --workspace=apps/api
npm run build --workspace=apps/admin-frontend
pm2 reload ecosystem.config.js --update-env
```

---

## 5. Reverse Proxy Configuration (Nginx)

Place this configuration in `/etc/nginx/sites-available/maihoonna.conf`:

```nginx
server {
    listen 80;
    listen 443 ssl;
    server_name api.maihoonna.com admin.maihoonna.com;

    # SSL certificates (Let's Encrypt / ACM)
    # ssl_certificate /etc/letsencrypt/live/maihoonna.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/maihoonna.com/privkey.pem;

    client_max_body_size 50M;

    # 1. Primary API (apps/api on port 8001)
    location /api/ {
        # CVE-2026-111497 (Node2Shell) mitigation: reject Brotli-encoded request bodies
        # Remove this block once all servers are confirmed running Node.js >= 22.23.4
        if ($http_content_encoding = "br") {
            return 415;
        }

        proxy_pass http://127.0.0.1:8001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 2. Admin Backend API (apps/admin-backend on port 3001)
    location /admin-api/ {
        # CVE-2026-111497 (Node2Shell) mitigation: reject Brotli-encoded request bodies
        # Remove this block once all servers are confirmed running Node.js >= 22.23.4
        if ($http_content_encoding = "br") {
            return 415;
        }

        proxy_pass http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 3. Admin Frontend (Static Vite SPA)
    location /admin {
        alias /var/www/maihoonna/apps/admin-frontend/dist;
        try_files $uri $uri/ /admin/index.html;
    }

    # 4. Health Check
    location /health {
        proxy_pass http://127.0.0.1:8001/api/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

Enable the configuration and reload Nginx:
```bash
sudo ln -sf /etc/nginx/sites-available/maihoonna.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 6. Verification & Troubleshooting Checklist

| Test Case | Command / Action | Expected Result |
| :--- | :--- | :--- |
| **Check PM2 Status** | `pm2 status` | All processes (`maihoonna-api`, `maihoonna-admin-backend`, `maihoonna-notification-worker`) status = `online`. |
| **Check API Logs** | `pm2 logs maihoonna-api --lines 50` | `Server running on http://0.0.0.0:8001/api` without module import errors. |
| **Test Health Endpoint** | `curl http://localhost:8001/api/health` | `{"status":"ok",...}` |
| **Test Redis Queue** | `npm run redis:check` | `✅ Redis connection successful` |
| **Test Invoice HTML Endpoint** | `curl -I http://localhost:8001/api/subscriber/invoices/<INVOICE_ID>/html -H "Authorization: Bearer <TOKEN>"` | `HTTP/1.1 200 OK`, `Content-Type: text/html` |

### Common Issues & Quick Fixes

1. **`Error: Cannot find module '@maihoonna/billing'`**
   - **Cause:** `packages/billing` has not been compiled to `dist/`.
   - **Fix:** Run `npm run build:packages` from the root, then `pm2 restart all`.

2. **`PrismaClientInitializationError: Unable to connect to DB`**
   - **Cause:** Incorrect `DATABASE_URL` or missing Prisma client.
   - **Fix:** Check `.env` and run `npm run db:sync`.

3. **`Invoice shows 0% GST or missing SAC codes`**
   - **Cause:** Benefits in database are missing default tax classification columns.
   - **Fix:** Run `npm run seed:benefit-types` and `npm run seed:config`.
