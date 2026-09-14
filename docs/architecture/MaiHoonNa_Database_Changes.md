# MaiHoonNa Invoice & Billing — Database Changes (against `schema.prisma`)

Supersedes the earlier generic version of this file, which used illustrative table names (`users`, `bookings`) before your real `schema.prisma` was available. Everything below refers to your actual models. The copy-pasteable Prisma changes are in `invoice_schema_changes.prisma`; this file explains the *why* and the rollout plan.

---

## 1. The actual problem

`Payment` is already your de facto invoice — it has `invoiceNumber` directly on it. But `Payment.subscriptionId` is **required** (`String`, not `String?`), and `Payment` has no way to reference an `Appointment`. So today, a one-off service booking (an `Appointment` with no `Subscription` behind it) **cannot be invoiced at all** — there's no valid row you can insert. "Invoice is for subscriber" is a schema constraint, not just a convention.

The fix: a real `Invoice` model that can hang off either a `Subscription` **or** an `Appointment`, with `Payment` referencing `Invoice` instead of requiring `Subscription` directly.

---

## 2. What's genuinely new vs. what already exists

Before adding anything, here's what your schema already covers, so nothing gets duplicated:

| Need | Already exists as | Verdict |
| --- | --- | --- |
| Invoice number | `Payment.invoiceNumber` | Reused — moves onto the new `Invoice.invoiceNumber` |
| Payment record / gateway fields / refund fields | `Payment` (gatewayName, gatewayOrderId, refundId, refundAmount, etc.) | **Kept as-is** — `Payment` stays the payment-transaction record |
| Audit trail | `ActivityLog` (userId, type, action, details Json, status) | Reused — no new `AuditLog` table needed |
| Invoice/payment notifications | `Notification` + `NotificationType` (already has `payment_due`, `payment_success`, `payment_failed`) | Reused — optionally extend the enum |
| GST invoice structure (place of supply, CGST/SGST/IGST, HSN/SAC) | Nothing | **New** — didn't exist anywhere |
| Line-item breakdown | Nothing (`Payment` is one flat row) | **New** |
| Booking-based (Service) invoicing | Nothing (`Payment.subscriptionId` required) | **New** |
| Atomic invoice-number sequence | Nothing (`SystemConfig` exists but is string-valued, not built for atomic increments) | **New**, small dedicated table |

---

## 3. New models

| Model | Purpose |
| --- | --- |
| `Invoice` | The billing document — Subscription or Service type, GST breakdown, status |
| `InvoiceItem` | Line items, snapshotting `hsnSacCode`/`taxRate` at creation time |
| `InvoiceCounter` | One row per financial year, atomically incremented for invoice numbering |

Full field-by-field definitions are in `invoice_schema_changes.prisma`.

## 4. Edits to existing models

| Model | Change |
| --- | --- |
| `Payment` | Add `invoiceId String?` + relation. **Change `subscriptionId` from required to optional** — this is the actual fix, not a side effect. |
| `User` | Add `gstin String?` (prefill convenience) and back-relation `invoices Invoice[]`. |
| `Subscription` | Add back-relation `invoices Invoice[]`. |
| `Beneficiary` | Add back-relation `invoices Invoice[]`. |
| `Appointment` | Add back-relation `invoice Invoice?` (one invoice per appointment, enforced via `@unique` on `Invoice.appointmentId`). |
| `Benefit` | Add `hsnSacCode String?`, `gstRate Float?`, `isGstExempt Boolean @default(false)`, back-relation `invoiceItems InvoiceItem[]`. |
| `SubscriptionPackage` | Add the same three GST fields as `Benefit`. |
| `ActivityLog` *(optional but recommended)* | `userId` → optional, so system/cron-triggered invoice actions (e.g. recurring subscription billing) can still be logged without a fake acting user. |

GST fields went directly onto `Benefit` and `SubscriptionPackage` — where your pricing fields already live — rather than a separate `TaxConfiguration` lookup table. `InvoiceItem` already snapshots `hsnSacCode`/`taxRate` at creation time, so the "don't retroactively change historical invoices" concern is handled at that layer regardless of where the *current* rate is configured. A separate time-versioned rate table is a reasonable later addition if GST rates start changing on a schedule you need to track historically — not needed for v1.

---

## 5. Rollout plan (backfilling existing `Payment` rows)

Because `Payment.subscriptionId` is currently required and populated for every existing row, you have real data to migrate, not just a fresh empty table:

1. **Add new tables and nullable columns first.** `Invoice`, `InvoiceItem`, `InvoiceCounter`, plus `Payment.invoiceId` (nullable) and `Payment.subscriptionId` staying required *for now*. This is a purely additive, zero-downtime migration.
2. **Backfill.** For every existing `Payment` row, create one `Invoice` row: `invoiceType = SUBSCRIPTION`, `subscriptionId = payment.subscriptionId`, `invoiceNumber = payment.invoiceNumber` (generate one via the new counter for any row where it's null), totals copied from `payment.baseAmount` / `discountAmount` / `taxAmount` / `amountPaid`. Set `payment.invoiceId` to the newly created invoice's id.
3. **Flip the constraint.** Once every row has an `invoiceId`, make `Payment.subscriptionId` optional in a follow-up migration (schema change 6 in `invoice_schema_changes.prisma`). This is the point at which Service-invoice payments become insertable for the first time.
4. **New code paths (Service invoices) can ship immediately after step 3** — they don't depend on anything about historical data being "clean," only on `subscriptionId` no longer being a hard requirement.

---

## 6. Open items

| Item | Affects | Status |
| --- | --- | --- |
| HSN/SAC code(s) and GST rate for Care Mitra / Saathi services | `Benefit.hsnSacCode/gstRate`, `SubscriptionPackage.hsnSacCode/gstRate` | **TBD — requires CA (Arpit Suri) confirmation**, same open item as the invoice template itself |
| Whether services are GST-exempt healthcare | `Benefit.isGstExempt`, `SubscriptionPackage.isGstExempt` | **TBD — CA confirmation** |
| Whether Service invoices should trigger at `Appointment` confirmation or at `Visit` completion | `Invoice.appointmentId` design (currently keyed to Appointment, not Visit) | **TBD — confirm with product** before building the invoice-creation trigger |
| Whether multiple partial refunds per payment need individual tracking (vs. the single refundAmount/refundedAt fields already on `Payment`) | Possible future `PaymentRefund` child table | Not needed for v1 — flag only if a payment can be refunded more than once |
