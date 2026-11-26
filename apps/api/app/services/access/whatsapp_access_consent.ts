import prisma from '../../core/database';
import { consentNotificationService } from '@maihoonna/notifications';

/**
 * Loads active SELF + MANAGER recipients for a CareAccessRequest from DB
 * and delegates outbound WhatsApp delivery to `@maihoonna/notifications`.
 */
export async function dispatchAccessRequestWhatsApp(requestId: string): Promise<void> {
  try {
    const reqRecord = await prisma.careAccessRequest.findUnique({
      where: { id: requestId },
      include: {
        beneficiary: {
          select: {
            id: true,
            name: true,
            careCircleMembers: {
              where: {
                status: 'active',
                OR: [{ accessRole: { in: ['SELF', 'MANAGER'] } }, { canManageAccess: true }],
              },
              include: {
                user: { select: { id: true, name: true, phone: true } },
              },
            },
          },
        },
        requester: { select: { id: true, name: true, phone: true } },
      },
    });

    if (!reqRecord || reqRecord.status !== 'PENDING') return;

    await consentNotificationService.sendProfileAccessRequest({
      requestId,
      requesterName: reqRecord.requester?.name || reqRecord.requester?.phone || 'A family member',
      relationship: reqRecord.relationship || 'Family Member',
      accessLevel: reqRecord.requestedRole === 'EDITOR' ? 'Manage' : 'View Only',
      recipients: reqRecord.beneficiary.careCircleMembers.map((m) => ({
        name: m.user?.name || reqRecord.beneficiary.name,
        phone: m.user?.phone,
      })),
    });
  } catch (err: any) {
    console.error('[WhatsApp Access Consent] Outbound dispatch error:', err.message);
  }
}

/**
 * Delegates decision confirmation WhatsApp (`profile_access_decision`) to `@maihoonna/notifications`.
 */
export async function dispatchAccessDecisionWhatsApp(params: {
  requestId: string;
  requesterPhone?: string | null;
  requesterName?: string | null;
  beneficiaryName: string;
  decision: 'Approved' | 'Declined';
}): Promise<void> {
  try {
    await consentNotificationService.sendProfileAccessDecision(params);
  } catch (err: any) {
    console.error('[WhatsApp Access Consent] Decision dispatch error:', err.message);
  }
}
