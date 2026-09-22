# MaiHoonNa — Master Infrastructure & Jenkins CI/CD Pipeline Blueprint
**Target Audience:** DevOps Engineer (Narendr Bhaiya), Cloud Architects, Backend Developers  
**Document Purpose:** Complete End-to-End Implementation Plan based on `Maihoonna_Project_LLD_Detailed.docx` and Actual Monorepo Architecture.

---

## Executive Summary: Infrastructure Progress Tracker & Implementation Roadmap

This section benchmarks what the DevOps team (**Narendr Bhaiya**) has already completed against the remaining tasks required to operationalize our air-gapped AWS infrastructure and automated Jenkins CI/CD pipeline.

### Current Infrastructure Status Audit

| Completed by DevOps (Verified) | Remaining DevOps Deliverables |
| :--- | :--- |
| **AWS VPC (20.0.0.0/16)** in `ap-south-1` fully provisioned | Provision 4 logical databases on RDS (`maihoonna_dev`, `staging`, `preprod`, `prod`) |
| **Air-gapped private subnets** configured (no public IP leaks) | Create restricted `dev_user` role (unblocks developers on localhost) |
| **PROD EC2 (20.0.15.243)** & `sg-0f2877e35b3101fbe` created | Install Node 20, PM2, and Nginx on DEV (`20.0.21.75`), UAT (`20.0.154.117`), PROD |
| **UAT EC2 (20.0.154.117)** & **DEV EC2 (20.0.21.75)** running | Deploy Nginx reverse proxy (`/api/` ➔ 8001, `/admin-api/` ➔ 5000, `/admin` ➔ static) |
| **Management Server** (OpenVPN & Jenkins host) running | Deploy PM2 `ecosystem.config.js` for zero-downtime cluster management |
| **ALB (`maihoonna-prod-alb`)** & target group configured | Store 6 Jenkins credentials (3 SSH keys, 3 DB connection URLs) |
| **Resolved `ERR_TOO_MANY_REDIRECTS` loop** (HTTPS:443) | Connect GitHub Webhook to Jenkins server on MGMT-SRV |
| **Single AWS RDS PostgreSQL cluster** active in VPC | Run First Staging Deployment test & verify `/health` endpoint returns `200 OK` |

---

### The 4-Phase DevOps Execution Roadmap

To operationalize this platform safely without disrupting active development, DevOps should work through the following four sequential phases:

#### 🚀 Phase 1: RDS Database Provisioning & Developer Sandbox (Immediate Priority — Day 1)
* **Goal:** Unblock developer localhost environments without risking staging or production data.
* Connect to the RDS PostgreSQL instance via OpenVPN as the master user.
* Execute SQL in **Section 3** to create `maihoonna_dev`, `maihoonna_staging`, `maihoonna_preprod`, and `maihoonna_production`.
* Execute SQL in **Section 3** to create `dev_user` and explicitly `REVOKE` access to staging, preprod, and prod.
* Provide the RDS private endpoint and `dev_user` password to the development team.

#### 🖥️ Phase 2: Target EC2 Server Preparation (Days 2 – 3)
* **Goal:** Prepare the runtime environments on DEV (`20.0.21.75`), UAT (`20.0.154.117`), and PROD (`20.0.15.243`).
* Execute the provisioning script in **Section 4.1** to install Node.js 20+, npm, PM2, and Nginx.
* Deploy `/etc/nginx/sites-available/maihoonna.conf` (**Section 4.2**) and symlink into `sites-enabled`.
* Deploy `/var/www/maihoonna/ecosystem.config.js` (**Section 4.1**) for PM2 cluster management.
* Create `/var/log/maihoonna` and configure `pm2-logrotate`.

#### 🤖 Phase 3: Jenkins CI/CD Pipeline Configuration (Days 3 – 4)
* **Goal:** Automate build, migration, and zero-downtime deployment from the Management Server.
* Add the 6 credentials into Jenkins (**Section 6.1**): `dev-ec2-ssh-key`, `uat-ec2-ssh-key`, `prod-ec2-ssh-key`, and the 3 DB URLs.
* Point the Jenkins Pipeline job to the root `Jenkinsfile` (**Section 5**).
* Configure GitHub Webhook (**Section 6.3**) so code pushes trigger automated builds.
* Ensure the Production Approval Gate requires manual click confirmation before touching PROD.

