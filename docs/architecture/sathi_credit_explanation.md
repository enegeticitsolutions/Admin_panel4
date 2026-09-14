# Sathi App & Credit Redemption Overview

This document provides a high-level explanation of the Sathi App and its Credit Redemption ecosystem, designed for AI agents like ChatGPT to quickly understand the core mechanics and database schema of the project.

## 1. What is the Sathi App?
The Sathi App is a volunteer/companion application within the MHN (May I Help Network) ecosystem. Users acting as "Sathis" (volunteers or care companions) are assigned to "Beneficiaries" (typically elderly or individuals needing companionship/care). 

Sathis log their visits with beneficiaries and, in return, earn **Credits (Points)** for the time they spend volunteering. These credits can later be redeemed for real-world value like UPI cash transfers, gift cards, or discount coupons.

## 2. Core Entities & Database Schema

The core models related to the Sathi ecosystem (found in `packages/database/prisma/schema.prisma`) are:

* **`Volunteer` (The Sathi)**: The profile for the volunteer. Tracks `totalCreditHours` and `totalCreditPoints`.
* **`VolunteerAssignment`**: Maps a `Volunteer` to a `Beneficiary`.
* **`VolunteerVisitLog`**: The actual visit log. Tracks `checkInTime`, `checkOutTime`, `minutesLogged`, `hoursEarned`, and crucially, `creditPointsEarned`. This is the event that generates credits.
* **`VolunteerCreditTransaction`**: The financial ledger for points. Tracks every addition or deduction of points with a running balance (`minutesDelta`, `pointsDelta`, `balanceAfter`, `type`).
* **`VolunteerRewardOption`**: Represents what points can be redeemed for (e.g., "MHN Gift Card ₹500").
* **`VolunteerRewardCoupon`**: A generated voucher when a Sathi redeems points for a gift card. It contains a unique code (e.g., `MHN-GIFT-XXXX-XXXX`) and a monetary value.

## 3. How Credits are Earned

1. **Visit Logging**: A Sathi checks in and checks out of a visit with a beneficiary.
2. **Calculation**: 
   * `minutesLogged` is calculated from the visit duration.
   * `hoursEarned` = `minutesLogged` / 60.
3. **Conversion**: 
   * `creditPointsEarned` = `hoursEarned` * `conversionRate`.
   * The `conversionRate` is fetched from `SystemConfig` (key: `VOLUNTEER_CREDIT_CONVERSION_RATE`), typically defaulting to 10.
4. **Ledger Update**: A `VolunteerCreditTransaction` of type `earned` is created, and the `Volunteer`'s `totalCreditPoints` balance is updated.

## 4. How Credit Redemption Works

The redemption logic is primarily handled in `apps/api/app/services/sathi/sathi_service.ts` (`redeemVolunteerCredits` function).

Sathis can redeem their accumulated points through several avenues:

1. **Validation**: The system checks if the Sathi has sufficient `totalCreditPoints`.
2. **Deduction**: The requested points are subtracted from the Sathi's balance, and a `VolunteerCreditTransaction` of type `redeemed` (with a negative `pointsDelta`) is recorded in the ledger.
3. **Redemption Types**:
   * **`UPI_TRANSFER`**: The system records a redemption against the provided UPI ID for a direct cash transfer.
   * **`GIFT_CARD` / `MHN_GIFT_CARD`**: The system generates a unique `VolunteerRewardCoupon` (format: `MHN-GIFT-XXXX-XXXX`). The real-world monetary value of this coupon is `points * conversionRate`.
   * **`DISCOUNT_COUPON`**: Redeemed for an MHN Care Discount Coupon.

## 5. Gift Card Claiming Lifecycle
When a Sathi redeems points for a Gift Card, the resulting `VolunteerRewardCoupon` starts in an `ACTIVE` status. 
* These coupons can be used within the platform (e.g., to subsidize or pay for subscriptions or services for a beneficiary).
* Once used, the coupon status is updated to `CLAIMED` and associated with the `claimedByUserId`.
* Validation endpoints (`validateVolunteerCoupon`, `claimVolunteerCoupon`) exist to securely verify and consume these vouchers.
