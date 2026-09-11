# MaiHoonNa — Redis Deployment & Infrastructure Guide for DevOps

> **Target Audience**: DevOps Engineers, Site Reliability Engineers (SRE), Cloud Architects  
> **Applicable Module**: `@maihoonna/notifications` & Monorepo Backend (`apps/api`, `apps/admin-backend`)  
> **Purpose**: Deploying, configuring, securing, and scaling the Redis message broker and background notification worker daemon.

---

## 1. System Architecture & Role of Redis

The MaiHoonNa notification system is built as a **decoupled Redis Streams Microservice**. Core API services (`apps/api` and `apps/admin-backend`) **never** make synchronous outbound HTTP calls to third-party communication vendors (MSG91, AWS SES, or Expo Push).

```
┌─────────────────────────────────────────────────────────────┐
│                    API PRODUCER LAYER                       │
│  • apps/api (Port 8001)                                     │
│  • apps/admin-backend (Port 5000)                           │
│                                                             │
│  Action: Non-blocking XADD to Redis Stream (< 2ms)          │
└──────────────────────────────┬──────────────────────────────┘
                               │
                      Port 6379 (TCP / TLS)
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              REDIS STREAMS BROKER (CLUSTER / STANDALONE)    │
│                                                             │
│  • stream:notifications:whatsapp (MSG91 WhatsApp)           │
│  • stream:notifications:push     (Expo FCM / APNs Push)     │
│  • stream:notifications:email    (AWS SES / SMTP)           │
│  • stream:notifications:dlq      (Dead Letter Queue)        │
│  • idemp:notif:*                 (Idempotency TTL 60s)      │
└──────────────────────────────┬──────────────────────────────┘
                               │
               XREADGROUP (Consumer Group Polling)
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│             STANDALONE WORKER DAEMON (CONSUMER)             │
│  Process: packages/notifications/src/service/worker.ts      │
│  Service Script: `npm run dev:notifications` / `npm start`  │
│  Consumer Group: `notification-workers`                     │
│                                                             │
│  Features:                                                  │
│  - Auto-claims orphaned messages (> 60s idle)               │
│  - Exponential backoff retry (up to 5 attempts)             │
│  - Dead Letter Queue routing on poison pills                │
└──────────────────────────────┬──────────────────────────────┘
                               │
                 External Vendor Dispatch
                               │
               ┌───────────────┼───────────────┐
               ▼               ▼               ▼
        ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
        │  MSG91 WABA │ │  Expo Push  │ │   AWS SES   │
        └─────────────┘ └─────────────┘ └─────────────┘
```

---

## 2. Redis Version & Engine Requirements

| Requirement | Specification | Rationale |
|---|---|---|
| **Engine** | **Redis 6.2+ or 7.x** *(Strict)* | `XAUTOCLAIM` command (used for self-healing message recovery) requires Redis >= 6.2.0. |
| **Eviction Policy** | **`noeviction`** *(Critical)* | Never use `volatile-lru` or `allkeys-lru`. If Redis runs low on memory, it must reject writes rather than silently deleting active notification stream entries. |
| **Persistence** | **AOF (Append-Only File)** recommended | Set `appendonly yes` and `appendfsync everysec` to prevent message loss on instance crash. |
| **Minimum Memory** | Staging: 512 MB – 1 GB<br>Production: 2 GB – 4 GB | High throughput streams with 100,000+ entries consume ~80 MB RAM. |

---

## 3. Environment Variables Configuration

Every container/process connecting to Redis needs the connection coordinates injected via environment variables.

### Variables Matrix

| Variable | Description | Example (Staging) | Example (Production) |
|---|---|---|---|
| `REDIS_URL` | Standard Redis URI connection string | `redis://:mypassword@redis-staging.internal:6379` | `rediss://:strongauth@redis.prod.cache.amazonaws.com:6379` |
| `REDIS_HOST` | Fallback Redis hostname | `127.0.0.1` or `redis.internal` | `redis.maihoonna.internal` |
| `REDIS_PORT` | Port number | `6379` | `6379` |
| `REDIS_PASSWORD` | Redis `AUTH` password (optional if in URL) | `mypassword` | `[From AWS Secrets Manager]` |