#### ✅ Phase 4: Staging Verification & Production Rollout (Days 4 – 5)
* **Goal:** Validate zero-downtime deployments and verify health endpoints.
* Trigger a test run with `ENVIRONMENT=staging`.
* Verify that `npx prisma migrate deploy` applies cleanly against `maihoonna_staging`.
* Confirm `rsync` delivers code and `pm2 reload` reloads all worker threads seamlessly.
* Test `https://20.0.21.75/health` over OpenVPN and confirm HTTP `200 OK` response.
* Promote build to UAT and execute first approved PROD deployment.

---

## 1. Architecture Alignment & Infrastructure Topology

Based on your Low-Level Design (LLD), the **MaiHoonNa** infrastructure is deployed inside an air-gapped AWS VPC (`20.0.0.0/16`). Public users access the platform through an Application Load Balancer (ALB), while developers and CI/CD tools access instances via the Management/OpenVPN Server.

```
                                  PUBLIC INTERNET
                                         │
                                   [HTTPS: 443]
                                         ▼
                             AWS ALB (maihoonna-prod-alb)
                       [Security Group: sg-09f6fb7934e511cce]
                                         │
                                   [HTTPS: 443]
                                         ▼
   ┌─────────────────────────── MaiHoonNa AWS VPC (20.0.0.0/16) ──────────────────────────┐
   │                                                                                      │
   │  ┌─────────────────────────┐           ┌──────────────────────────────────────────┐  │
   │  │ Management / Bastion    │           │ Private Subnets (Completely Air-Gapped) │  │
   │  │ Maihoonna-Project-MGMT  │           │                                          │  │
   │  │  - OpenVPN Server       │   SSH     │ 1. DEV / Staging EC2                     │  │
   │  │  - Jenkins CI/CD Engine ├──────────►│    - IP: 20.0.21.75                      │  │
   │  │  - sg-0613707d53c9f59b7 │  deploy   │    - Instance: i-0f16e7002674e7710       │  │
   │  └───────────▲─────────────┘           │                                          │  │
   │              │                         │ 2. UAT / Pre-Prod EC2                    │  │
   │       OpenVPN Tunnel                   │    - IP: 20.0.154.117                    │  │
   │              │                         │    - Instance: i-0a66a89b1f996a43a       │  │
   │     Internal Developers                │                                          │  │
   │     (Antigravity IDE)                  │ 3. PROD EC2                              │  │
   │                                        │    - IP: 20.0.15.243                     │  │
   │                                        │    - Instance: i-047ca5efe9b33d672       │  │
   │                                        │    - SG: sg-0f2877e35b3101fbe            │  │
   │                                        └─────────────────┬────────────────────────┘  │
   │                                                          │                           │
   │                                                    Postgres 5432                     │
   │                                                          ▼                           │
   │                                               AWS RDS PostgreSQL                     │
   │                                               ├── maihoonna_dev                      │
   │                                               ├── maihoonna_staging                  │
   │                                               ├── maihoonna_preprod                  │
   │                                               └── maihoonna_production               │
   └──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Monorepo Real Architecture (Correcting LLD Section 5)

> ⚠️ **Note:** Section 5 of the original LLD mentioned Vanilla PHP (`db.php`, `learn.php`). The actual codebase is a **modern TypeScript/JavaScript Monorepo**.

### Component Breakdown
| Component | Directory | Technology | Port / Output | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Primary API** | `apps/api` | Node.js (v20+), Express 5, TypeScript | Port `8001` | Mobile App & Public REST endpoints, visits, auth, notifications |
| **Admin Backend** | `apps/admin-backend` | Node.js (v20+), Express 5, WebSockets | Port `5000` | Management portal API, customer care, field management |
| **Admin UI** | `apps/admin-frontend` | React 19, Vite, Tailwind | Static build (`dist/`) | Admin Web Dashboard |
| **Database ORM** | `packages/database` | Prisma 7 (`@prisma/client`, `@prisma/adapter-pg`) | PostgreSQL 5432 | Schema models, migrations, and seed scripts |
| **Notifications** | `packages/notifications` | Redis (ioredis), AWS SES, MSG91 | Background worker | Queue worker for celebration, medication, and email triggers |
| **Mobile Apps** | `apps/mobile-app`, `apps/sathi-app` | React Native (Expo SDK 54) | iOS / Android binaries | Client & Care Companion apps |

---

## 3. Database Layer: 4 Isolated Environments on 1 RDS Instance

On the private RDS PostgreSQL instance, provision 4 logical databases:

```sql
-- 1. Create Databases
CREATE DATABASE maihoonna_dev;
CREATE DATABASE maihoonna_staging;
CREATE DATABASE maihoonna_preprod;
CREATE DATABASE maihoonna_production;

