---
trigger: always_on
---

19. ASYNCHRONOUS PROCESSING

If a task does not need to block the request, consider asynchronous processing.

Examples:

API
↓
Queue
↓
Worker
↓
Email / SMS / WhatsApp

Good candidates:

notifications

emails

reports

analytics

image processing

large file processing

external integrations

background synchronization

Consider:

retries

idempotency

dead-letter queues

duplicate processing

visibility timeout

failure recovery

20. EXTERNAL SERVICES

Never tightly couple business logic directly to third-party SDKs.

Instead of:

PaymentService
↓
Razorpay SDK everywhere

prefer:

PaymentService
↓
PaymentProvider Interface
↓
RazorpayAdapter

This makes it easier to:

test

replace providers

add another provider

mock external systems

Same concept applies to:

payment

SMS

email

WhatsApp

cloud storage

maps

AI providers

21. CONFIGURATION

Separate configuration from business logic.

Use:

Environment Variables
Configuration Module
Secrets Manager

Avoid:

if (process.env.NODE_ENV === "production") {
// random production logic
}

scattered throughout the application.

Centralize configuration where practical.

Validate required configuration at application startup.

22. TYPESCRIPT / TYPE SAFETY

Use strong typing.

Avoid unnecessary:

any

Prefer:

unknown

when the type is genuinely unknown.

Create meaningful:

interfaces

types

enums

DTOs

Avoid excessive type duplication.

Keep domain types close to their domain when appropriate.

23. TRANSACTIONS AND CONSISTENCY

Whenever multiple operations represent one business transaction, ask:

What happens if step 3 fails after step 1 and 2 succeed?

For example:

Create Payment
↓
Activate Subscription
↓
Deduct Benefit
↓
Create Ledger

Determine whether these operations need:

database transaction

saga

compensation

event-driven processing

Never assume multi-step workflows are automatically atomic.

24. IDEMPOTENCY

For operations that may be retried, ask:

What happens if this request executes twice?

Especially for:

payments

webhooks

subscriptions

notifications

orders

background jobs

Use appropriate:

idempotency keys

unique constraints

processed-event tables

state transitions

25. CONCURRENCY

Always consider race conditions when modifying shared state.

Example:

Request A → balance = 5
Request B → balance = 5

A deducts 3
B deducts 4

Result may become invalid

Think about:

atomic updates

database transactions

row locks

optimistic concurrency

unique constraints

distributed locks

26. STATE MACHINES / STATE TRANSITIONS

When a domain has multiple states, explicitly model them.

Example:

PENDING
↓
PROCESSING
↓
SUCCESS
↓
FAILED

Do not scatter state transitions randomly across the codebase.

Centralize important state transition rules.

Prevent invalid transitions.

27. TESTABILITY

Write code that can be tested.

Avoid tightly coupled code such as:

function processPayment() {
// directly calls Razorpay
// directly calls DB
// directly sends email
}

Prefer dependency boundaries.

Tests should cover:

Unit Tests

Business logic.

Integration Tests

Database/external boundaries.

API Tests

Request/response behavior.

Edge Cases

invalid input

missing data

duplicate requests

retries

race conditions

external service failure

28. CODE QUALITY

Code should be:

readable

explicit

predictable

consistent

Prefer clear code over clever code.

Bad:

const x = a?.b?.c?.d ?? foo?.bar ?? baz;

when the business meaning is unclear.

Prefer meaningful names.

Bad:

const d = getData();

Better:

const subscriptionDetails = getSubscriptionDetails();

29. COMMENTS

Do NOT comment obvious code.

Bad:

// Increment count by 1
count++;

Comments should explain:

WHY

not:

WHAT

Good:

// We intentionally process this webhook asynchronously because
// the provider retries requests when the response exceeds 5 seconds.

30. BACKWARD COMPATIBILITY

Before changing existing behavior, identify:

existing API consumers

mobile clients

admin clients

database dependencies

background workers

external integrations

Avoid breaking existing contracts unnecessarily.

If breaking changes are required, consider:

versioning

migration

backward compatibility

deprecation period

31. MIGRATIONS

Never casually modify production database structure.

For schema changes, think through:

Current schema
↓
Migration
↓
Backward compatibility
↓
Application deployment
↓
Data migration
↓
Cleanup

Prefer zero/minimal downtime migrations.

32. FILE PLACEMENT RULE

Before creating a file, ask:

Which domain owns this?

Then:

Is this domain-specific or shared infrastructure?

Then:

Will another module reasonably reuse it?

Use structures such as:

src/
├── modules/
│ ├── auth/
│ ├── users/
│ ├── payments/
│ ├── subscriptions/
│ └── notifications/
│
├── shared/
│ ├── errors/
│ ├── middleware/
│ ├── logger/
│ ├── config/
│ └── utils/
│
├── infrastructure/
│ ├── database/
│ ├── redis/
│ ├── queues/
│ └── external-services/
│
└── app/
├── routes/
└── server.ts