> **TLS Note**: For AWS ElastiCache with in-transit encryption enabled, use the `rediss://` protocol scheme (with two `s`'s).

---

## 4. Deployment Options

### Option A: AWS ElastiCache (Production / Staging AWS VPC)

This is the recommended setup for staging and production ECS/EKS clusters.

#### 1. Create ElastiCache Redis Subnet Group
Ensure the Redis cluster is deployed into the **Private Subnets** of the VPC.

#### 2. Create Security Group (`sg-redis-maihoonna`)
* **Inbound Rules**:
  * **Type**: Custom TCP
  * **Port Range**: `6379`
  * **Source**: Security Group of `apps/api` ECS tasks + Security Group of the `notification-worker` ECS tasks.
* **Outbound Rules**: Default (All traffic).

#### 3. ElastiCache Cluster Specs
* **Cluster Mode**: Disabled (Standalone with 1 Read Replica is sufficient for initial production scale).
* **Node Type**:
  * Staging: `cache.t4g.micro`
  * Production: `cache.t4g.small` (scale to `cache.r6g.large` if message throughput exceeds 10M/month).
* **Engine Version**: `7.0` or latest 7.x.
* **Parameter Group**:
  * `maxmemory-policy`: `noeviction`
  * `timeout`: `0` (keep persistent connections open)

---

### Option B: Docker Compose (Local / Single VM / EC2 Dev Server)

If you are running on an EC2 virtual machine or testing locally with Docker:

```yaml
version: '3.8'

services:
  redis:
    image: redis:7.2-alpine
    container_name: maihoonna-redis
    restart: always
    ports:
      - "6379:6379"
    command: >
      redis-server 
      --requirepass "change_me_to_strong_password" 
      --appendonly yes 
      --maxmemory 1gb 
      --maxmemory-policy noeviction
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "change_me_to_strong_password", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Optional Web GUI for inspecting streams in Staging
  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: maihoonna-redis-gui
    restart: unless-stopped
    environment:
      - REDIS_HOSTS=local:redis:6379:0:change_me_to_strong_password
    ports:
      - "8081:8081"
    depends_on:
      - redis

volumes:
  redis_data:
```

---

## 5. Deploying the Notification Worker Daemon

The notification worker is an **independent, continuous background daemon process** located in `packages/notifications`. It should be deployed as its own standalone service (e.g. AWS ECS Fargate task, Kubernetes Deployment, or PM2 process).

### Containerization Strategy

#### Standalone Worker Dockerfile (`packages/notifications/Dockerfile.worker`)
```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY packages/notifications/package*.json ./packages/notifications/
RUN npm ci

COPY packages/notifications ./packages/notifications
WORKDIR /app/packages/notifications
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/packages/notifications/package*.json ./packages/notifications/
RUN npm ci --omit=dev

COPY --from=builder /app/packages/notifications/dist ./packages/notifications/dist

WORKDIR /app/packages/notifications
CMD ["node", "dist/service/worker.js"]
```

#### Running via PM2 (Virtual Machines / EC2)
If deploying directly to an EC2 instance without Docker:
```bash
# Inside packages/notifications
npm run build
pm2 start dist/service/worker.js --name "maihoonna-notifications" -i 1
pm2 save
pm2 startup
```

---

## 6. DevOps CLI Runbook & Troubleshooting

Once Redis and the Worker are running, use the following `redis-cli` commands to monitor throughput and message queues.

### 1. Test Connectivity & Ping
```bash
redis-cli -u redis://:your_password@your_host:6379 ping
# Expected output: PONG
```

### 2. Check Queue Lengths (Pending Stream Items)
```bash
# Check how many WhatsApp messages are currently in the stream
redis-cli -u redis://:your_password@your_host:6379 XLEN stream:notifications:whatsapp

# Check Push and Email stream lengths
redis-cli -u redis://:your_password@your_host:6379 XLEN stream:notifications:push
redis-cli -u redis://:your_password@your_host:6379 XLEN stream:notifications:email
```

### 3. Check Dead Letter Queue (Failed Dispatches)
```bash
# View the number of poison pill / failed messages
redis-cli -u redis://:your_password@your_host:6379 XLEN stream:notifications:dlq

# Inspect the last 5 failed messages with error details
redis-cli -u redis://:your_password@your_host:6379 XREVRANGE stream:notifications:dlq + - COUNT 5
```

### 4. Inspect Consumer Group Status
```bash
# View active consumers and pending message count
redis-cli -u redis://:your_password@your_host:6379 XINFO GROUPS stream:notifications:whatsapp

# Check pending entries list (PEL) - messages currently being processed
redis-cli -u redis://:your_password@your_host:6379 XPENDING stream:notifications:whatsapp notification-workers
```

### 5. Stream Trimming Maintenance (Optional Cron)
To prevent the stream from growing indefinitely while retaining the last 50,000 processed messages:
```bash
# Run weekly or via maintenance script
redis-cli -u redis://:your_password@your_host:6379 XTRIM stream:notifications:whatsapp MAXLEN ~ 50000
redis-cli -u redis://:your_password@your_host:6379 XTRIM stream:notifications:push MAXLEN ~ 50000
redis-cli -u redis://:your_password@your_host:6379 XTRIM stream:notifications:email MAXLEN ~ 50000
```

---

## 7. CloudWatch Alarms & Monitoring Guidelines

Set up the following metrics and alerts in AWS CloudWatch / Datadog:

1. **Dead Letter Queue Alert (High Priority)**:
   - **Metric**: `XLEN stream:notifications:dlq`
   - **Condition**: `> 0` for 5 consecutive minutes.
   - **Action**: PagerDuty / Slack notification to Backend team (indicates invalid templates, bad phone numbers, or vendor gateway rejections).
2. **Pending Entries List (PEL) Latency Alert**:
   - **Metric**: Unacknowledged messages in `XPENDING`
   - **Condition**: `> 100` for 10 minutes.
   - **Action**: Indicates the worker daemon is down, crashed, or choked by vendor rate limiting. Check worker container logs.
3. **ElastiCache Memory Usage**:
   - **Condition**: `EngineCPUUtilization > 75%` or `DatabaseMemoryUsagePercentage > 80%`.
   - **Action**: Scale node size or verify `maxmemory-policy noeviction`.

---

## 8. Graceful Fallback & Disaster Recovery

The application code in `NotificationProducer` features an **automatic circuit breaker**:
* If the Redis cluster goes down or is restarting:
  - The core API (`apps/api`) **will not crash or freeze**.
  - `notificationProducer.publish()` catches the Redis connection timeout within 2 seconds and **gracefully falls back to direct delivery** via `notificationService.send()`.
  - Once Redis comes back online, traffic automatically routes back through the high-throughput Redis Streams.
