import React, { useState } from 'react';
import { MessageSquare, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { enrollmentApi } from '../../../services/api';
import { Button } from '../ui/button';

interface SendPackageConsentButtonProps {
  subscriptionId?: string;
  subscriberEmail?: string;
  subscriberName?: string;
  subscriberPhone?: string;
  beneficiaryName?: string;
  beneficiaryPhone?: string;
  relationship?: string;
  packageName?: string;
  label?: string;
}

/**
 * Self-contained button component that dispatches the approved MSG91
 * `package_consent_activation` WhatsApp consent message (+ optional email).
 */
export const SendPackageConsentButton: React.FC<SendPackageConsentButtonProps> = ({
  subscriptionId,
  subscriberEmail,
  subscriberName,
  subscriberPhone,
  beneficiaryName,
  beneficiaryPhone,
  relationship,
  packageName,
  label = 'Send WhatsApp Consent',
}) => {
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const cleanSubPhone = String(subscriberPhone || '').replace(/\D/g, '');
    const cleanBenPhone = String(beneficiaryPhone || '').replace(/\D/g, '');
    if (cleanSubPhone.length < 10 && cleanBenPhone.length < 10) {
      toast.error('No valid 10-digit subscriber or beneficiary mobile number found.');
      return;
    }

    setSending(true);
    try {
      const res = await enrollmentApi.sendActivationConsent({
        subscriptionId,
        subscriberEmail,
        subscriberName,
        subscriberPhone,
        beneficiaryName,
        beneficiaryPhone,
        relationship,
        packageName,
      });

      const waResults: any[] = res?.results?.whatsapp || [];
      const deliveredCount = waResults.filter((r) => r.success).length;

      if (deliveredCount > 0) {
        toast.success(`WhatsApp consent sent successfully (${deliveredCount} recipient${deliveredCount > 1 ? 's' : ''})!`);
      } else if (waResults.length > 0) {
        const firstErr = waResults.find((r) => !r.success)?.error;
        toast.error(firstErr || 'WhatsApp consent dispatch failed. Check MSG91 configuration.');
      } else {
        toast.success(res?.message || 'Consent notification dispatched!');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to dispatch WhatsApp consent');
    } finally {
      setSending(false);
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={sending}
      onClick={handleSend}
      className="border-emerald-300 text-emerald-700 hover:bg-emerald-600 hover:text-white font-bold text-xs gap-1.5 shadow-sm shrink-0"
    >
      {sending ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Sending...
        </>
      ) : (
        <>
          <MessageSquare className="w-3.5 h-3.5" />
          {label}
        </>
      )}
    </Button>
  );
};

export default SendPackageConsentButton;
