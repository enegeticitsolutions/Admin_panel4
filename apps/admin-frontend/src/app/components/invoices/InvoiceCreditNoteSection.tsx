import React, { useState } from 'react';
import { RotateCcw, FileCheck2 } from 'lucide-react';
import { IssueCreditNoteModal } from '../modals/IssueCreditNoteModal';
import { CreditNoteViewModal } from '../modals/CreditNoteViewModal';

export interface CreditNoteItem {
  id: string;
  creditNoteNumber: string;
  totalAmount: number;
  status: string;
  refundMode?: string;
  issuedAt?: string;
}

export interface InvoiceCreditNoteProps {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  status: string;
  creditNotes?: CreditNoteItem[];
}

interface InvoiceCreditNoteSectionProps {
  invoice: InvoiceCreditNoteProps;
  onSuccess?: () => void;
  showButton?: boolean;
  showList?: boolean;
}

/**
 * Reusable Badge showing total refunded amount against an invoice.
 */
export const InvoiceRefundBadge: React.FC<{
  creditNotes?: CreditNoteItem[];
  className?: string;
}> = ({ creditNotes, className = '' }) => {
  const totalRefunded = (creditNotes || [])
    .filter((cn) => cn.status !== 'VOID')
    .reduce((sum, cn) => sum + (Number(cn.totalAmount) || 0), 0);

  if (totalRefunded <= 0) return null;

  return (
    <span
      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border bg-purple-50 text-purple-700 border-purple-200 ${className}`}
    >
      ₹{totalRefunded.toFixed(2)} Refunded
    </span>
  );
};

/**
 * Self-contained component for managing Credit Notes and Refunds on an Invoice.
 * Handles the Refund trigger button, issued Credit Note pills, and dialog modals.
 */
export const InvoiceCreditNoteSection: React.FC<InvoiceCreditNoteSectionProps> = ({
  invoice,
  onSuccess,
  showButton = true,
  showList = true,
}) => {
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [viewingCreditNoteId, setViewingCreditNoteId] = useState<string | null>(null);
  const [viewingCreditNoteNumber, setViewingCreditNoteNumber] = useState<string | undefined>(undefined);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const totalRefunded = (invoice.creditNotes || [])
    .filter((cn) => cn.status !== 'VOID')
    .reduce((sum, cn) => sum + (Number(cn.totalAmount) || 0), 0);

  const isFullyRefunded = totalRefunded >= Number(invoice.totalAmount) - 0.05 && totalRefunded > 0;
  const isPaid = invoice.status === 'PAID' || Number(invoice.totalAmount) > 0;

  const handleOpenViewModal = (id: string, number?: string) => {
    setViewingCreditNoteId(id);
    setViewingCreditNoteNumber(number);
    setIsViewModalOpen(true);
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        {/* Action Button */}
        {showButton && isPaid && (
          <button
            type="button"
            onClick={() => setIsIssueModalOpen(true)}
            disabled={isFullyRefunded}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-colors disabled:opacity-50 ${
              isFullyRefunded
                ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-white border-purple-200 text-purple-700 hover:bg-purple-50 hover:border-purple-400'
            }`}
            title={isFullyRefunded ? 'Invoice fully refunded' : 'Issue Credit Note / Refund against this invoice'}
          >
            <RotateCcw size={12} />
            <span>{isFullyRefunded ? 'Refunded' : 'Refund'}</span>
          </button>
        )}

        {/* Issued Credit Notes Pill List */}
        {showList && invoice.creditNotes && invoice.creditNotes.length > 0 && (
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] font-bold text-gray-400">Credit Notes:</span>
            {invoice.creditNotes.map((cn) => (
              <button
                key={cn.id}
                type="button"
                onClick={() => handleOpenViewModal(cn.id, cn.creditNoteNumber)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 text-xs font-semibold transition-colors border border-purple-200"
                title="View Credit Note Document"
              >
                <FileCheck2 size={12} />
                <span>{cn.creditNoteNumber}</span>
                <span className="text-[10px] font-normal opacity-75">
                  (₹{Number(cn.totalAmount).toFixed(2)})
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Self-contained Issue Credit Note Modal */}
      <IssueCreditNoteModal
        isOpen={isIssueModalOpen}
        onClose={() => setIsIssueModalOpen(false)}
        invoiceId={invoice.id}
        invoiceNumber={invoice.invoiceNumber}
        invoiceTotalAmount={invoice.totalAmount}
        onSuccess={(createdCreditNote) => {
          onSuccess?.();
          if (createdCreditNote?.id) {
            handleOpenViewModal(createdCreditNote.id, createdCreditNote.creditNoteNumber);
          }
        }}
      />

      {/* Self-contained View Credit Note Modal */}
      <CreditNoteViewModal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setViewingCreditNoteId(null);
        }}
        creditNoteId={viewingCreditNoteId}
        creditNoteNumber={viewingCreditNoteNumber}
      />
    </>
  );
};

/**
 * Standalone Refund trigger button (holds modal state internally).
 */
export const InvoiceRefundButton: React.FC<{
  invoice: InvoiceCreditNoteProps;
  onSuccess?: () => void;
}> = ({ invoice, onSuccess }) => {
  return <InvoiceCreditNoteSection invoice={invoice} onSuccess={onSuccess} showList={false} />;
};

/**
 * Standalone Credit Notes pill list (holds view modal state internally).
 */
export const InvoiceCreditNoteList: React.FC<{
  invoice: InvoiceCreditNoteProps;
}> = ({ invoice }) => {
  return <InvoiceCreditNoteSection invoice={invoice} showButton={false} />;
};

export default InvoiceCreditNoteSection;
