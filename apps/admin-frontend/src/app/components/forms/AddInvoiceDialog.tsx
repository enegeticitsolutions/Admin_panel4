import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Loader2, Upload, FileText, X, Receipt } from 'lucide-react';
import { invoicesApi } from '../../../services/api';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  subscriber: any;
  nextInvoiceNumber?: string;
  onSuccess: () => void;
}

export const AddInvoiceDialog: React.FC<Props> = ({
  isOpen,
  onClose,
  subscriber,
  nextInvoiceNumber = '',
  onSuccess,
}) => {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [beneficiaryId, setBeneficiaryId] = useState('none');
  const [invoiceType, setInvoiceType] = useState('SUBSCRIPTION');
  const [status, setStatus] = useState('PAID');
  const [totalAmount, setTotalAmount] = useState('');
  const [issuedAt, setIssuedAt] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('MaiHoonNa Eldercare Subscription Plan');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const beneficiaries = subscriber?.beneficiaries || [];

  const handleReset = () => {
    setInvoiceNumber('');
    setBeneficiaryId('none');
    setInvoiceType('SUBSCRIPTION');
    setStatus('PAID');
    setTotalAmount('');
    setIssuedAt(new Date().toISOString().split('T')[0]);
    setDescription('MaiHoonNa Eldercare Subscription Plan');
    setPdfFile(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf') {
        toast.error('Only PDF files are supported for invoices');
        return;
      }
      setPdfFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(totalAmount);
    if (isNaN(amountVal) || amountVal < 0) {
      toast.error('Please enter a valid total amount');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('subscriberId', subscriber.id);
      if (beneficiaryId && beneficiaryId !== 'none') {
        formData.append('beneficiaryId', beneficiaryId);
      }
      if (invoiceNumber.trim()) {
        formData.append('invoiceNumber', invoiceNumber.trim());
      }
      formData.append('invoiceType', invoiceType);
      formData.append('status', status);
      formData.append('totalAmount', String(amountVal));
      formData.append('issuedAt', issuedAt);
      if (status === 'PAID') {
        formData.append('paidAt', issuedAt);
      }
      formData.append('description', description);

      if (pdfFile) {
        formData.append('pdf', pdfFile);
      }

      await invoicesApi.createInvoice(formData);
      toast.success('Invoice created and attached successfully!');
      handleReset();
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-[#E7DED6]">
        <DialogHeader className="mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Receipt size={20} />
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-gray-900 tracking-tight">
                Add / Attach Invoice
              </DialogTitle>
              <p className="text-xs text-gray-500 font-medium">
                Create an invoice record for {subscriber?.name || 'Subscriber'}
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Invoice Number */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-black uppercase text-gray-600 tracking-wider">
                Invoice Number (Optional)
              </Label>
              <Input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder={nextInvoiceNumber || 'Auto-generate from sequence'}
                className="rounded-xl border-gray-200 focus:border-emerald-500 font-mono text-sm"
              />
              <p className="text-[10px] text-gray-400 font-medium">
                Leave empty to automatically assign: <span className="font-bold text-emerald-700">{nextInvoiceNumber || 'next sequence'}</span>
              </p>
            </div>

            {/* Recipient / Beneficiary */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-black uppercase text-gray-600 tracking-wider">
                Recipient / Beneficiary
              </Label>
              <Select value={beneficiaryId} onValueChange={setBeneficiaryId}>
                <SelectTrigger className="rounded-xl border-gray-200 focus:border-emerald-500">
                  <SelectValue placeholder="Select Recipient" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="none">Subscriber Primary ({subscriber?.name})</SelectItem>
                  {beneficiaries.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} ({b.relationship || 'Beneficiary'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Total Amount */}
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase text-gray-600 tracking-wider">
                Total Amount (₹) <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                required
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="2360.00"
                className="rounded-xl border-gray-200 focus:border-emerald-500 font-bold text-sm"
              />
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase text-gray-600 tracking-wider">
                Invoice Date
              </Label>
              <Input
                type="date"
                value={issuedAt}
                onChange={(e) => setIssuedAt(e.target.value)}
                className="rounded-xl border-gray-200 focus:border-emerald-500 text-sm"
              />
            </div>

            {/* Invoice Type */}
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase text-gray-600 tracking-wider">
                Type
              </Label>
              <Select value={invoiceType} onValueChange={setInvoiceType}>
                <SelectTrigger className="rounded-xl border-gray-200 focus:border-emerald-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="SUBSCRIPTION">Subscription</SelectItem>
                  <SelectItem value="ADDON">Add-on</SelectItem>
                  <SelectItem value="SERVICE">Service</SelectItem>
                  <SelectItem value="RENEWAL">Renewal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase text-gray-600 tracking-wider">
                Status
              </Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="rounded-xl border-gray-200 focus:border-emerald-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="PAID">PAID</SelectItem>
                  <SelectItem value="PENDING">PENDING</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-black uppercase text-gray-600 tracking-wider">
                Item / Plan Description
              </Label>
              <Input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="MaiHoonNa Eldercare Subscription Plan"
                className="rounded-xl border-gray-200 focus:border-emerald-500 text-sm"
              />
            </div>

            {/* Attach PDF File */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-black uppercase text-gray-600 tracking-wider">
                Attach Invoice PDF
              </Label>
              {pdfFile ? (
                <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-800 truncate">{pdfFile.name}</p>
                      <p className="text-[10px] text-gray-500">{(pdfFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPdfFile(null)}
                    className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-white transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <label className="border-2 border-dashed border-gray-200 hover:border-emerald-400 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer bg-gray-50/50 hover:bg-emerald-50/20 transition-all group">
                  <Upload className="w-6 h-6 text-gray-400 group-hover:text-emerald-600 transition-colors mb-1" />
                  <span className="text-xs font-bold text-gray-600 group-hover:text-emerald-700">
                    Choose PDF file to upload
                  </span>
                  <span className="text-[10px] text-gray-400 mt-0.5">Maximum file size 25MB</span>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          <DialogFooter className="mt-6 flex flex-row items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl font-bold text-xs uppercase tracking-wider"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-wider gap-2 shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Creating Invoice...
                </>
              ) : (
                <>
                  <Receipt size={14} />
                  Save &amp; Attach
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
