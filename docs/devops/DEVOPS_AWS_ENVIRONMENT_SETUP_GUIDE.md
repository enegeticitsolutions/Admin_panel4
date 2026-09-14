# MaiHoonNa — Enterprise DevOps & AWS Multi-Environment Setup Guide

**Target Audience:** DevOps Engineers, Cloud Architects, Backend & Infrastructure Administrators  
**Environments Covered:** `Testing / Staging` ↔ `Pre-Production / Production`  
**Tech Stack:** Node.js (TypeScript & JavaScript), React Native (Expo / EAS), React (Vite SPA), AWS RDS PostgreSQL, AWS S3 (file storage), Redis (ElastiCache), AWS (ECS Fargate, ALB, Route 53, ACM, S3, CloudFront, Secrets Manager, RDS, ECR, IAM), GitHub Actions (CI/CD)

> ⚠️ **Important Note for DevOps:** Supabase is **only used locally by the developer** for personal development convenience. In all AWS-deployed environments (Staging and Production), we use **AWS RDS PostgreSQL** for the database and **AWS S3** for file/document storage. Do NOT configure Supabase in any deployed environment.

---

## Table of Contents

1. [Environment Isolation Philosophy & Architecture](#1-environment-isolation-philosophy--architecture)
2. [AWS Account, IAM & Permissions Setup](#2-aws-account-iam--permissions-setup)
3. [AWS Secrets Manager — Full Secret Schema](#3-aws-secrets-manager--full-secret-schema)
4. [Supabase Multi-Project Setup (Staging vs Production)](#4-supabase-multi-project-setup-staging-vs-production)
5. [Complete Environment Variable Key Catalog](#5-complete-environment-variable-key-catalog)
6. [AWS VPC, Networking & Security Groups](#6-aws-vpc-networking--security-groups)
7. [AWS ElastiCache (Redis) Setup](#7-aws-elasticache-redis-setup)
8. [AWS ECR — Docker Image Registry](#8-aws-ecr--docker-image-registry)
9. [Dockerfile Strategy for This Monorepo](#9-dockerfile-strategy-for-this-monorepo)
10. [AWS ECS Fargate — Cluster, Services & Task Definitions](#10-aws-ecs-fargate--cluster-services--task-definitions)
11. [Application Load Balancer (ALB) & Route 53 DNS Routing](#11-application-load-balancer-alb--route-53-dns-routing)
12. [SSL Certificates via AWS Certificate Manager (ACM)](#12-ssl-certificates-via-aws-certificate-manager-acm)
13. [Frontend Deployment — S3 + CloudFront](#13-frontend-deployment--s3--cloudfront)
14. [Mobile App Environment Switching — EAS / Expo](#14-mobile-app-environment-switching--eas--expo)
15. [CI/CD Pipeline — GitHub Actions](#15-cicd-pipeline--github-actions)
16. [Database Migration Strategy](#16-database-migration-strategy)
17. [Razorpay Environment Isolation (Test vs Live)](#17-razorpay-environment-isolation-test-vs-live)
18. [Third-Party API Keys — Staging vs Production Strategy](#18-third-party-api-keys--staging-vs-production-strategy)
19. [AWS CloudWatch — Logging & Alerting](#19-aws-cloudwatch--logging--alerting)
20. [Verification, Health Monitoring & Go-Live Checklist](#20-verification-health-monitoring--go-live-checklist)

---

## 1. Environment Isolation Philosophy & Architecture

The MaiHoonNa platform has a **mobile app (under Google Play & App Store review)**, which means the production backend must remain completely stable. **Any crash, API breakage, or DB corruption during review triggers app rejection.**

We enforce strict **resource-level isolation** — staging and production environments share **no database, no Redis instance, no S3 bucket, no API keys, and no secrets**.

```
             ┌─────────────────────────────────────────────────────────────────┐
             │                    AWS Route 53 (ap-south-1)                   │
             │  DNS Routing: *.maihoonna.com, *.maihoonna.in via ALB rules    │
             └────────────────────────┬────────────────────┬──────────────────┘
                                      │                    │
         ┌────────────────────────────┴──────┐   ┌────────┴───────────────────────────┐
         │   🟡 STAGING / TESTING           │   │   🟢 PRE-PROD / PRODUCTION          │
         │   Branch: staging / dev          │   │   Branch: main / production         │
         ├──────────────────────────────────┤   ├────────────────────────────────────┤
         │  ALB (Staging)                   │   │  ALB (Production)                  │
         │   ├── apps/api → Port 8001       │   │   ├── apps/api → Port 8001         │
         │   └── apps/admin-backend → 3001  │   │   └── apps/admin-backend → 3001    │
         ├──────────────────────────────────┤   ├────────────────────────────────────┤
         │  ECS Cluster: mhn-ecs-staging    │   │  ECS Cluster: mhn-ecs-production   │
         ├──────────────────────────────────┤   ├────────────────────────────────────┤
         │  AWS RDS PostgreSQL (Staging)    │   │  AWS RDS PostgreSQL (Production)    │
         │  Redis: ElastiCache (staging)    │   │  Redis: ElastiCache (prod, Multi-AZ)
         │  S3: maihoonna-assets-staging    │   │  S3: maihoonna-assets-prod         │
         │  Razorpay: rzp_test_...          │   │  Razorpay: rzp_live_...            │
         │  Secrets: /maihoonna/staging/env │   │  Secrets: /maihoonna/production/env│
         └──────────────────────────────────┘   └────────────────────────────────────┘
```

### Monorepo Service URL Mapping

| App | Description | Staging URL | Production URL |
| :--- | :--- | :--- | :--- |
| `apps/api` | Primary Backend API (TS, Port 8001) | `https://api-staging.maihoonna.com` | `https://api.maihoonna.com` |
| `apps/admin-backend` | Admin API (JS, Port 3001) | `https://admin-api-staging.maihoonna.com` | `https://admin-api.maihoonna.com` |
| `apps/admin-frontend` | Admin React SPA | `https://admin-staging.maihoonna.com` | `https://admin.maihoonna.com` |
| `apps/website` | Public Website React SPA | `https://staging.maihoonna.in` | `https://maihoonna.in` |
| `apps/mobile-app` | Beneficiary Expo App | Internal Staging APK/IPA | Google Play / App Store Release |
| `apps/sathi-app` | Sathi/CC Expo App | Internal Staging APK/IPA | Google Play / App Store Release |

---

## 2. AWS Account, IAM & Permissions Setup

### 2.1 Recommended AWS Account Structure
- Use **2 separate AWS accounts** for strict billing, permission, and blast-radius isolation:
  - `maihoonna-staging` AWS Account
  - `maihoonna-production` AWS Account
- If using a single account, separate using **Resource Tags** (`Env=staging`, `Env=production`) and separate IAM roles.

### 2.2 IAM Roles Required

| Role Name | Purpose | Minimum Permissions |
| :--- | :--- | :--- |
| `mhn-ecs-task-role-staging` | ECS Fargate tasks read Secrets Manager | `secretsmanager:GetSecretValue`, `ssm:GetParameter`, `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `logs:*` |
| `mhn-ecs-task-role-production` | Same as above for production | Same as above (production ARNs only) |
| `mhn-github-ci-role` | GitHub Actions CI/CD pipelines | `ecr:*`, `ecs:UpdateService`, `ecs:RegisterTaskDefinition`, `secretsmanager:GetSecretValue`, `s3:*`, `cloudfront:CreateInvalidation` |
| `mhn-developer-readonly` | Dev team read access to staging | Read-only on ECS, CloudWatch Logs, Secrets (no GetSecretValue on prod) |

### 2.3 IAM Policy for ECS Task (attach to `mhn-ecs-task-role-*`)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": "arn:aws:secretsmanager:ap-south-1:*:secret:/maihoonna/staging/*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::maihoonna-assets-staging/*"
    },
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "*"
    }
  ]
}
```

---

## 3. AWS Secrets Manager — Full Secret Schema

> **Rule:** Never commit `.env` files with real credentials to Git. Use Secrets Manager in all deployed environments.

### 3.1 Secret Paths
- Staging: `arn:aws:secretsmanager:ap-south-1:[ACCOUNT_ID]:secret:/maihoonna/staging/env`
- Production: `arn:aws:secretsmanager:ap-south-1:[ACCOUNT_ID]:secret:/maihoonna/production/env`

### 3.2 Staging Secret JSON (`/maihoonna/staging/env`)

> ✅ This uses **AWS RDS PostgreSQL** for the database and **AWS S3** for file storage. No Supabase keys are needed in deployed environments.

```json
{
  "NODE_ENV": "staging",

  "PORT_API": "8001",
  "PORT_ADMIN": "3001",
  "JSON_PAYLOAD_LIMIT": "2mb",
  "RATE_LIMIT_WINDOW_MS": "900000",
  "RATE_LIMIT_MAX_REQUESTS": "100",

  "DATABASE_URL": "postgresql://mhn_user:[PASSWORD]@mhn-rds-staging.[REGION].rds.amazonaws.com:5432/maihoonna_staging",
  "DIRECT_URL": "postgresql://mhn_user:[PASSWORD]@mhn-rds-staging.[REGION].rds.amazonaws.com:5432/maihoonna_staging",

  "REDIS_URL": "rediss://default:[REDIS_PASS]@staging-redis.[CLUSTER].cache.amazonaws.com:6379",

  "JWT_SECRET": "[GENERATE: openssl rand -hex 64]",
  "REFRESH_SECRET": "[GENERATE: openssl rand -hex 64]",
  "MHN_APP_SECRET": "mhn-staging-app-secret-2026",

  "STORAGE_PROVIDER": "s3",
  "STORAGE_BUCKET": "maihoonna-media-staging",
  "AWS_REGION": "ap-south-1",
  "AWS_S3_ENDPOINT": "",

  "RAZORPAY_KEY_ID": "rzp_test_T5r7EAjfxEsAtl",
  "RAZORPAY_KEY_SECRET": "iN51vfjUO62egk6oO9HRacAp",
  "RAZORPAY_WEBHOOK_SECRET": "maihoonna_webhook_staging_secret_2026",

  "OTP_PROVIDER": "stpl",
  "STPL_AUTH_KEY": "544982AdriN6ZrN96a674510P1",
  "STPL_TEMPLATE_ID": "6a7ad168541068a7320e4573",

  "SMS_PROVIDER": "msg91",
  "MSG91_AUTH_KEY": "544982AdriN6ZrN96a674510P1",
  "MSG91_SENDER_ID": "MAHOON",
  "MSG91_FLOW_TEMPLATE_ID": "[STAGING_TEMPLATE_ID]",
  "MSG91_WHATSAPP_NUMBER": "918527070049",
  "MSG91_WHATSAPP_OTP_TEMPLATE": "otp",
  "MSG91_WHATSAPP_NAMESPACE": "bf28acb3_8719_4168_9ed4_bc225dcfe30d",

  "WHATSAPP_PROVIDER": "msg91",
  "ENABLE_WHATSAPP_NOTIFICATIONS": "false",

  "EMAIL_HOST": "smtppro.zoho.in",
  "EMAIL_PORT": "465",
  "EMAIL_USER": "info@maihoonna.com",
  "EMAIL_PASS": "[ZOHO_APP_SPECIFIC_PASSWORD]",
  "WAITLIST_RECIPIENT_EMAIL": "info@maihoonna.com",
  "FRONTEND_URL": "https://staging.maihoonna.in",

  "GOOGLE_MAPS_API_KEY": "[STAGING_RESTRICTED_MAPS_KEY]",
  "GEOFENCE_RADIUS_METERS": "50",
  "MAX_SERVICE_RADIUS_KM": "50",

  "VISIT_IMAGE_MAX_COUNT": "10",
  "VISIT_IMAGE_MAX_SIZE_MB": "25",
  "VISIT_IMAGE_ALLOWED_TYPES": "image/jpeg,image/png,image/webp,image/heic,image/heif",

  "ZOHO_CRM_XNQSJSDP": "[ZOHO_KEY]",
  "ZOHO_CRM_XMIWTLD": "[ZOHO_KEY]",
  "ZOHO_CRM_ACTION_TYPE": "TGVhZHM=",
  "ZOHO_CRM_RETURN_URL": "https://staging.maihoonna.in/thank-you",

  "CORS_ORIGIN": "https://staging.maihoonna.in,https://admin-staging.maihoonna.com",

  "PUBSUB_DRIVER": "redis",
  "ENABLE_PUBSUB_WORKER": "true"
}
```

### 3.3 Production Secret JSON (`/maihoonna/production/env`)
> Same schema as above, with these key differences:
- `DATABASE_URL` → Production AWS RDS PostgreSQL endpoint (`mhn-rds-prod.[REGION].rds.amazonaws.com`)
- `DIRECT_URL` → Same as `DATABASE_URL` for RDS (no connection pooler distinction needed — use RDS Proxy if needed)
- `RAZORPAY_KEY_ID` → `rzp_live_...` (switch to live key)
- `RAZORPAY_KEY_SECRET` → Live secret from Razorpay Dashboard
- `STORAGE_BUCKET` → `maihoonna-staff-documents-prod`
- `REDIS_URL` → Production ElastiCache endpoint (`rediss://...`)
- `ENABLE_WHATSAPP_NOTIFICATIONS` → `true`
- `CORS_ORIGIN` → `https://maihoonna.in,https://admin.maihoonna.com`
- `FRONTEND_URL` → `https://maihoonna.in`
- `GOOGLE_MAPS_API_KEY` → Production IP-restricted Maps key

### 3.4 Creating Secrets via AWS CLI
```bash
# Create Staging Secret
aws secretsmanager create-secret \
  --name "/maihoonna/staging/env" \
  --description "MaiHoonNa Staging Environment Variables" \
  --secret-string file://secrets/staging.json \
  --region ap-south-1

# Create Production Secret
aws secretsmanager create-secret \
  --name "/maihoonna/production/env" \
  --description "MaiHoonNa Production Environment Variables" \
  --secret-string file://secrets/production.json \
  --region ap-south-1

# Update an existing secret value
aws secretsmanager put-secret-value \
  --secret-id "/maihoonna/staging/env" \
  --secret-string file://secrets/staging.json \
  --region ap-south-1
```

---

## 4. AWS RDS PostgreSQL Database Setup

> ⚠️ **Supabase is NOT used in deployed environments.** It is only the developer's personal local database for development. On AWS, we use **AWS RDS PostgreSQL**.

### 4.1 Why AWS RDS (Not Supabase) for Deployed Environments?
- **Full VPC isolation**: RDS lives inside the private subnet — no public internet access. Zero exposure unlike Supabase poolers.
- **IAM-based access**: ECS tasks connect via IAM authentication (no hardcoded passwords in transit).
- **RDS Proxy**: AWS RDS Proxy handles connection pooling at the managed layer, replacing PgBouncer/Supabase pooler.
- **Automated backups**: Point-in-time recovery (PITR) up to 35 days, cross-region backup copies.
- **No vendor lock-in**: We own the full PostgreSQL instance, no Supabase row-level-security or API layer involved.

### 4.2 AWS RDS PostgreSQL Instance Setup

#### Staging RDS Instance
1. Go to **AWS RDS → Create database → Standard Create**.
2. **Engine:** PostgreSQL 16 (latest stable)
3. **Template:** Free Tier (staging) or Dev/Test
4. **DB instance identifier:** `mhn-rds-staging`
5. **Master username:** `mhn_user`
6. **Master password:** Generate strong password → store in AWS Secrets Manager
7. **Instance class:** `db.t4g.micro` (staging, lowest cost)
8. **Storage:** 20 GB gp3, enable autoscaling up to 100 GB
9. **VPC:** `mhn-vpc`
10. **Subnet Group:** Create DB subnet group using `mhn-private-1a` and `mhn-private-1b`
11. **Public access:** **No** (private subnet only)
12. **Security Group:** Create `mhn-sg-rds` — allow Port 5432 inbound only from `mhn-sg-ecs-api` and `mhn-sg-ecs-admin`
13. **Initial database name:** `maihoonna_staging`
14. **Automated backups:** Enabled, 7-day retention
15. **Encryption:** Enabled (AWS managed key)

#### Production RDS Instance
Same as staging, except:
- **Instance class:** `db.t4g.small` or `db.t4g.medium` depending on load
- **Multi-AZ:** **Enabled** (automatic failover to standby in another AZ)
- **DB identifier:** `mhn-rds-production`
- **Initial database name:** `maihoonna_production`
- **Backup retention:** 35 days
- **Enable Performance Insights:** Yes (7-day retention)
- **Enable Enhanced Monitoring:** Yes (60-second granularity)

### 4.3 RDS Security Group (`mhn-sg-rds`)
```
Inbound Rules:
  - Port 5432 (PostgreSQL) from Security Group: mhn-sg-ecs-api
  - Port 5432 (PostgreSQL) from Security Group: mhn-sg-ecs-admin
  - Port 5432 (PostgreSQL) from Security Group: mhn-sg-bastion (for admin/migration access)

Outbound Rules:
  - None (RDS does not initiate outbound connections)
```

### 4.4 RDS Proxy Setup (Production — Connection Pooling)
For production, use **AWS RDS Proxy** to handle connection pooling (replaces Supabase pooler):
1. Go to **RDS → Proxies → Create proxy**
2. **Engine:** PostgreSQL
3. **Target:** `mhn-rds-production`
4. **Secrets:** Point to the RDS master credentials secret in Secrets Manager
5. **VPC:** `mhn-vpc`, private subnets
6. **IAM authentication:** Enabled
7. The proxy endpoint becomes your `DATABASE_URL` for production ECS tasks

### 4.5 Database Connection Strings for AWS RDS
```
# Staging (direct RDS — no proxy needed)
DATABASE_URL=postgresql://mhn_user:[PASSWORD]@mhn-rds-staging.[ID].ap-south-1.rds.amazonaws.com:5432/maihoonna_staging
DIRECT_URL=postgresql://mhn_user:[PASSWORD]@mhn-rds-staging.[ID].ap-south-1.rds.amazonaws.com:5432/maihoonna_staging

# Production (via RDS Proxy for runtime; direct endpoint for migrations)
DATABASE_URL=postgresql://mhn_user:[PASSWORD]@mhn-rds-proxy.[ID].ap-south-1.rds.amazonaws.com:5432/maihoonna_production
DIRECT_URL=postgresql://mhn_user:[PASSWORD]@mhn-rds-production.[ID].ap-south-1.rds.amazonaws.com:5432/maihoonna_production
```

### 4.6 AWS S3 Storage Setup (Replaces Supabase Storage)

| Bucket Name | Environment | Purpose | Public Access |
| :--- | :--- | :--- | :--- |
| `maihoonna-staff-documents-staging` | Staging | Staff documents, profile photos | Block all public access |
| `maihoonna-visit-attachments-staging` | Staging | Visit photos uploaded by Care Companions | Block all public access |
| `maihoonna-staff-documents-prod` | Production | Staff documents | Block all public access |
| `maihoonna-visit-attachments-prod` | Production | Visit photos | Block all public access |

**S3 Bucket Creation:**
```bash
# Staging buckets
aws s3api create-bucket \
  --bucket maihoonna-staff-documents-staging \
  --region ap-south-1 \
  --create-bucket-configuration LocationConstraint=ap-south-1

aws s3api put-public-access-block \
  --bucket maihoonna-staff-documents-staging \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# Enable server-side encryption
aws s3api put-bucket-encryption \
  --bucket maihoonna-staff-documents-staging \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
```

**S3 CORS Configuration** (allow `PUT` from admin frontend for direct uploads):
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["https://admin-staging.maihoonna.com"],
    "ExposeHeaders": ["ETag"]
  }
]
```

### 4.7 Prisma Schema — AWS RDS Connection Mode
With AWS RDS, both `DATABASE_URL` and `DIRECT_URL` point to the same host (RDS Proxy for runtime, direct for migrations):
```prisma
// packages/database/prisma/schema.prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // RDS Proxy endpoint — runtime queries
  directUrl = env("DIRECT_URL")     // Direct RDS endpoint — prisma migrate only
}
```

---

## 5. Complete Environment Variable Key Catalog

> ⚠️ **No Supabase keys appear in this section.** AWS RDS is used for the database and AWS S3 for storage in all deployed environments. The ECS Task IAM role (`mhn-ecs-task-role-*`) provides S3 access automatically — no static S3 access keys needed if using IAM roles.

### 5.1 Backend Keys — `apps/api` (Port 8001)

| Key | Staging | Production | Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | `staging` | `production` | Runtime mode. Controls Prisma logging, error stack visibility. |
| `PORT` | `8001` | `8001` | Express server port |
| `DATABASE_URL` | Staging RDS endpoint (via RDS direct) | Prod RDS Proxy endpoint | Runtime DB connection — AWS RDS PostgreSQL |
| `DIRECT_URL` | Staging RDS direct endpoint | Prod RDS direct endpoint (not Proxy) | Prisma migrations only |
| `REDIS_URL` | Staging ElastiCache (`rediss://`) | Prod ElastiCache | Pub/Sub event bus |
| `JWT_SECRET` | Staging 64-char hex | Prod 64-char hex | Signs auth tokens. Different per env. |
| `REFRESH_SECRET` | Staging 64-char hex | Prod 64-char hex | Signs refresh tokens |
| `MHN_APP_SECRET` | Staging secret | Prod secret | Mobile app API secret header validation |
| `CORS_ORIGIN` | Staging URLs comma-separated | Production URLs comma-separated | Allowed frontend origins |
| `RAZORPAY_KEY_ID` | `rzp_test_...` | `rzp_live_...` | Razorpay gateway key |
| `RAZORPAY_KEY_SECRET` | Test secret | Live secret | Razorpay payment operations |
| `RAZORPAY_WEBHOOK_SECRET` | Staging HMAC secret | Prod HMAC secret | Webhook signature verification |
| `STORAGE_PROVIDER` | `s3` | `s3` | Use AWS S3 — NOT supabase |
| `STORAGE_BUCKET` | `maihoonna-staff-documents-staging` | `maihoonna-staff-documents-prod` | S3 bucket name for file uploads |
| `AWS_REGION` | `ap-south-1` | `ap-south-1` | AWS region for S3 operations |
| `STPL_AUTH_KEY` | Staging OTP key | Prod OTP key | STPL SMS OTP provider |
| `STPL_TEMPLATE_ID` | Staging template | Prod template | STPL SMS OTP template |
| `MSG91_AUTH_KEY` | Staging MSG91 key | Prod MSG91 key | MSG91 WhatsApp & SMS |
| `MSG91_WHATSAPP_NUMBER` | Staging number | Prod number | MSG91 sender number |
| `EMAIL_HOST` | `smtppro.zoho.in` | `smtppro.zoho.in` | SMTP provider |
| `EMAIL_USER` | info@maihoonna.com | info@maihoonna.com | Zoho email sender |
| `EMAIL_PASS` | Zoho app password | Zoho app password | Email auth |
| `GOOGLE_MAPS_API_KEY` | Staging restricted key | Prod restricted key | Geocoding, geofencing |
| `GEOFENCE_RADIUS_METERS` | `50` | `50` | Check-in geofence radius |
| `VISIT_IMAGE_MAX_COUNT` | `10` | `10` | Max images per visit |
| `PUBSUB_DRIVER` | `memory` or `redis` | `redis` | Pub/Sub driver selection |

### 5.2 Admin Backend Keys — `apps/admin-backend` (Port 3001)

| Key | Staging | Production | Notes |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Staging RDS endpoint | Prod RDS Proxy endpoint | Same RDS instance as `apps/api` within same env |
| `DIRECT_URL` | Staging RDS direct | Prod RDS direct | Prisma migrations only |
| `JWT_SECRET` | Staging JWT secret | Prod JWT secret | **Must match `apps/api` within same env** |
| `REFRESH_SECRET` | Staging refresh secret | Prod refresh secret | **Must match `apps/api`** |
| `RAZORPAY_KEY_ID` | `rzp_test_...` | `rzp_live_...` | Razorpay |
| `RAZORPAY_WEBHOOK_SECRET` | Staging HMAC | Prod HMAC | Webhook verification |
| `FRONTEND_URL` | Staging admin URL | Prod admin URL | CORS allowed origin |
| `STORAGE_PROVIDER` | `s3` | `s3` | AWS S3 file storage |
| `STORAGE_BUCKET` | `maihoonna-staff-documents-staging` | `maihoonna-staff-documents-prod` | S3 bucket |
| `AWS_REGION` | `ap-south-1` | `ap-south-1` | Region for S3 |
| `GOOGLE_MAPS_API_KEY` | Staging restricted key | Prod restricted key | Location validation |

### 5.3 Admin Frontend Keys — `apps/admin-frontend` (Vite SPA, `VITE_*` prefix)

> ℹ️ The admin frontend uploads files directly to S3 via **pre-signed URLs** generated by `apps/admin-backend`. No S3 or Supabase keys are needed in the frontend.

| Key | Staging | Production | Notes |
| :--- | :--- | :--- | :--- |
| `VITE_API_BASE` | `https://admin-api-staging.maihoonna.com/api` | `https://admin-api.maihoonna.com/api` | Admin backend base URL |
| `VITE_GATEKEEPER_PASSCODE` | Staging passcode | Prod passcode | UI access gate |
| `VITE_ENABLE_GATEKEEPER` | `true` | `true` | Feature flag |

### 5.4 Website Keys — `apps/website` (Vite SPA, `VITE_*` prefix)

| Key | Staging | Production | Notes |
| :--- | :--- | :--- | :--- |
| `VITE_API_URL` | `https://api-staging.maihoonna.com/api` | `https://api.maihoonna.com/api` | Public API URL |
| `VITE_RAZORPAY_KEY_ID` | `rzp_test_...` | `rzp_live_...` | Razorpay checkout in browser |
| `VITE_GATEKEEPER_PASSCODE` | Staging passcode | Prod passcode | Soft gate for beta access |
| `VITE_ENABLE_GATEKEEPER` | `true` | `false` | Disable gate on production |

### 5.5 Mobile App Keys — `apps/mobile-app` (Expo, `EXPO_PUBLIC_*` prefix)

| Key | Staging | Production | Notes |
| :--- | :--- | :--- | :--- |
| `EXPO_PUBLIC_ENV` | `staging` | `production` | Master environment switch |
| `EXPO_PUBLIC_PRODUCTION_API_URL` | `https://api-staging.maihoonna.com/app-api/` | `https://api.maihoonna.com/app-api/` | API base URL |
| `EXPO_PUBLIC_ENABLE_PASSWORD_LOGIN` | `true` | `false` | Testing flag. Must be `false` for store release |
| `EXPO_PUBLIC_RAZORPAY_KEY_ID` | `rzp_test_...` | `rzp_live_...` | Payment key |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Staging Maps key | Prod Maps key | Android Google Maps |
| `EXPO_PUBLIC_APP_SECRET` | Staging secret | Prod secret | Request signing header |
| `EXPO_TOKEN` | CI/CD only — never expose | Same | EAS build token |
| `EAS_PROJECT_ID` | `decebbbc-fb40-...` | Same (project ID is fixed) | Expo EAS project |

### 5.6 Sathi App Keys — `apps/sathi-app` (Expo, `EXPO_PUBLIC_*` prefix)

| Key | Staging | Production | Notes |
| :--- | :--- | :--- | :--- |
| `EXPO_PUBLIC_ENV` | `staging` | `production` | API target switch |
| `EXPO_PUBLIC_PRODUCTION_API_URL` | `https://api-staging.maihoonna.com/app-api/` | `https://api.maihoonna.com/app-api/` | API base URL |
| `EXPO_PUBLIC_ENABLE_PASSWORD_LOGIN` | `true` | `false` | `false` in store release |
| `EXPO_PUBLIC_RAZORPAY_KEY_ID` | `rzp_test_...` | `rzp_live_...` | Payment |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS` | Staging iOS Maps key | Prod iOS Maps key | iOS Google Maps |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID` | Staging Android Maps key | Prod Android Maps key | Android Google Maps |
| `EXPO_PUBLIC_APP_SECRET` | Staging secret | Prod secret | Header auth |
| `EXPO_TOKEN` | CI/CD only | Same | EAS token |
| `EAS_PROJECT_ID` | `7c449368-29dc-...` | Same | Fixed project ID |

---

## 6. AWS VPC, Networking & Security Groups

### 6.1 VPC Configuration
1. **Region:** `ap-south-1` (Mumbai — closest to India users)
2. **VPC CIDR:** `10.0.0.0/16`
3. **Name:** `mhn-vpc`
4. Enable **DNS hostnames** and **DNS resolution** on the VPC.

### 6.2 Subnets (create in 2 Availability Zones for HA)

| Subnet Name | CIDR | AZ | Type | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `mhn-public-1a` | `10.0.1.0/24` | ap-south-1a | Public | ALB node A |
| `mhn-public-1b` | `10.0.2.0/24` | ap-south-1b | Public | ALB node B |
| `mhn-private-1a` | `10.0.3.0/24` | ap-south-1a | Private | ECS tasks, Redis |
| `mhn-private-1b` | `10.0.4.0/24` | ap-south-1b | Private | ECS tasks, Redis |

### 6.3 Internet Gateway & NAT Gateway
1. Create and attach an **Internet Gateway (IGW)** to `mhn-vpc`.
2. Create a **NAT Gateway** in `mhn-public-1a` with an Elastic IP. This allows ECS tasks in private subnets to reach the internet (MSG91, Razorpay, Zoho, Google Maps, etc.) without being publicly accessible. Note: AWS RDS and ElastiCache are accessed within the VPC — they do NOT go through NAT.
3. Route Tables:
   - Public subnets: Route `0.0.0.0/0` → IGW
   - Private subnets: Route `0.0.0.0/0` → NAT Gateway

### 6.4 Security Groups

| SG Name | Inbound Rules | Outbound | Attached To |
| :--- | :--- | :--- | :--- |
| `mhn-sg-alb` | Port 80, 443 from `0.0.0.0/0` | All | ALB |
| `mhn-sg-ecs-api` | Port 8001 from `mhn-sg-alb` only | All | ECS api tasks |
| `mhn-sg-ecs-admin` | Port 3001 from `mhn-sg-alb` only | All | ECS admin tasks |
| `mhn-sg-redis` | Port 6379 from `mhn-sg-ecs-api`, `mhn-sg-ecs-admin` | None | ElastiCache |
| `mhn-sg-rds` | Port 5432 from `mhn-sg-ecs-api`, `mhn-sg-ecs-admin`, `mhn-sg-bastion` | None | RDS PostgreSQL |
| `mhn-sg-bastion` | Port 22 from your office/dev IP only | All | EC2 Bastion (for DB migrations) |

> **Critical Security Rules:**
> - Never allow Port 6379 (Redis) from `0.0.0.0/0` — VPC only.
> - Never allow Port 5432 (PostgreSQL) from `0.0.0.0/0` — VPC only.
> - RDS has **no public access**. Migrations run via a Bastion EC2 or ECS migration task inside the VPC.

---

## 7. AWS ElastiCache (Redis) Setup

> 📘 **Dedicated Notification Microservice Guide**: For detailed stream topologies, worker containerization (`Dockerfile.worker`), consumer group auto-claim (`XAUTOCLAIM`), and CloudWatch alarms, refer to [REDIS_DEPLOYMENT_AND_DEVOPS_GUIDE.md](./REDIS_DEPLOYMENT_AND_DEVOPS_GUIDE.md).

### 7.1 Why Redis?
- **Decoupled Notification Microservice Broker**: Powers the high-throughput Redis Streams (`stream:notifications:whatsapp`, `stream:notifications:push`, `stream:notifications:email`) for `@maihoonna/notifications` and background worker daemon.
- **Pub/Sub Event Bus Driver**: Used for cross-process event communication between `apps/api` and `apps/admin-backend` (live WebSocket updates, SOS alerts).

### 7.2 Staging Redis Setup
1. Go to **ElastiCache → Redis OSS caches → Create**.
2. **Cluster Mode:** Disabled (single node for staging)
3. **Node type:** `cache.t4g.micro` (cheapest, sufficient for staging)
4. **Subnet Group:** Select `mhn-private-1a`, `mhn-private-1b`
5. **Security Group:** `mhn-sg-redis`
6. **At-rest encryption:** Enabled
7. **In-transit encryption (TLS):** Enabled
8. **Note the endpoint:** `staging-redis.xxxxx.cache.amazonaws.com:6379`

### 7.3 Production Redis Setup
1. Same as above, except:
2. **Cluster Mode:** Disabled, but enable **Multi-AZ with Auto-Failover**
3. **Node type:** `cache.t4g.small` or `cache.r7g.large` depending on load
4. **Replicas per shard:** 1 (Primary + 1 read replica for HA)
5. **Backup:** Enable daily snapshot

### 7.4 Redis URL Format for `REDIS_URL`
```
# Without TLS (simpler, if in-transit encryption is off for dev)
redis://[ENDPOINT]:6379

# With TLS (recommended for production)
rediss://[ENDPOINT]:6379

# With auth token (if Redis AUTH is enabled)
rediss://default:[AUTH_TOKEN]@[ENDPOINT]:6379
```

---

## 8. AWS ECR — Docker Image Registry

### 8.1 Create ECR Repositories

```bash
# Create repos for staging
aws ecr create-repository --repository-name mhn-api-staging --region ap-south-1
aws ecr create-repository --repository-name mhn-admin-backend-staging --region ap-south-1

# Create repos for production
aws ecr create-repository --repository-name mhn-api-production --region ap-south-1
aws ecr create-repository --repository-name mhn-admin-backend-production --region ap-south-1
```

### 8.2 ECR Image Lifecycle Policy (Recommended)
Prevent unbounded image accumulation — keep last 10 images per repo:
```json
{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Keep last 10 images",
      "selection": {
        "tagStatus": "any",
        "countType": "imageCountMoreThan",
        "countNumber": 10
      },
      "action": { "type": "expire" }
    }
  ]
}
```

---

## 9. Dockerfile Strategy for This Monorepo

This is a **monorepo** (single `package.json` root, `packages/` shared libs, `apps/` per service). Docker builds must copy the correct layers to avoid bloat.

### 9.1 Dockerfile for `apps/api`
```dockerfile
# ─── Stage 1: Dependencies ────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
COPY packages/database/package.json ./packages/database/
COPY packages/notifications/package.json ./packages/notifications/
COPY apps/api/package.json ./apps/api/
RUN npm ci --workspace=apps/api

# ─── Stage 2: Build ───────────────────────────────────────────────────────────
FROM deps AS build
COPY packages ./packages
COPY apps/api ./apps/api
WORKDIR /app/apps/api
RUN npx prisma generate --schema=../../packages/database/prisma/schema.prisma
RUN npm run build

# ─── Stage 3: Runner (minimal image) ─────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 8001
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:8001/health || exit 1
CMD ["node", "apps/api/dist/app/run.js"]
```

### 9.2 Dockerfile for `apps/admin-backend`
```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
COPY packages/database/package.json ./packages/database/
COPY packages/notifications/package.json ./packages/notifications/
COPY apps/admin-backend/package.json ./apps/admin-backend/
RUN npm ci --workspace=apps/admin-backend

FROM deps AS runner
COPY packages ./packages
COPY apps/admin-backend ./apps/admin-backend
WORKDIR /app
ENV NODE_ENV=production
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1
CMD ["node", "apps/admin-backend/server.js"]
```

---

## 10. AWS ECS Fargate — Cluster, Services & Task Definitions

### 10.1 Create ECS Clusters
```bash
aws ecs create-cluster --cluster-name mhn-ecs-staging --region ap-south-1
aws ecs create-cluster --cluster-name mhn-ecs-production --region ap-south-1
```

### 10.2 Task Definition Structure (ECS Task Definition JSON)

Key fields to set in Task Definitions:
- **`taskRoleArn`**: `mhn-ecs-task-role-staging` — allows secrets access & S3
- **`executionRoleArn`**: `ecsTaskExecutionRole` — allows ECS to pull ECR images & write logs
- **`networkMode`**: `awsvpc`
- **`cpu`**: `512` (staging), `1024` (prod)
- **`memory`**: `1024` (staging), `2048` (prod)

#### Secret Injection from AWS Secrets Manager in Task Definition
```json
{
  "name": "mhn-api-staging",
  "image": "[ACCOUNT_ID].dkr.ecr.ap-south-1.amazonaws.com/mhn-api-staging:latest",
  "portMappings": [{ "containerPort": 8001, "protocol": "tcp" }],
  "secrets": [
    { "name": "NODE_ENV", "valueFrom": "arn:aws:secretsmanager:ap-south-1:[ACCOUNT]:secret:/maihoonna/staging/env:NODE_ENV::" },
    { "name": "DATABASE_URL", "valueFrom": "arn:aws:secretsmanager:ap-south-1:[ACCOUNT]:secret:/maihoonna/staging/env:DATABASE_URL::" },
    { "name": "DIRECT_URL", "valueFrom": "arn:aws:secretsmanager:ap-south-1:[ACCOUNT]:secret:/maihoonna/staging/env:DIRECT_URL::" },
    { "name": "REDIS_URL", "valueFrom": "arn:aws:secretsmanager:ap-south-1:[ACCOUNT]:secret:/maihoonna/staging/env:REDIS_URL::" },
    { "name": "JWT_SECRET", "valueFrom": "arn:aws:secretsmanager:ap-south-1:[ACCOUNT]:secret:/maihoonna/staging/env:JWT_SECRET::" },
    { "name": "RAZORPAY_KEY_ID", "valueFrom": "arn:aws:secretsmanager:ap-south-1:[ACCOUNT]:secret:/maihoonna/staging/env:RAZORPAY_KEY_ID::" },
    { "name": "RAZORPAY_KEY_SECRET", "valueFrom": "arn:aws:secretsmanager:ap-south-1:[ACCOUNT]:secret:/maihoonna/staging/env:RAZORPAY_KEY_SECRET::" },
    { "name": "STORAGE_PROVIDER", "valueFrom": "arn:aws:secretsmanager:ap-south-1:[ACCOUNT]:secret:/maihoonna/staging/env:STORAGE_PROVIDER::" },
    { "name": "STORAGE_BUCKET", "valueFrom": "arn:aws:secretsmanager:ap-south-1:[ACCOUNT]:secret:/maihoonna/staging/env:STORAGE_BUCKET::" },
    { "name": "AWS_REGION", "valueFrom": "arn:aws:secretsmanager:ap-south-1:[ACCOUNT]:secret:/maihoonna/staging/env:AWS_REGION::" }
  ],
  "logConfiguration": {
    "logDriver": "awslogs",
    "options": {
      "awslogs-group": "/mhn/staging/api",
      "awslogs-region": "ap-south-1",
      "awslogs-stream-prefix": "ecs"
    }
  }
}
```

### 10.3 ECS Service Configuration
- **Launch type:** FARGATE
- **Desired count:** 1 (staging), 2+ (production, for HA)
- **Subnets:** Private subnets only (`mhn-private-1a`, `mhn-private-1b`)
- **Security Group:** `mhn-sg-ecs-api` or `mhn-sg-ecs-admin`
- **Load Balancer:** Attach to the appropriate Target Group
- **Deployment strategy:** Rolling update (max 200%, min 100%) — ensures zero downtime

### 10.4 ECS Auto Scaling (Production only)
```
Target: CPU Utilization > 70% → scale out
Target: CPU Utilization < 30% for 5 minutes → scale in
Min tasks: 2, Max tasks: 10
```

---

## 11. Application Load Balancer (ALB) & Route 53 DNS Routing

### 11.1 Create ALBs
- One ALB for **staging**: `mhn-alb-staging` (in public subnets)
- One ALB for **production**: `mhn-alb-production` (in public subnets)

### 11.2 Target Groups
| Target Group | Protocol | Port | Health Check Path | Environment |
| :--- | :--- | :--- | :--- | :--- |
| `tg-api-staging` | HTTP | 8001 | `/health` | Staging |
| `tg-admin-staging` | HTTP | 3001 | `/health` | Staging |
| `tg-api-production` | HTTP | 8001 | `/health` | Production |
| `tg-admin-production` | HTTP | 3001 | `/health` | Production |

### 11.3 ALB Listener Rules (HTTPS Port 443)
Both staging and production ALBs have listener rules based on hostname:

**Staging ALB:**
- `api-staging.maihoonna.com` → Forward to `tg-api-staging`
- `admin-api-staging.maihoonna.com` → Forward to `tg-admin-staging`

**Production ALB:**
- `api.maihoonna.com` → Forward to `tg-api-production`
- `admin-api.maihoonna.com` → Forward to `tg-admin-production`

### 11.4 Route 53 DNS Records
```
Type A (Alias) Records:
  api-staging.maihoonna.com         → mhn-alb-staging ALB DNS
  admin-api-staging.maihoonna.com   → mhn-alb-staging ALB DNS
  api.maihoonna.com                 → mhn-alb-production ALB DNS
  admin-api.maihoonna.com           → mhn-alb-production ALB DNS
  staging.maihoonna.in              → CloudFront (website staging)
  maihoonna.in                      → CloudFront (website production)
  admin-staging.maihoonna.com       → CloudFront (admin-frontend staging)
  admin.maihoonna.com               → CloudFront (admin-frontend production)
```

---

## 12. SSL Certificates via AWS Certificate Manager (ACM)

### 12.1 Request Wildcard Certificates
```bash
# For maihoonna.com
aws acm request-certificate \
  --domain-name "*.maihoonna.com" \
  --subject-alternative-names "maihoonna.com" \
  --validation-method DNS \
  --region ap-south-1

# For maihoonna.in
aws acm request-certificate \
  --domain-name "*.maihoonna.in" \
  --subject-alternative-names "maihoonna.in" \
  --validation-method DNS \
  --region ap-south-1

# CloudFront requires certificates in us-east-1 (global region)
aws acm request-certificate \
  --domain-name "*.maihoonna.in" \
  --validation-method DNS \
  --region us-east-1
```
2. Add the provided **CNAME records** to your domain registrar / Route 53 to complete DNS validation.
3. Attach validated `*.maihoonna.com` certificate to ALBs (HTTPS listener).
4. Attach `*.maihoonna.in` (`us-east-1`) certificate to CloudFront distributions.

---

## 13. Frontend Deployment — S3 + CloudFront

### 13.1 S3 Bucket Setup (one per frontend per environment)

| Bucket | Used For |
| :--- | :--- |
| `mhn-website-staging` | `apps/website` (staging) |
| `mhn-website-production` | `apps/website` (production) |
| `mhn-admin-frontend-staging` | `apps/admin-frontend` (staging) |
| `mhn-admin-frontend-production` | `apps/admin-frontend` (production) |

Settings for each bucket:
- **Block all public access:** Enabled (serve via CloudFront OAC only)
- **Static website hosting:** Disabled (CloudFront handles routing)
- **Versioning:** Enabled (allows rollback)

### 13.2 CloudFront Distribution Settings
- **Origin:** S3 bucket (via Origin Access Control — OAC)
- **Viewer protocol policy:** Redirect HTTP to HTTPS
- **Alternate domain names (CNAMEs):** e.g., `staging.maihoonna.in`
- **SSL Certificate:** ACM cert from `us-east-1`
- **Default root object:** `index.html`
- **Error pages:** 403 and 404 → return `/index.html` with status 200 (required for SPA routing)

### 13.3 Build & Deploy Commands (CI/CD)
```bash
# Build apps/website for staging
cd apps/website
VITE_API_URL=https://api-staging.maihoonna.com/api \
VITE_RAZORPAY_KEY_ID=rzp_test_... \
npm run build

# Sync to S3
aws s3 sync dist/ s3://mhn-website-staging/ --delete --cache-control "no-cache" --exclude "assets/*"
aws s3 sync dist/assets/ s3://mhn-website-staging/assets/ --cache-control "max-age=31536000,immutable"

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id $STAGING_WEBSITE_CF_ID \
  --paths "/*"
```

> The `--cache-control` split strategy busts the HTML cache on every deploy while keeping asset files (JS/CSS with hash names) cached for 1 year — maximizing performance.

---

## 14. Mobile App Environment Switching — EAS / Expo

### 14.1 `eas.json` Configuration for `apps/mobile-app`
```json
{
  "cli": { "version": ">= 14.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_ENV": "local",
        "EXPO_PUBLIC_ENABLE_PASSWORD_LOGIN": "true"
      }
    },
    "staging": {
      "developmentClient": false,
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "env": {
        "EXPO_PUBLIC_ENV": "staging",
        "EXPO_PUBLIC_PRODUCTION_API_URL": "https://api-staging.maihoonna.com/app-api/",
        "EXPO_PUBLIC_ENABLE_PASSWORD_LOGIN": "true",
        "EXPO_PUBLIC_RAZORPAY_KEY_ID": "rzp_test_T5r7EAjfxEsAtl",
        "EXPO_PUBLIC_APP_SECRET": "mhn-staging-app-secret-2026"
      }
    },
    "production": {
      "autoIncrement": true,
      "distribution": "store",
      "android": { "buildType": "app-bundle" },
      "env": {
        "EXPO_PUBLIC_ENV": "production",
        "EXPO_PUBLIC_PRODUCTION_API_URL": "https://api.maihoonna.com/app-api/",
        "EXPO_PUBLIC_ENABLE_PASSWORD_LOGIN": "false",
        "EXPO_PUBLIC_RAZORPAY_KEY_ID": "rzp_live_...",
        "EXPO_PUBLIC_APP_SECRET": "mhn-prod-app-secret-2026"
      }
    }
  },
  "submit": {
    "production": {
      "android": { "serviceAccountKeyPath": "./service-account.json", "track": "production" },
      "ios": { "appleId": "your@apple.com", "ascAppId": "12345678", "appleTeamId": "TEAMID" }
    }
  }
}
```

### 14.2 Build Commands
```bash
# Staging internal build (distribute via QR / email)
eas build --profile staging --platform android
eas build --profile staging --platform ios

# Production build for store submission
eas build --profile production --platform all

# Submit to stores after successful production build
eas submit --profile production --platform all
```

### 14.3 EAS Environment Variables (Secret storage for CI/CD)
Store `EXPO_TOKEN` in:
- **GitHub Actions Secrets**: `EXPO_TOKEN`
- Never commit `EXPO_TOKEN` to Git. It's in `.env` only for local dev.

---

## 15. CI/CD Pipeline — GitHub Actions

### 15.1 Branching Strategy & Trigger Map

| Branch | Triggers | Deploys To |
| :--- | :--- | :--- |
| `dev` / `staging` | Push → auto-deploy | Staging ECS + CloudFront |
| `main` | Manual approval → deploy | Production ECS + CloudFront |
| `feature/*` | No auto-deploy | Local / PR only |

### 15.2 Staging Deploy Workflow (`.github/workflows/deploy-staging.yml`)
```yaml
name: 🟡 Deploy to Staging

on:
  push:
    branches: [ staging, dev ]

env:
  AWS_REGION: ap-south-1
  ECR_REGISTRY: ${{ secrets.AWS_ACCOUNT_ID }}.dkr.ecr.ap-south-1.amazonaws.com

jobs:
  deploy-api:
    name: Deploy apps/api to Staging ECS
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Run Prisma Migrations (Staging DB)
        run: |
          npm ci
          npx prisma db push \
            --schema=packages/database/prisma/schema.prisma \
            --skip-generate
        env:
          DATABASE_URL: ${{ secrets.STAGING_DIRECT_URL }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build & Push apps/api Docker image
        env:
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/mhn-api-staging:$IMAGE_TAG \
            -f apps/api/Dockerfile .
          docker push $ECR_REGISTRY/mhn-api-staging:$IMAGE_TAG
          docker tag $ECR_REGISTRY/mhn-api-staging:$IMAGE_TAG \
            $ECR_REGISTRY/mhn-api-staging:latest
          docker push $ECR_REGISTRY/mhn-api-staging:latest

      - name: Force ECS Service Redeploy
        run: |
          aws ecs update-service \
            --cluster mhn-ecs-staging \
            --service mhn-api-staging \
            --force-new-deployment

  deploy-admin:
    name: Deploy apps/admin-backend to Staging ECS
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      - id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2
      - env:
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/mhn-admin-backend-staging:$IMAGE_TAG \
            -f apps/admin-backend/Dockerfile .
          docker push $ECR_REGISTRY/mhn-admin-backend-staging:$IMAGE_TAG
      - run: |
          aws ecs update-service \
            --cluster mhn-ecs-staging \
            --service mhn-admin-backend-staging \
            --force-new-deployment

  deploy-website:
    name: Deploy apps/website to S3 + CloudFront (Staging)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run build
        working-directory: apps/website
        env:
          VITE_API_URL: https://api-staging.maihoonna.com/api
          VITE_RAZORPAY_KEY_ID: rzp_test_T5r7EAjfxEsAtl
          VITE_ENABLE_GATEKEEPER: "true"
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      - run: |
          aws s3 sync apps/website/dist/ s3://mhn-website-staging/ --delete
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.STAGING_WEBSITE_CF_ID }} \
            --paths "/*"
```

### 15.3 GitHub Secrets Required

| Secret Name | Description |
| :--- | :--- |
| `AWS_ACCESS_KEY_ID` | IAM user key for CI/CD (`mhn-github-ci-role`) |
| `AWS_SECRET_ACCESS_KEY` | IAM secret |
| `AWS_ACCOUNT_ID` | AWS Account number (12 digits) |
| `STAGING_DIRECT_URL` | Staging AWS RDS direct DB URL (for Prisma migrations in CI/CD) |
| `PROD_DIRECT_URL` | Production AWS RDS direct DB URL |
| `STAGING_WEBSITE_CF_ID` | CloudFront Distribution ID for staging website |
| `PROD_WEBSITE_CF_ID` | CloudFront Distribution ID for production website |
| `STAGING_ADMIN_CF_ID` | CloudFront Distribution ID for staging admin |
| `PROD_ADMIN_CF_ID` | CloudFront Distribution ID for production admin |

---

## 16. Database Migration Strategy

### 16.1 Rules
1. **Staging**: Use `prisma db push` — fast, accepts data loss, fine for test data.
2. **Production**: Use `prisma migrate deploy` — only runs reviewed, committed migration files. Never runs `--accept-data-loss`.
3. **Never run `prisma db push` on production**.
4. **Always test migrations on staging first** before merging to `main` / deploying to production.

### 16.2 Migration Workflow
```bash
# 1. Developer makes schema change locally
# 2. Create migration file (do not apply yet):
npx prisma migrate dev --name add_pub_sub_events --create-only \
  --schema=packages/database/prisma/schema.prisma

# 3. Review the generated migration SQL in packages/database/prisma/migrations/

# 4. Push to staging and apply via CI/CD:
npx prisma db push --schema=packages/database/prisma/schema.prisma

# 5. After staging validation, deploy migration to production:
npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma
```

---

## 17. Razorpay Environment Isolation (Test vs Live)

### 17.1 Key Rules
- **`rzp_test_*` keys** must **only** be used in Staging / Local builds. They process dummy payments.
- **`rzp_live_*` keys** must **only** be in Production. They charge real money.
- Keep separate **Webhook Secrets** per environment. A live Razorpay webhook hitting your staging endpoint (with mismatched secret) will fail HMAC verification and be safely rejected.
- Register separate Webhook URLs in Razorpay Dashboard:
  - Staging: `https://admin-api-staging.maihoonna.com/api/payments/webhook`
  - Production: `https://admin-api.maihoonna.com/api/payments/webhook`

### 17.2 `webhook.service.js` — Environment-Aware Secret
The current `getWebhookSecret()` reads from `RAZORPAY_WEBHOOK_SECRET` env var. Ensure this is set differently per environment in AWS Secrets Manager.

---

## 18. Third-Party API Keys — Staging vs Production Strategy

| Service | Staging Approach | Production Approach |
| :--- | :--- | :--- |
| **STPL OTP** | Use same key but test with sandbox numbers or skip verification with flag | Live key, real SMS delivery |
| **MSG91 WhatsApp** | `ENABLE_WHATSAPP_NOTIFICATIONS=false` to suppress | `ENABLE_WHATSAPP_NOTIFICATIONS=true` |
| **Zoho Email** | Same account, but route to test email alias (`test@maihoonna.com`) | `WAITLIST_RECIPIENT_EMAIL=info@maihoonna.com` |
| **Google Maps API** | Create separate API key in Google Cloud Console with Staging domain restrictions | Create production-restricted key |
| **Firebase FCM** | Use a separate Firebase project `maihoonna-staging` | Use `maihoonna-999af` (production project) |
| **Expo Push** | Default test token in staging builds | Real device tokens in production builds |

### 18.1 Google Maps Key Restrictions (IMPORTANT)
In Google Cloud Console, restrict each API key:
- **Server key (backend, `GOOGLE_MAPS_API_KEY`):** IP restriction to ECS NAT Gateway Elastic IP.
- **Mobile key (Android, `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID`):** Restrict by Android App Package name + SHA-1 certificate fingerprint.
- **Mobile key (iOS, `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS`):** Restrict by iOS Bundle ID.

---

## 19. AWS CloudWatch — Logging & Alerting

### 19.1 Log Groups (create these before deploying)
```bash
aws logs create-log-group --log-group-name /mhn/staging/api --region ap-south-1
aws logs create-log-group --log-group-name /mhn/staging/admin-backend --region ap-south-1
aws logs create-log-group --log-group-name /mhn/production/api --region ap-south-1
aws logs create-log-group --log-group-name /mhn/production/admin-backend --region ap-south-1
```

### 19.2 Log Retention Policy
```bash
# Staging: Keep logs for 14 days
aws logs put-retention-policy \
  --log-group-name /mhn/staging/api \
  --retention-in-days 14

# Production: Keep logs for 90 days (regulatory compliance)
aws logs put-retention-policy \
  --log-group-name /mhn/production/api \
  --retention-in-days 90
```

### 19.3 CloudWatch Alarms to Set Up

| Alarm | Metric | Threshold | Action |
| :--- | :--- | :--- | :--- |
| High CPU — API | ECS CPUUtilization > 80% for 5 mins | Trigger scale-out + SNS email | Auto-scaling + alert |
| High Memory — API | ECS MemoryUtilization > 85% | SNS email | Alert |
| API 5xx Errors | ALB HTTPCode_Target_5XX_Count > 10/min | SNS email | Critical alert |
| Redis Memory High | ElastiCache FreeableMemory < 100MB | SNS email | Alert |
| ECS Task Stopped | ECS task stopped unexpectedly | SNS email | Critical alert |

### 19.4 CloudWatch Secrets Security Rule
Enable **CloudWatch Logs Insights** query to verify no credentials are leaked:
```
fields @message
| filter @message like /KEY|SECRET|PASSWORD|TOKEN/
| limit 100
```
Ensure all backends use `NODE_ENV=production` or `NODE_ENV=staging` so Prisma does not log full query strings.

---

## 20. Verification, Health Monitoring & Go-Live Checklist

### 20.1 Pre-Deployment Checklist (Before Any Deploy)
- [ ] All secrets created in AWS Secrets Manager for target environment
- [ ] Supabase project exists for target environment (staging or production)
- [ ] `DATABASE_URL` and `DIRECT_URL` tested locally via `psql` or Prisma Studio
- [ ] Redis ElastiCache endpoint reachable from within VPC (test with `redis-cli` on EC2 bastion)
- [ ] ECR repositories created for all services
- [ ] IAM roles (`mhn-ecs-task-role-*`, `ecsTaskExecutionRole`) created with correct policies
- [ ] ACM SSL certificates validated for `*.maihoonna.com` and `*.maihoonna.in`
- [ ] ALB created with correct listener rules and target groups
- [ ] Route 53 DNS records pointing to ALB and CloudFront

### 20.2 Post-Deployment Health Verification (Staging)
```bash
# 1. API health check
curl -sf https://api-staging.maihoonna.com/health
# Expected: {"status":"Admin Panel Backend running",...}

# 2. Admin backend health check
curl -sf https://admin-api-staging.maihoonna.com/health
# Expected: 200 OK

# 3. API ping
curl -sf https://api-staging.maihoonna.com/api/ping
# Expected: {"message":"pong"}

# 4. Admin ping
curl -sf https://admin-api-staging.maihoonna.com/api/ping
# Expected: {"message":"pong"}

# 5. Test OTP send endpoint (non-destructive, should reach STPL)
curl -X POST https://api-staging.maihoonna.com/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210"}'

# 6. Verify CORS headers (simulate frontend request)
curl -I -H "Origin: https://staging.maihoonna.in" \
  https://api-staging.maihoonna.com/api/ping
# Expect: Access-Control-Allow-Origin: https://staging.maihoonna.in

# 7. Verify SSL certificate
openssl s_client -connect api-staging.maihoonna.com:443 \
  -servername api-staging.maihoonna.com 2>/dev/null | openssl x509 -noout -dates
```

### 20.3 Database Connectivity Checks
```bash
# Verify Prisma can connect to staging DB (run from CI or a bastion host in VPC)
npx prisma db pull \
  --schema=packages/database/prisma/schema.prisma
# Should succeed and not throw "Can't reach database server"

# Verify connection pool limits are respected (no max_connections exceeded)
# Check Supabase Dashboard → Database → Connections
```

### 20.4 Secrets Security Verification
- [ ] Run `docker exec` into a running ECS task and verify `printenv | grep KEY` shows real values (not empty)
- [ ] Verify AWS Secrets Manager shows last accessed timestamp after deploy (confirms ECS pulled secrets)
- [ ] Verify CloudWatch logs contain **no raw secret values** (search for `SECRET`, `KEY`, `PASSWORD`)
- [ ] Confirm `.env` files are in `.gitignore` and not committed in repo

### 20.5 Payment Integration Verification (Staging)
- [ ] Trigger a Razorpay test checkout using `rzp_test_*` key — completes without real charge
- [ ] Verify Razorpay Webhook event arrives at `admin-api-staging.maihoonna.com/api/payments/webhook`
- [ ] Confirm HMAC signature verification passes (uses staging `RAZORPAY_WEBHOOK_SECRET`)
- [ ] Confirm subscription record is created in **staging DB** (not production)

### 20.6 Mobile App Verification
- [ ] Staging APK/IPA points to `https://api-staging.maihoonna.com/app-api/`
- [ ] Production build (`EXPO_PUBLIC_ENV=production`) points to `https://api.maihoonna.com/app-api/`
- [ ] `EXPO_PUBLIC_ENABLE_PASSWORD_LOGIN=false` in production build
- [ ] `eas build --profile production` uses `rzp_live_*` Razorpay key
- [ ] Push notification token registration hits correct environment backend

### 20.7 CORS Validation Matrix
Verify each frontend can only reach its own backend:

| Frontend | Allowed Backend | Should FAIL |
| :--- | :--- | :--- |
| `https://staging.maihoonna.in` | `https://api-staging.maihoonna.com` | `https://api.maihoonna.com` |
| `https://admin-staging.maihoonna.com` | `https://admin-api-staging.maihoonna.com` | Production admin API |
| `https://maihoonna.in` | `https://api.maihoonna.com` | Staging API |
| `https://admin.maihoonna.com` | `https://admin-api.maihoonna.com` | Staging admin API |

### 20.8 Go-Live Production Checklist
- [ ] All staging tests passing for 48+ hours without incidents
- [ ] Prisma production migration reviewed and tested on staging clone
- [ ] Razorpay keys switched from `rzp_test_*` to `rzp_live_*` in production secrets
- [ ] Production Razorpay Webhook URL registered in Razorpay Dashboard
- [ ] CloudWatch alarms configured and SNS email notifications confirmed
- [ ] ECS production service desired count set to `2` (for HA)
- [ ] Redis Multi-AZ with auto-failover enabled
- [ ] Supabase production project connection pooler connections verified
- [ ] DNS propagation verified globally (use `dig` or `dnschecker.org`)
- [ ] SSL certificates valid and not expiring in <30 days
- [ ] Production `CORS_ORIGIN` includes only production domains (no staging URLs)
- [ ] Mobile production build submitted to Google Play / App Store
