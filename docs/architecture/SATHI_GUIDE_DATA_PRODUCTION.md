# Saathi App Guide Page — Production Database Seed & Reference Data

This document contains all production data, schemas, SQL statements, and API JSON payloads required for the **Saathi App Guide Page** (`apps/sathi-app/app/(sathi)/guide.tsx`).

The Saathi mobile app fetches this data via:
```http
GET /api/public/sathi-guide
```
which queries three database tables:
1. `saathi_best_practices` (model `SaathiBestPractice`)
2. `saathi_suggested_activities` (model `SaathiSuggestedActivity`)
3. `saathi_faqs` (model `SaathiFaq`)

---

## 1. Quick Execution Options

### Option A: Run Prisma Seed Script in Production
Ensure your environment variable points to the production database:
```bash
# In apps/api
DATABASE_URL="postgresql://<USER>:<PASSWORD>@<HOST>:<PORT>/<DB>?sslmode=require" npx ts-node seed-sathi-guide.ts
```

### Option B: Execute SQL Statements Directly
Copy and execute the SQL statements in [Section 3](#3-postgresql-insert-scripts) in your production database client (Supabase SQL Editor, psql, DBeaver, PgAdmin).

---

## 2. Structured Reference Data

### 2.1 Best Practices (`saathi_best_practices`)

| Sort | Icon | Title | Description | Key Points |
| :--- | :--- | :--- | :--- | :--- |
| **1** | `heart-outline` | **Be Present & Empathetic** | Active listening and genuine care are your most important tools | • Give your full attention during visits<br>• Listen more than you speak<br>• Show genuine interest in their stories and experiences<br>• Be patient and allow them to share at their own pace |
| **2** | `chatbubble-outline` | **Conversation Starters** | Topics that often lead to meaningful connections | • Ask about their family and childhood memories<br>• Discuss hobbies, interests, or past careers<br>• Talk about current events or local community news<br>• Share appropriate stories from your own life<br>• Ask for their advice or wisdom on topics |
| **3** | `time-outline` | **Visit Structure** | Make the most of your time together | • Arrive on time and stay for the planned duration<br>• Start with a warm greeting and casual conversation<br>• Engage in agreed-upon activities (tea, games, walks)<br>• End visits positively and confirm next meeting<br>• Typical visits last 1-2 hours |
| **4** | `shield-checkmark-outline` | **Boundaries & Safety** | Important guidelines to follow | • Never share personal financial information<br>• Don't accept or give expensive gifts<br>• Respect their privacy and confidentiality<br>• Report any concerns to the saathi coordinator<br>• Don't provide medical advice or assistance |

---

### 2.2 Suggested Activities (`saathi_suggested_activities`)

| Sort | Activity Title | Typical Duration | Difficulty Level |
| :--- | :--- | :--- | :--- |
| **1** | Tea & Conversation | 1-2 hours | Easy |
| **2** | Board Games or Cards | 1-2 hours | Easy |
| **3** | Short Walks | 30-60 mins | Moderate |
| **4** | Reading Together | 30-60 mins | Easy |
| **5** | Photo Album Viewing | 1 hour | Easy |
| **6** | Light Gardening | 1-2 hours | Moderate |
| **7** | Technology Help | 30-60 mins | Moderate |
| **8** | Grocery Shopping | 1-2 hours | Moderate |

---

### 2.3 FAQs (`saathi_faqs`)

| Sort | Question | Answer |
| :--- | :--- | :--- |
| **1** | What if the beneficiary seems unwell during my visit? | If it is an emergency, contact Emergency Services immediately. Otherwise, inform the saathi coordinator through the emergency support channel. |
| **2** | How do I handle difficult conversations or emotions? | Listen empathetically without judgment. Do not try to "fix" their feelings. If you feel overwhelmed, contact your saathi coordinator for guidance. |
| **3** | What if I need to cancel a scheduled visit? | Please use the app to reschedule or cancel at least 24 hours in advance so the beneficiary can be notified promptly. |
| **4** | Can I bring someone else along to visits? | No, for safety and privacy reasons, only verified Saathi volunteers are permitted to conduct visits. |
| **5** | How do I build rapport with someone I just met? | Start with simple conversation starters, be patient, and show genuine interest in their stories. Consistency in your visits is key. |

---

## 3. PostgreSQL INSERT Scripts

```sql
-- ============================================================================
-- 1. SAATHI BEST PRACTICES
-- ============================================================================
DELETE FROM "public"."saathi_best_practices";

INSERT INTO "public"."saathi_best_practices" (
    "id",
    "title",
    "description",
    "icon",
    "points",
    "sortOrder",
    "isActive",
    "createdAt",
    "updatedAt"
) VALUES 
(
    gen_random_uuid(),
    'Be Present & Empathetic',
    'Active listening and genuine care are your most important tools',
    'heart-outline',
    ARRAY[
        'Give your full attention during visits',
        'Listen more than you speak',
        'Show genuine interest in their stories and experiences',
        'Be patient and allow them to share at their own pace'
    ],
    1,
    true,
    NOW(),
    NOW()
),
(
    gen_random_uuid(),
    'Conversation Starters',
    'Topics that often lead to meaningful connections',
    'chatbubble-outline',
    ARRAY[
        'Ask about their family and childhood memories',
        'Discuss hobbies, interests, or past careers',
        'Talk about current events or local community news',
        'Share appropriate stories from your own life',
        'Ask for their advice or wisdom on topics'
    ],
    2,
    true,
    NOW(),
    NOW()
),
(
    gen_random_uuid(),
    'Visit Structure',
    'Make the most of your time together',
    'time-outline',
    ARRAY[
        'Arrive on time and stay for the planned duration',
        'Start with a warm greeting and casual conversation',
        'Engage in agreed-upon activities (tea, games, walks)',
        'End visits positively and confirm next meeting',
        'Typical visits last 1-2 hours'
    ],
    3,
    true,
    NOW(),
    NOW()
),
(
    gen_random_uuid(),
    'Boundaries & Safety',
    'Important guidelines to follow',
    'shield-checkmark-outline',
    ARRAY[
        'Never share personal financial information',
        'Don''t accept or give expensive gifts',
        'Respect their privacy and confidentiality',
        'Report any concerns to the saathi coordinator',
        'Don''t provide medical advice or assistance'
    ],
    4,
    true,
    NOW(),
    NOW()
);

-- ============================================================================
-- 2. SAATHI SUGGESTED ACTIVITIES
-- ============================================================================
DELETE FROM "public"."saathi_suggested_activities";

INSERT INTO "public"."saathi_suggested_activities" (
    "id",
    "title",
    "duration",
    "difficulty",
    "sortOrder",
    "isActive",
    "createdAt",
    "updatedAt"
) VALUES
(gen_random_uuid(), 'Tea & Conversation', '1-2 hours', 'Easy', 1, true, NOW(), NOW()),
(gen_random_uuid(), 'Board Games or Cards', '1-2 hours', 'Easy', 2, true, NOW(), NOW()),
(gen_random_uuid(), 'Short Walks', '30-60 mins', 'Moderate', 3, true, NOW(), NOW()),
(gen_random_uuid(), 'Reading Together', '30-60 mins', 'Easy', 4, true, NOW(), NOW()),
(gen_random_uuid(), 'Photo Album Viewing', '1 hour', 'Easy', 5, true, NOW(), NOW()),
(gen_random_uuid(), 'Light Gardening', '1-2 hours', 'Moderate', 6, true, NOW(), NOW()),
(gen_random_uuid(), 'Technology Help', '30-60 mins', 'Moderate', 7, true, NOW(), NOW()),
(gen_random_uuid(), 'Grocery Shopping', '1-2 hours', 'Moderate', 8, true, NOW(), NOW());

-- ============================================================================
-- 3. SAATHI FAQS
-- ============================================================================
DELETE FROM "public"."saathi_faqs";

INSERT INTO "public"."saathi_faqs" (
    "id",
    "question",
    "answer",
    "sortOrder",
    "isActive",
    "createdAt",
    "updatedAt"
) VALUES
(
    gen_random_uuid(),
    'What if the beneficiary seems unwell during my visit?',
    'If it is an emergency, contact Emergency Services immediately. Otherwise, inform the saathi coordinator through the emergency support channel.',
    1,
    true,
    NOW(),
    NOW()
),
(
    gen_random_uuid(),
    'How do I handle difficult conversations or emotions?',
    'Listen empathetically without judgment. Do not try to "fix" their feelings. If you feel overwhelmed, contact your saathi coordinator for guidance.',
    2,
    true,
    NOW(),
    NOW()
),
(
    gen_random_uuid(),
    'What if I need to cancel a scheduled visit?',
    'Please use the app to reschedule or cancel at least 24 hours in advance so the beneficiary can be notified promptly.',
    3,
    true,
    NOW(),
    NOW()
),
(
    gen_random_uuid(),
    'Can I bring someone else along to visits?',
    'No, for safety and privacy reasons, only verified Saathi volunteers are permitted to conduct visits.',
    4,
    true,
    NOW(),
    NOW()
),
(
    gen_random_uuid(),
    'How do I build rapport with someone I just met?',
    'Start with simple conversation starters, be patient, and show genuine interest in their stories. Consistency in your visits is key.',
    5,
    true,
    NOW(),
    NOW()
);
```

---

## 4. Raw API JSON Response (`GET /api/public/sathi-guide`)

```json
{
  "success": true,
  "data": {
    "bestPractices": [
      {
        "title": "Be Present & Empathetic",
        "description": "Active listening and genuine care are your most important tools",
        "icon": "heart-outline",
        "points": [
          "Give your full attention during visits",
          "Listen more than you speak",
          "Show genuine interest in their stories and experiences",
          "Be patient and allow them to share at their own pace"
        ],
        "sortOrder": 1,
        "isActive": true
      },
      {
        "title": "Conversation Starters",
        "description": "Topics that often lead to meaningful connections",
        "icon": "chatbubble-outline",
        "points": [
          "Ask about their family and childhood memories",
          "Discuss hobbies, interests, or past careers",
          "Talk about current events or local community news",
          "Share appropriate stories from your own life",
          "Ask for their advice or wisdom on topics"
        ],
        "sortOrder": 2,
        "isActive": true
      },
      {
        "title": "Visit Structure",
        "description": "Make the most of your time together",
        "icon": "time-outline",
        "points": [
          "Arrive on time and stay for the planned duration",
          "Start with a warm greeting and casual conversation",
          "Engage in agreed-upon activities (tea, games, walks)",
          "End visits positively and confirm next meeting",
          "Typical visits last 1-2 hours"
        ],
        "sortOrder": 3,
        "isActive": true
      },
      {
        "title": "Boundaries & Safety",
        "description": "Important guidelines to follow",
        "icon": "shield-checkmark-outline",
        "points": [
          "Never share personal financial information",
          "Don't accept or give expensive gifts",
          "Respect their privacy and confidentiality",
          "Report any concerns to the saathi coordinator",
          "Don't provide medical advice or assistance"
        ],
        "sortOrder": 4,
        "isActive": true
      }
    ],
    "suggestedActivities": [
      {
        "title": "Tea & Conversation",
        "duration": "1-2 hours",
        "difficulty": "Easy",
        "sortOrder": 1,
        "isActive": true
      },
      {
        "title": "Board Games or Cards",
        "duration": "1-2 hours",
        "difficulty": "Easy",
        "sortOrder": 2,
        "isActive": true
      },
      {
        "title": "Short Walks",
        "duration": "30-60 mins",
        "difficulty": "Moderate",
        "sortOrder": 3,
        "isActive": true
      },
      {
        "title": "Reading Together",
        "duration": "30-60 mins",
        "difficulty": "Easy",
        "sortOrder": 4,
        "isActive": true
      },
      {
        "title": "Photo Album Viewing",
        "duration": "1 hour",
        "difficulty": "Easy",
        "sortOrder": 5,
        "isActive": true
      },
      {
        "title": "Light Gardening",
        "duration": "1-2 hours",
        "difficulty": "Moderate",
        "sortOrder": 6,
        "isActive": true
      },
      {
        "title": "Technology Help",
        "duration": "30-60 mins",
        "difficulty": "Moderate",
        "sortOrder": 7,
        "isActive": true
      },
      {
        "title": "Grocery Shopping",
        "duration": "1-2 hours",
        "difficulty": "Moderate",
        "sortOrder": 8,
        "isActive": true
      }
    ],
    "faqs": [
      {
        "question": "What if the beneficiary seems unwell during my visit?",
        "answer": "If it is an emergency, contact Emergency Services immediately. Otherwise, inform the saathi coordinator through the emergency support channel.",
        "sortOrder": 1,
        "isActive": true
      },
      {
        "question": "How do I handle difficult conversations or emotions?",
        "answer": "Listen empathetically without judgment. Do not try to \"fix\" their feelings. If you feel overwhelmed, contact your saathi coordinator for guidance.",
        "sortOrder": 2,
        "isActive": true
      },
      {
        "question": "What if I need to cancel a scheduled visit?",
        "answer": "Please use the app to reschedule or cancel at least 24 hours in advance so the beneficiary can be notified promptly.",
        "sortOrder": 3,
        "isActive": true
      },
      {
        "question": "Can I bring someone else along to visits?",
        "answer": "No, for safety and privacy reasons, only verified Saathi volunteers are permitted to conduct visits.",
        "sortOrder": 4,
        "isActive": true
      },
      {
        "question": "How do I build rapport with someone I just met?",
        "answer": "Start with simple conversation starters, be patient, and show genuine interest in their stories. Consistency in your visits is key.",
        "sortOrder": 5,
        "isActive": true
      }
    ]
  }
}
```
