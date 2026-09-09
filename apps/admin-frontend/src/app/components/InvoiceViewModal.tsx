import React, { useState, useEffect } from 'react';
import { X, Printer, FileText, Loader2, AlertCircle } from 'lucide-react';
import { invoicesApi } from '../../services/api';

interface InvoiceViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string | null;
}

export const InvoiceViewModal: React.FC<InvoiceViewModalProps> = ({ isOpen, onClose, invoiceId }) => {
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!isOpen || !invoiceId) {
      setHtmlContent('');
      setError('');
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError('');

    invoicesApi.fetchInvoiceHtml(invoiceId)
      .then((html) => {
        if (isMounted) {
          setHtmlContent(html);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to load invoice preview');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, invoiceId]);

  if (!isOpen || !invoiceId) return null;

  const handlePrint = () => {
    const iframe = document.getElementById('admin-invoice-print-frame') as HTMLIFrameElement | null;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[110] p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-[#FF7A00]">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">GST Tax Invoice Preview</h3>
              <p className="text-xs text-gray-500 font-medium">Ref: {invoiceId}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              disabled={loading || !!error}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF7A00] text-white text-xs font-bold hover:bg-[#e66e00] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer size={15} />
              Print / Save as PDF
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 relative bg-gray-100 overflow-hidden">
          {loading && (
            <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center gap-3 z-10">
              <Loader2 size={32} className="animate-spin text-[#FF7A00]" />
              <p className="text-sm font-semibold text-gray-600">Loading statutory invoice...</p>
            </div>
          )}

          {error && (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-white">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-3">
                <AlertCircle size={28} />
              </div>
              <p className="text-sm font-bold text-gray-800 mb-1">Unable to load invoice</p>
              <p className="text-xs text-gray-500 max-w-md mb-4">{error}</p>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200 transition-colors"
              >
                Close Preview
              </button>
            </div>
          )}

          {htmlContent && !loading && (
            <iframe
              id="admin-invoice-print-frame"
              title="Tax Invoice"
              srcDoc={htmlContent}
              className="w-full h-full border-none bg-white"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default InvoiceViewModal;
