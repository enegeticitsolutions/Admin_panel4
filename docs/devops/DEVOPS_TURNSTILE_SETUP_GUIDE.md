# DevOps Guide: Cloudflare Turnstile Captcha Setup (Ubuntu Live Server)

This guide is for DevOps engineers deploying or configuring **Cloudflare Turnstile Captcha** on Ubuntu live servers (Staging, Pre-Production, and Production) for the MaiHoonNa Admin Portal.

---

## 1. Quick Summary & Environments

Cloudflare Turnstile is configured across the web portals and APIs:
1. **Admin Portal (`apps/admin-frontend` & `apps/admin-backend`)** — Protects admin login against brute force.
2. **Website (`apps/website` & `apps/api`)** — Protects website login/registration and SMS/OTP gateway against bots.

### Environment Keys Catalog

> 🔒 **Security Notice**: Never commit production or live keys to Git. Inject them securely via AWS Secrets Manager, CI/CD secrets, or secure server environment variables.

| Environment | Frontend (`VITE_TURNSTILE_SITE_KEY`) | Backend (`TURNSTILE_SECRET_KEY`) |
| :--- | :--- | :--- |
| **STAGING** | `[STAGING_TURNSTILE_SITE_KEY]` | `[STAGING_TURNSTILE_SECRET_KEY]` |
| **PREPROD** | `[PREPROD_TURNSTILE_SITE_KEY]` | `[PREPROD_TURNSTILE_SECRET_KEY]` |
| **PRODUCTION** | `[PROD_TURNSTILE_SITE_KEY]` | `[PROD_TURNSTILE_SECRET_KEY]` |

---

## 2. Can It Work on an Ubuntu Live Server with Staging Keys?

**YES, absolutely!** However, there is **one critical Cloudflare requirement**:

> ⚠️ **Cloudflare Allowed Domains Requirement**:
> Cloudflare validates the domain name loaded in the user's browser.
> In your **Cloudflare Dashboard → Turnstile → [Your Staging Widget] → Settings**:
> Ensure the **Allowed Domains** list includes:
> - The live server's domain (e.g. `admin-staging.maihoonna.com` or `staging.maihoonna.com`)
> - Or the server's public IP (if accessing directly via IP)
> - `localhost` (for developer testing)
>
> If the live server domain is not in Cloudflare's allowed domains list, Turnstile will show an error: `"Domain not allowed" (error code 110600 / 40001)`.

---

## 3. Ubuntu Live Server Setup Instructions

### Step 1: Network & Firewall Prerequisites (Backend)
The Ubuntu server running `apps/admin-backend` makes outbound HTTPS requests to Cloudflare's verification API:
- **Destination:** `https://challenges.cloudflare.com/turnstile/v0/siteverify`
- **Port:** `443` (Outbound)

If you use `ufw` or strict AWS Security Groups, ensure outbound port 443 traffic to the internet is allowed:
```bash
# Verify outbound connectivity to Cloudflare from Ubuntu server
curl -I https://challenges.cloudflare.com/turnstile/v0/siteverify
# Should return HTTP 405 (Method Not Allowed) — confirming connectivity
```

---

### Step 2: Configure Admin Backend (`apps/admin-backend`)

#### Option A: Using `.env` File
In `/path/to/Mai-Hoonaa/apps/admin-backend/.env`:
```ini
# Add or update this line (replace with your environment secret key):
TURNSTILE_SECRET_KEY=[YOUR_TURNSTILE_SECRET_KEY]
```

#### Option B: Using PM2 / Systemd / Docker / AWS ECS
Pass `TURNSTILE_SECRET_KEY` into the process environment:
```bash
# In PM2 ecosystem.config.js:
env_staging: {
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY || "[YOUR_TURNSTILE_SECRET_KEY]",
}

# In Docker / Docker Compose / ECS Task Definition:
- e.g. TURNSTILE_SECRET_KEY=[YOUR_TURNSTILE_SECRET_KEY]
```

#### Restart Backend Service:
```bash
# If using PM2:
pm2 restart maihoonna-admin-backend

# If using systemd:
sudo systemctl restart maihoonna-admin-backend
```

---

### Step 3: Configure & Build Admin Frontend (`apps/admin-frontend`)

> ⚠️ **CRITICAL NOTE FOR VITE SPAs**:  
> Vite embeds `VITE_*` environment variables **during build time (`npm run build`)** into the static JavaScript bundles.  
> You cannot just change `.env` after building; **the frontend must be re-built** whenever the site key changes.

#### Building on Ubuntu Server:
```bash
cd /path/to/Mai-Hoonaa/apps/admin-frontend

# 1. Update .env or pass variable inline before building:
# Replace with your environment site key and API base URL:
export VITE_TURNSTILE_SITE_KEY="[YOUR_TURNSTILE_SITE_KEY]"
export VITE_API_BASE="https://admin-api-staging.maihoonna.com/api"

# 2. Run the build:
npm run build

# 3. Deploy the compiled files in dist/ to your web server (Nginx / S3 / Apache)
```

---

### Step 4: Nginx Reverse Proxy Configuration (Client IP Forwarding)

The backend records and verifies the client IP against Cloudflare to prevent IP-spoofing attacks. Ensure Nginx forwards the real client IP:

```nginx
# /etc/nginx/sites-available/admin-api
location /api/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Reload Nginx after updating:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 4. Verification Checklist for DevOps

1. **Frontend Check**:
   - Open the admin login page in browser (e.g. `https://admin-staging.maihoonna.com`).
   - Check if the "Security Verification" Turnstile widget appears below the password input.
   - Check that the checkmark turns green ("Success").
2. **Backend Check**:
   - Monitor backend logs during login:
     ```bash
     pm2 logs maihoonna-admin-backend
     # or journalctl -u maihoonna-admin-backend -f
     ```
   - Attempt login with valid phone and password.
   - Verify that login succeeds without `Security verification failed` error.
3. **Attack Test (Bypass probe)**:
   - Send a login request via curl without `turnstileToken`:
     ```bash
     curl -X POST https://admin-api-staging.maihoonna.com/api/auth/login \
       -H "Content-Type: application/json" \
       -d '{"phone":"9876543210","password":"password123"}'
     ```
   - Expected Response: `HTTP 400: "Security verification required. Please complete the captcha."`

---

## 5. Troubleshooting Common Issues

| Symptom | Cause | Resolution |
| :--- | :--- | :--- |
| **"Domain not allowed" in widget** | The server's hostname or IP is missing in Cloudflare Turnstile dashboard. | Add domain/IP to Cloudflare Dashboard → Turnstile → Widget Settings. |
| **Login button disabled indefinitely** | Turnstile failed to load or key is empty. | Check browser console network tab for blocked `challenges.cloudflare.com`. Verify `VITE_TURNSTILE_SITE_KEY` was included during `npm run build`. |
| **"Security verification failed" on submit** | Token expired or Secret Key mismatch. | Ensure `TURNSTILE_SECRET_KEY` in backend corresponds to the same environment as `VITE_TURNSTILE_SITE_KEY` on frontend. |
| **Backend error: Failed to verify security challenge** | Ubuntu server cannot reach Cloudflare API on port 443. | Check Ubuntu outbound firewall / security groups for HTTPS port 443. |
