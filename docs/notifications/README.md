# MaiHoonNa — Notification Architecture & Integration Documentation Suite

> **Target Audience**: Full-Stack Developers, Mobile Engineers, DevOps, Product Managers  
> **Repository**: `Mai-Hoonaa`  
> **Core Package**: `packages/notifications` (`@maihoonna/notifications`)

Welcome to the central notification engineering documentation for the **MaiHoonNa** platform. This directory contains the complete architectural specifications, developer guides, template registries, and operational runbooks for our omnichannel notification system (Push, In-App, WhatsApp, SMS, and Email).

---

## 📚 Documentation Index

### 1. Core Architecture & Developer Guides
- 📖 [DEVELOPER_NOTIFICATION_ARCHITECTURE_GUIDE.md](./DEVELOPER_NOTIFICATION_ARCHITECTURE_GUIDE.md)  
  *The primary onboarding guide for engineers.* Covers system topology, golden architectural rules (non-blocking, zero blast radius), 4-step implementation pattern, manual testing via UI buttons & CLI, and Redis commands.

- 🏗️ [NOTIFICATION_ENGINE_ARCHITECTURE.md](./NOTIFICATION_ENGINE_ARCHITECTURE.md)  
  Omnichannel notification engine architecture, FCM/APNs lock-screen push pipeline, modular event dispatchers, celebration engine, and production EAS builds.

- ⚡ [REDIS_STREAMS_NOTIFICATION_MICROSERVICE.md](./REDIS_STREAMS_NOTIFICATION_MICROSERVICE.md)  
  In-depth guide to the Redis Streams microservice architecture (`XADD`, `XREADGROUP`, `XPENDING`, `XAUTOCLAIM`, `XACK`), consumer group handling, dead letter queue (DLQ), and resilience patterns.

- 🛠️ [REDIS_DEPLOYMENT_AND_DEVOPS_GUIDE.md](./REDIS_DEPLOYMENT_AND_DEVOPS_GUIDE.md)  
  DevOps deployment runbook for Docker, Redis 7 Alpine, cloud instances, healthcheck monitoring, and daemon workers.

---

### 2. Sathi & Care Mitra Field Architecture
- 🤝 [CARE_MITRA_AND_SATHI_NOTIFICATION_ARCHITECTURE.md](./CARE_MITRA_AND_SATHI_NOTIFICATION_ARCHITECTURE.md)  
  Multi-channel notification engine for Care Mitras and Saathi Volunteers, including native Expo foreground listeners, tap deep-linking, Android system channels, and multi-device token lifecycle.

- 🔗 [NOTIFICATION_EVENT_LINKAGE_AND_CODE_REFERENCE.md](./NOTIFICATION_EVENT_LINKAGE_AND_CODE_REFERENCE.md)  
  Comprehensive code reference indexing every backend controller, service hook, and route where notification events are dispatched.

---

### 3. Template Catalogs & Status Trackers
- 📋 [UNCONFIGURED_NOTIFICATION_TEMPLATES.md](./UNCONFIGURED_NOTIFICATION_TEMPLATES.md)  
  **Exhaustive inventory of remaining unconfigured and pending templates.** Detailed tables of the 11 WhatsApp templates awaiting Meta/MSG91 approval and 9 Email-only digest reports, with copy text, variables, and unblocking instructions.

- 📗 [MASTER_NOTIFICATION_CATALOG.md](./MASTER_NOTIFICATION_CATALOG.md)  
  The complete catalog of 101 notification events across the MaiHoonNa platform.

- 📱 [WHATSAPP_TEMPLATE_INGESTION_AND_MICROSERVICE_RULES.md](./WHATSAPP_TEMPLATE_INGESTION_AND_MICROSERVICE_RULES.md)  
  Strict rulebook for ingesting MSG91 / Meta approved JSON payloads into `whatsapp.registry.ts` with 100% parameter accuracy.

- 📊 [NOTIFICATION_SYNC_TRACKER.md](./NOTIFICATION_SYNC_TRACKER.md) & [REMAINING_NOTIFICATIONS.md](./REMAINING_NOTIFICATIONS.md)  
  Sprint audit and alignment trackers for notification events across mobile and web platforms.

---

## 🚀 Quick Start for Developers

### Check Redis Health
```bash
# Check if Redis is running and inspect stream depths
npm run redis:check
```

### Start Local Redis Container
```bash
# Using Docker Compose
npm run redis:up
```

### Run Notification Worker Daemon
```bash
# In background or dedicated terminal
npm run worker
```

### Send a Test WhatsApp Notification
```bash
cd packages/notifications
npx ts-node check-redis.ts
```

---

## 🏛️ System Architecture Summary

```
                      [ Client Actions (Mobile App / Admin Frontend) ]
                                            │
                                            ▼
                       [ Backend Express API / Admin Services ]
                                            │
                        ┌───────────────────┴───────────────────┐
                        │ Fast, Non-Blocking XADD (< 2ms)       │ Fallback Mode
                        ▼                                       ▼
             [ Redis Streams Cluster ]              [ In-Process Direct Delivery ]
          ├── stream:notifications:push             ├── Expo FCM / APNs Push
          ├── stream:notifications:whatsapp         ├── MSG91 WhatsApp Outbound
          ├── stream:notifications:email            └── AWS SES v3 / Zoho SMTP
          └── stream:notifications:dlq
                        │
                        ▼
          [ Notification Worker Daemon ]
           (Consumer Group: notification-workers)
```

All external communications are **strictly decoupled** and **non-blocking** — API routes always return `< 20ms` without waiting for third-party vendor network calls.