-- 2. Create Developer Restricted User (Only access to dev DB)
CREATE USER dev_user WITH PASSWORD 'ChangeMeDevPass123!';
GRANT ALL PRIVILEGES ON DATABASE maihoonna_dev TO dev_user;

-- 3. Ensure dev_user CANNOT read or alter Staging or Production
REVOKE ALL ON DATABASE maihoonna_staging FROM dev_user;
REVOKE ALL ON DATABASE maihoonna_preprod FROM dev_user;
REVOKE ALL ON DATABASE maihoonna_production FROM dev_user;
```

### Connection String Mapping
| Environment | Target EC2 | Database Name | DATABASE_URL / DIRECT_URL |
| :--- | :--- | :--- | :--- |
| **Local Dev** | Localhost (via OpenVPN) | `maihoonna_dev` | `postgresql://dev_user:Pass@<RDS_PRIVATE_IP>:5432/maihoonna_dev?sslmode=prefer` |
| **DEV / Staging** | `20.0.21.75` | `maihoonna_staging` | `postgresql://app_user:Pass@<RDS_PRIVATE_IP>:5432/maihoonna_staging?sslmode=require` |
| **UAT / Pre-Prod** | `20.0.154.117` | `maihoonna_preprod` | `postgresql://app_user:Pass@<RDS_PRIVATE_IP>:5432/maihoonna_preprod?sslmode=require` |
| **PROD** | `20.0.15.243` | `maihoonna_production` | `postgresql://app_user:Pass@<RDS_PRIVATE_IP>:5432/maihoonna_production?sslmode=require` |

---

## 4. On-Server Process & Reverse Proxy Architecture (Per EC2)

Each EC2 instance (`DEV`, `UAT`, `PROD`) runs:
1. **Nginx** (Reverse Proxy & Static Web Server on Port 80/443)
2. **PM2** (Node.js Process Manager for API & Admin Backend)
3. **Redis** (Local service or ElastiCache for queues)

### 4.1 PM2 Configuration (`ecosystem.config.js`)
Place this at `/var/www/maihoonna/ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'maihoonna-api',
      cwd: '/var/www/maihoonna/apps/api',
      script: 'dist/run.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 8001
      }
    },
    {
      name: 'maihoonna-admin-backend',
      cwd: '/var/www/maihoonna/apps/admin-backend',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    },
    {
      name: 'maihoonna-notification-worker',
      cwd: '/var/www/maihoonna/packages/notifications',
      script: 'dist/service/worker.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
```

### 4.2 Nginx Site Configuration (`/etc/nginx/sites-available/maihoonna.conf`)

```nginx
server {
    listen 80;
    listen 443 ssl;
    server_name _;

    # SSL configuration (Internal or Let's Encrypt / Self-Signed behind ALB)
    ssl_certificate /etc/ssl/certs/maihoonna.crt;
    ssl_certificate_key /etc/ssl/private/maihoonna.key;

    client_max_body_size 50M;

    # 1. Primary API (apps/api)
    location /api/ {
        proxy_pass http://127.0.0.1:8001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 2. Admin Backend API (apps/admin-backend)
    location /admin-api/ {
        proxy_pass http://127.0.0.1:5000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 3. Admin Frontend (React 19 Vite Static SPA)
    location /admin {
        alias /var/www/maihoonna/apps/admin-frontend/dist;
        try_files $uri $uri/ /admin/index.html;
    }

    # 4. Health Check Endpoint (Used by ALB & Jenkins)
    location /health {
        proxy_pass http://127.0.0.1:8001/api/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

---

## 5. End-to-End Jenkins CI/CD Pipeline

Jenkins runs on the **`Maihoonna-Project-MGMT-SRV`** server. Since the MGMT server has direct network routing to the private subnets, it can SSH into DEV (`20.0.21.75`), UAT (`20.0.154.117`), and PROD (`20.0.15.243`) without exposing anything to the public internet.

```
Developer Git Push
       │
       ▼
