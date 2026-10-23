import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Loader2, Hash, CheckCircle2 } from 'lucide-react';
import { invoicesApi } from '../../../services/api';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialLastCount: number;
  financialYear: string;
  onSuccess: () => void;
}

export const InvoiceCounterDialog: React.FC<Props> = ({
  isOpen,
  onClose,
  initialLastCount,
  financialYear = '2026-27',
  onSuccess,
}) => {
  const [lastCount, setLastCount] = useState<number>(initialLastCount);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLastCount(initialLastCount);
  }, [initialLastCount, isOpen]);

  const nextSeq = lastCount + 1;
  const previewInvoiceNumber = `MHN/INV/${financialYear}/${String(nextSeq).padStart(5, '0')}`;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(lastCount) || lastCount < 0) {
      toast.error('Please enter a valid count number');
      return;
    }

    setIsSaving(true);
    try {
      await invoicesApi.updateCounter(lastCount, financialYear);
      toast.success(`Invoice counter updated! Next invoice will be: ${previewInvoiceNumber}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update invoice counter');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-[#E7DED6]">
        <DialogHeader className="mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 text-[#FF7A00] flex items-center justify-center">
              <Hash size={20} />
            </div>
            <div>
              <DialogTitle className="text-lg font-black text-gray-900 tracking-tight">
                Invoice Sequence Counter
              </DialogTitle>
              <p className="text-xs text-gray-500 font-medium">
                Set sequential numbering for Financial Year {financialYear}
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase text-gray-600 tracking-wider">
              Last Generated Sequence Number
            </Label>
            <Input
              type="number"
              min="0"
              value={lastCount}
              onChange={(e) => setLastCount(parseInt(e.target.value, 10) || 0)}
              className="rounded-xl border-gray-200 focus:border-[#FF7A00] font-bold text-base"
            />
            <p className="text-[11px] text-gray-400">
              Set this to <strong>9</strong> so the next automatically created invoice is <strong>10</strong>.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-orange-50/50 border border-orange-100 space-y-1">
            <div className="flex items-center gap-2 text-xs font-black text-gray-700">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>Next Automatic Invoice Number:</span>
            </div>
            <p className="text-sm font-black font-mono text-[#FF7A00] tracking-wide pl-5">
              {previewInvoiceNumber}
            </p>
          </div>

          <DialogFooter className="mt-6 flex flex-row items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-xl font-bold text-xs uppercase tracking-wider"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-[#FF7A00] hover:bg-[#e66e00] text-white rounded-xl font-black text-xs uppercase tracking-wider gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Updating...
                </>
              ) : (
                'Save Counter'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
