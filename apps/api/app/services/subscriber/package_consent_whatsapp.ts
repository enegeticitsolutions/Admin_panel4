import prisma from '../../core/database';
import { consentNotificationService } from '@maihoonna/notifications';

/**
 * Loads subscription context and delegates `package_consent_activation` WhatsApp
 * dispatch directly to `@maihoonna/notifications` (`consentNotificationService`).
 */
export async function dispatchPackageConsentForSubscription(subscriptionId: string): Promise<void> {
  try {
    if (!subscriptionId) return;

    const sub = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        subscriber: { select: { id: true, name: true, phone: true } },
        beneficiary: {
          select: {
            id: true,
            userId: true,
            name: true,
            user: { select: { phone: true } },
          },
        },
        package: { select: { name: true } },
      },
    });

    if (!sub) return;

    await consentNotificationService.sendPackageConsentActivation({
      subscriptionId: sub.id,
      subscriber: sub.subscriber,
      beneficiary: sub.beneficiary,
      packageName: sub.package?.name || sub.packageType || 'Care Package',
    });
  } catch (err: any) {
    console.error('[PackageConsentWA] Dispatch error:', err.message);
  }
}