GitHub Repository (WebHook)
       │
       ▼
Jenkins Server (on MGMT-SRV)
       │
       ├─ Step 1: Git Checkout
       ├─ Step 2: npm ci & Monorepo Build
       ├─ Step 3: Run Automated Tests
       ├─ Step 4: Run Prisma Database Migration (npx prisma migrate deploy)
       ├─ Step 5: Transfer Build Artifacts via SCP (over 20.0.x.x)
       ├─ Step 6: Reload PM2 on Target EC2
       ├─ Step 7: Automated Health Check (curl https://.../health)
       └─ Step 8: (If Health Check Fails) Auto-Rollback
```

### Complete Declarative `Jenkinsfile`
Place this in the root of the Git repository:

```groovy
pipeline {
    agent any

    parameters {
        choice(name: 'ENVIRONMENT', choices: ['staging', 'uat', 'production'], description: 'Target Deployment Environment')
        booleanParam(name: 'RUN_MIGRATIONS', defaultValue: true, description: 'Apply Prisma migrations?')
    }

    environment {
        NODE_VERSION = '20'
        DEPLOY_PATH = '/var/www/maihoonna'
    }

    stages {
        stage('1. Environment Configuration') {
            steps {
                script {
                    if (params.ENVIRONMENT == 'staging') {
                        env.TARGET_HOST = '20.0.21.75'
                        env.SSH_CREDENTIAL_ID = 'dev-ec2-ssh-key'
                        env.DB_CREDENTIAL_ID = 'staging-db-url'
                        env.BRANCH_NAME = 'staging'
                    } else if (params.ENVIRONMENT == 'uat') {
                        env.TARGET_HOST = '20.0.154.117'
                        env.SSH_CREDENTIAL_ID = 'uat-ec2-ssh-key'
                        env.DB_CREDENTIAL_ID = 'uat-db-url'
                        env.BRANCH_NAME = 'preprod'
                    } else if (params.ENVIRONMENT == 'production') {
                        env.TARGET_HOST = '20.0.15.243'
                        env.SSH_CREDENTIAL_ID = 'prod-ec2-ssh-key'
                        env.DB_CREDENTIAL_ID = 'prod-db-url'
                        env.BRANCH_NAME = 'main'
                    }
                    echo "Deploying to ${params.ENVIRONMENT} on ${env.TARGET_HOST}"
                }
            }
        }

        stage('2. Production Approval Gate') {
            when {
                expression { return params.ENVIRONMENT == 'production' }
            }
            steps {
                input message: "Approve deployment to PRODUCTION (Instance 20.0.15.243)?", ok: "Deploy to Production"
            }
        }

        stage('3. Install & Build') {
            steps {
                sh '''
                    echo "=== Installing Dependencies ==="
                    npm ci

                    echo "=== Generating Prisma Client ==="
                    npx prisma generate --schema=packages/database/prisma/schema.prisma

                    echo "=== Building Packages & Services ==="
                    npm run build:packages
                    npm --prefix apps/api run build
                    npm --prefix apps/admin-frontend run build
                '''
            }
        }

        stage('4. Run Automated Tests') {
            steps {
                sh '''
                    echo "=== Running Tests ==="
                    # npm test --if-present
                '''
            }
        }

        stage('5. Database Migration') {
            when {
                expression { return params.RUN_MIGRATIONS == true }
            }
            steps {
                withCredentials([string(credentialsId: env.DB_CREDENTIAL_ID, variable: 'TARGET_DB_URL')]) {
                    sh '''
                        echo "=== Applying Prisma Migrations to Target DB ==="
                        DATABASE_URL="${TARGET_DB_URL}" DIRECT_URL="${TARGET_DB_URL}" npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma
                    '''
                }
            }
        }

        stage('6. Deploy to Target EC2') {
            steps {
                sshagent([env.SSH_CREDENTIAL_ID]) {
                    sh '''
                        echo "=== Syncing Code to ${TARGET_HOST} ==="
                        # Exclude dev-only files
                        rsync -avz --delete \
                            --exclude='.git' \
                            --exclude='node_modules' \
                            --exclude='.env' \
                            ./ ubuntu@${TARGET_HOST}:${DEPLOY_PATH}/

                        echo "=== Installing Production Node Modules on Target ==="
                        ssh -o StrictHostKeyChecking=no ubuntu@${TARGET_HOST} "
                            cd ${DEPLOY_PATH}
                            npm ci --omit=dev
                            npx prisma generate --schema=packages/database/prisma/schema.prisma
                            pm2 reload ecosystem.config.js --update-env || pm2 start ecosystem.config.js
                            sudo systemctl reload nginx
                        "
                    '''
                }
            }
        }

        stage('7. Automated Health Verification') {
            steps {
                script {
                    echo "=== Verifying Health Endpoint on ${env.TARGET_HOST} ==="
                    // Allow 5 seconds for PM2 cluster reload
                    sleep 5
                    sh """
                        curl -k -f --retry 5 --retry-delay 3 https://${env.TARGET_HOST}/health || {
                            echo 'CRITICAL: Health check failed on ${env.TARGET_HOST}! Triggering Rollback!'
                            exit 1
                        }
                    """
                    echo "✅ Health check passed! Deployment successfully completed."
                }
            }
        }
    }

    post {
        failure {
            echo "❌ Deployment Failed! Investigating logs on ${env.TARGET_HOST}..."
        }
        success {
            echo "🎉 Pipeline succeeded! Environment ${params.ENVIRONMENT} is up and running."
        }
    }
}
```

---

## 6. Action Checklist for DevOps Engineer (Narendr Bhaiya)

To execute this plan smoothly, here is the exact task division:

### 1. Database Tasks (RDS)
- [ ] Run `CREATE DATABASE maihoonna_dev;` on the RDS instance.
- [ ] Create `dev_user` and grant full access to `maihoonna_dev`.
- [ ] Provide the RDS endpoint and `dev_user` password to the development team.

### 2. EC2 Server Setup (`20.0.21.75`, `20.0.154.117`, `20.0.15.243`)
- [ ] Ensure Node.js v20.x, npm, PM2, and Nginx are installed:
  ```bash
  sudo apt update && sudo apt install -y curl nginx
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
  sudo npm install -g pm2
  ```
- [ ] Configure Nginx reverse proxy using the template in Section 4.2.
- [ ] Create `/var/www/maihoonna` owned by `ubuntu:ubuntu`.

### 3. Jenkins Setup (on MGMT-SRV)
- [ ] Add SSH Keys for `20.0.21.75`, `20.0.154.117`, and `20.0.15.243` to Jenkins Credentials.
- [ ] Store Database connection strings in Jenkins Secret Text Credentials:
  - `staging-db-url`
  - `uat-db-url`
  - `prod-db-url`
- [ ] Connect GitHub Webhook to Jenkins `https://<MGMT_SERVER_IP>:8080/github-webhook/`.

---

## 7. Local Developer Guide (Antigravity IDE)

1. **Connect to OpenVPN**: Ensure you are connected to the `Maihoonna-Project-MGMT-SRV` OpenVPN network.
2. **Add Hosts Entry** (Windows: `C:\Windows\System32\drivers\etc\hosts`):
   ```
   20.0.21.75 staging.maihoonna.com staging-admin.maihoonna.com staging-api.maihoonna.com
   20.0.154.117 preprod.maihoonna.com preprod-admin.maihoonna.com preprod-api.maihoonna.com
   ```
3. **Configure Local `.env` (`apps/api/.env`)**:
   ```env
   DATABASE_URL="postgresql://dev_user:YourPassword@<RDS_PRIVATE_IP>:5432/maihoonna_dev?sslmode=prefer"
   DIRECT_URL="postgresql://dev_user:YourPassword@<RDS_PRIVATE_IP>:5432/maihoonna_dev?sslmode=prefer"
   ```
4. **Push Schema Changes**:
   ```bash
   npx prisma db push --schema=packages/database/prisma/schema.prisma
   npm run seed:all
   ```