Adapt this structure to the existing repository rather than forcing it.

33. DO NOT CREATE "UTILS" DUMPING GROUNDS

Avoid:

utils.ts
helpers.ts
common.ts
misc.ts

containing 50 unrelated functions.

Instead organize utilities by responsibility:

shared/
├── date/
├── crypto/
├── validation/
├── pagination/
└── formatting/

Only create shared utilities when they are actually shared.

34. AVOID GOD CLASSES

Do not create:

UserService

that handles:

authentication

payments

subscriptions

notifications

analytics

file uploads

reporting

Break responsibilities into cohesive services.

35. AVOID GOD FUNCTIONS

If a function handles:

validation
database
business logic
notifications
payments
analytics

it is probably doing too much.

Split it.

36. DON'T OVER-ENGINEER

Senior engineering does NOT mean:

Add microservices + Kafka + Redis + Kubernetes + event sourcing to everything.

Instead ask:

What is the simplest architecture that satisfies
today's requirements while keeping reasonable room for growth?

Use complexity only when complexity buys something valuable.

37. SCALABILITY THINKING

When implementing important functionality, mentally evaluate:

1x

Does it work?

10x

Does it remain efficient?

100x

What becomes the bottleneck?

1000x

What architectural boundary breaks?

Consider:

Application servers
Database
Connection pools
Queues
Redis
Storage
Network
Third-party APIs

38. OBSERVE EXISTING PATTERNS

If the repository already has an established architecture, follow it unless there is a strong reason to change it.

Do not introduce:

Pattern A

into one module while the rest of the codebase uses:

Pattern B

without justification.

Consistency matters.

39. REFACTOR WHEN NECESSARY

If the requested change exposes poor architecture:

Identify the architectural problem.

Determine whether refactoring is necessary.

Prefer the smallest safe refactor.

Preserve existing behavior.

Then implement the new feature.

Do not blindly add more complexity on top of bad architecture.

40. BEFORE WRITING CODE — ARCHITECTURE CHECK

For every significant feature, determine:

Feature
↓
Domain
↓
Module
↓
Controller/API
↓
Service
↓
Repository
↓
Database

And where applicable:

        ┌── Cache
        │

API → Service → Database
│
├── Queue
│ ↓
│ Worker
│
└── External Service

41. BEFORE FINALIZING CODE

Perform a mental code review.

Ask:

Architecture

Is this in the correct module?

Is responsibility separated correctly?

Is coupling reasonable?

Code

Are functions too large?

Are files too large?

Is there duplication?

Can this be reused?

Database

Any N+1 queries?

Missing indexes?

Transaction required?

Race condition?

API

Correct status codes?

Validation?

Authorization?

Pagination?

Security

Any secrets?

Any injection risk?

Any authorization gap?

Sensitive data leakage?

Scalability

What happens at 10x traffic?

What happens at 100x?

Is synchronous processing appropriate?

Reliability

What happens if the database fails?

What happens if an external API fails?

What happens if the request retries?

Is the operation idempotent?

Maintainability

Can another senior engineer understand this quickly?

Can requirements change without rewriting everything?

42. WHEN MODIFYING EXISTING CODE

Do not rewrite entire files unnecessarily.

Prefer:

Understand
→ Isolate
→ Refactor if needed
→ Modify
→ Test

Preserve existing functionality.

Do not introduce unrelated changes.

Avoid "while I'm here" refactors unless they are necessary for correctness or maintainability.

43. WHEN SOMETHING IS UNCLEAR

Do not make a dangerous assumption.

If ambiguity materially affects architecture or behavior:

identify the ambiguity

explain the impact

ask for clarification

If the ambiguity is minor and a safe convention exists:

make the reasonable choice

document it briefly

44. RESPONSE FORMAT FOR MAJOR IMPLEMENTATIONS

Before implementing a significant feature, provide a concise architecture summary:

Architecture:

- Where the feature belongs
- Components involved
- Data flow
- Database changes
- External dependencies
- Async processing if applicable
- Important edge cases

Then implement.

Do not produce unnecessary documentation for trivial changes.

45. PRINCIPAL ENGINEER MINDSET

Always think beyond:

"How do I make this code work?"

Think:

"How should this system behave?"

"Where does this responsibility belong?"

"What happens when this fails?"

"What happens when this runs concurrently?"

"What happens when traffic grows?"

"What happens when requirements change?"

"Can this component be tested independently?"

"Can this dependency be replaced?"

"Will this create technical debt?"

"Would I approve this PR in a production engineering team?"

46. GOLDEN RULE

DO NOT OPTIMIZE FOR:

Fewest lines of code
Fastest implementation
Most sophisticated architecture
Most design patterns
Most microservices

OPTIMIZE FOR:

Correctness +
Clarity +
Modularity +
Maintainability +
Reliability +
Security +
Scalability +
Appropriate simplicity

The best engineer is not the engineer who writes the most code.

The best engineer is the engineer who designs the system so that the RIGHT code needs to be written.
