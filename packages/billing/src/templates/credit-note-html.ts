import { StatutoryCompanyDetails, InvoiceRecipientDetails } from '../types';
import { numberToWords } from './number-to-words';

export interface RenderCreditNoteOptions {
  creditNoteNumber: string;
  issuedAt?: Date | string;
  originalInvoiceNumber: string;
  originalInvoiceDate?: Date | string;
  reason?: string;
  company: StatutoryCompanyDetails;
  recipient: InvoiceRecipientDetails;
  breakdown: {
    baseAmount: number;
    taxAmount: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    totalAmount: number;
  };
  refundDetails?: {
    refundMode: string;
    gatewayRefundId?: string;
    manualReference?: string;
  };
}

function esc(str: any): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderCreditNoteHtml(opts: RenderCreditNoteOptions): string {
  const { creditNoteNumber, originalInvoiceNumber, company, recipient, breakdown, refundDetails } = opts;
  const issuedDate = opts.issuedAt ? new Date(opts.issuedAt) : new Date();
  const formattedDate = issuedDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const origInvoiceDateStr = opts.originalInvoiceDate
    ? new Date(opts.originalInvoiceDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : 'N/A';

  const isInterState = (breakdown.igstAmount || 0) > 0;
  const reasonText = opts.reason || 'Service Cancellation / Agreed Refund';
  const amountInWords = numberToWords(breakdown.totalAmount);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Credit Note - ${esc(creditNoteNumber)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 12px;
      color: #1f2937;
      background: #f9fafb;
      padding: 30px 20px;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      padding: 36px 40px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #dc2626;
      padding-bottom: 20px;
      margin-bottom: 20px;
    }
    .company-title {
      font-size: 22px;
      font-weight: 700;
      color: #111827;
      letter-spacing: -0.5px;
    }
    .company-sub {
      font-size: 11px;
      color: #6b7280;
      margin-top: 4px;
      line-height: 1.4;
    }
    .doc-type {
      text-align: right;
    }
    .doc-badge {
      display: inline-block;
      background: #fee2e2;
      color: #991b1b;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.5px;
      padding: 6px 14px;
      border-radius: 4px;
      text-transform: uppercase;
      margin-bottom: 6px;
      border: 1px solid #fecaca;
    }
    .doc-number {
      font-size: 15px;
      font-weight: 700;
      color: #1f2937;
      font-family: monospace;
    }
    .doc-date {
      font-size: 11px;
      color: #6b7280;
      margin-top: 2px;
    }
    .ref-banner {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-left: 4px solid #dc2626;
      padding: 10px 14px;
      border-radius: 4px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
    }
    .ref-title {
      font-weight: 600;
      color: #334155;
    }
    .ref-val {
      font-family: monospace;
      font-weight: 700;
      color: #0f172a;
    }
    .details-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 24px;
    }
    .card {
      background: #fafafa;
      border: 1px solid #f3f4f6;
      padding: 14px 16px;
      border-radius: 6px;
    }
    .card-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #6b7280;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 4px;
    }
    .card-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      margin-bottom: 4px;
      line-height: 1.4;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th, td {
      border: 1px solid #e5e7eb;
      padding: 9px 12px;
      font-size: 11.5px;
    }
    th {
      background: #f3f4f6;
      font-weight: 600;
      color: #374151;
      text-align: left;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-mono { font-family: monospace; }
    .totals-area {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 20px;
    }
    .totals-table {
      width: 320px;
    }
    .totals-table td {
      padding: 6px 12px;
      border: none;
    }
    .grand-total-row td {
      border-top: 2px solid #dc2626 !important;
      border-bottom: 2px solid #dc2626 !important;
      font-size: 14px;
      font-weight: 700;
      color: #991b1b;
      padding: 8px 12px;
    }
    .words-box {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      padding: 10px 14px;
      border-radius: 4px;
      font-size: 11.5px;
      margin-bottom: 20px;
    }
    .footer {
      border-top: 1px solid #e5e7eb;
      padding-top: 16px;
      font-size: 10.5px;
      color: #9ca3af;
      text-align: center;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div>
        <div class="company-title">${esc(company.name || '')}</div>
        <div class="company-sub">
          ${company.address ? `${esc(company.address)}<br>` : ''}
          ${company.gstin ? `GSTIN: <strong>${esc(company.gstin)}</strong>` : ''}${company.pan ? ` | PAN: <strong>${esc(company.pan)}</strong>` : ''}${company.cin ? ` | CIN: ${esc(company.cin)}` : ''}
          ${(company.email || company.phone) ? `<br>${company.email ? `Email: ${esc(company.email)}` : ''}${company.phone ? ` | Phone: ${esc(company.phone)}` : ''}` : ''}
        </div>
      </div>
      <div class="doc-type">
        <div class="doc-badge">Credit Note</div>
        <div class="doc-number">${esc(creditNoteNumber)}</div>
        <div class="doc-date">Date: <strong>${esc(formattedDate)}</strong></div>
      </div>
    </div>

    <!-- Original Invoice Reference -->
    <div class="ref-banner">
      <div>
        <span class="ref-title">Original Tax Invoice Ref: </span>
        <span class="ref-val">${esc(originalInvoiceNumber)}</span>
        <span style="color: #64748b; margin-left: 8px;">(Dated: ${esc(origInvoiceDateStr)})</span>
      </div>
      <div>
        <span style="font-size: 11px; color: #475569;">Issued under Section 34 of CGST Act, 2017</span>
      </div>
    </div>

    <!-- Details Grid -->
    <div class="details-grid">
      <div class="card">
        <div class="card-title">Credit Issued To (Customer)</div>
        <div class="card-row"><strong>Name:</strong> <span>${esc(recipient.name)}</span></div>
        ${recipient.phone ? `<div class="card-row"><strong>Phone:</strong> <span>${esc(recipient.phone)}</span></div>` : ''}
        ${recipient.email ? `<div class="card-row"><strong>Email:</strong> <span>${esc(recipient.email)}</span></div>` : ''}
        ${recipient.address ? `<div class="card-row"><strong>Address:</strong> <span>${esc(recipient.address)}</span></div>` : ''}
        ${recipient.state ? `<div class="card-row"><strong>Place of Supply:</strong> <span>${esc(recipient.state)}</span></div>` : ''}
      </div>

      <div class="card">
        <div class="card-title">Reason & Refund Settlement</div>
        <div class="card-row"><strong>Statutory Reason:</strong> <span>${esc(reasonText)}</span></div>
        <div class="card-row"><strong>Settlement Mode:</strong> <span>${esc(refundDetails?.refundMode === 'GATEWAY_ONLINE' ? 'Razorpay Gateway Refund' : 'Direct Bank / UTR Transfer')}</span></div>
        ${refundDetails?.gatewayRefundId ? `<div class="card-row"><strong>Gateway Refund ID:</strong> <span class="font-mono">${esc(refundDetails.gatewayRefundId)}</span></div>` : ''}
        ${refundDetails?.manualReference ? `<div class="card-row"><strong>Bank UTR / Ref:</strong> <span class="font-mono">${esc(refundDetails.manualReference)}</span></div>` : ''}
      </div>
    </div>

    <!-- Adjustment Table -->
    <table>
      <thead>
        <tr>
          <th style="width: 40px;" class="text-center">#</th>
          <th>Description & Statutory Particulars</th>
          <th style="width: 110px;" class="text-right">Taxable Value</th>
          ${isInterState ? `<th style="width: 90px;" class="text-right">IGST</th>` : `<th style="width: 80px;" class="text-right">CGST</th><th style="width: 80px;" class="text-right">SGST</th>`}
          <th style="width: 100px;" class="text-right">Total Credit</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="text-center">1</td>
          <td>
            <strong>Refund / Value Reversal against Invoice ${esc(originalInvoiceNumber)}</strong>
            <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">Reason: ${esc(reasonText)}</div>
            <div style="font-size: 10px; color: #9ca3af; margin-top: 2px;">SAC Code: 998399 / Healthcare & Eldercare Support Services</div>
          </td>
          <td class="text-right font-mono">₹${breakdown.baseAmount.toFixed(2)}</td>
          ${
            isInterState
              ? `<td class="text-right font-mono">₹${breakdown.igstAmount.toFixed(2)}</td>`
              : `<td class="text-right font-mono">₹${breakdown.cgstAmount.toFixed(2)}</td><td class="text-right font-mono">₹${breakdown.sgstAmount.toFixed(2)}</td>`
          }
          <td class="text-right font-mono font-semibold" style="color: #991b1b;">₹${breakdown.totalAmount.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>

    <!-- Totals Table -->
    <div class="totals-area">
      <table class="totals-table">
        <tr>
          <td>Taxable Value:</td>
          <td class="text-right font-mono">₹${breakdown.baseAmount.toFixed(2)}</td>
        </tr>
        ${
          isInterState
            ? `<tr><td>Integrated GST (IGST):</td><td class="text-right font-mono">₹${breakdown.igstAmount.toFixed(2)}</td></tr>`
            : `<tr><td>Central GST (CGST):</td><td class="text-right font-mono">₹${breakdown.cgstAmount.toFixed(2)}</td></tr>
               <tr><td>State GST (SGST):</td><td class="text-right font-mono">₹${breakdown.sgstAmount.toFixed(2)}</td></tr>`
        }
        <tr>
          <td>Total GST Reversed:</td>
          <td class="text-right font-mono font-semibold">₹${breakdown.taxAmount.toFixed(2)}</td>
        </tr>
        <tr class="grand-total-row">
          <td>Total Refund Amount:</td>
          <td class="text-right font-mono">₹${breakdown.totalAmount.toFixed(2)}</td>
        </tr>
      </table>
    </div>

    <!-- Amount in Words -->
    <div class="words-box">
      <span style="font-weight: 600; color: #1e40af;">Total Refund in Words:</span>
      <span style="color: #1e3a8a;">${esc(amountInWords)}</span>
    </div>

    <!-- Footer -->
    <div class="footer">
      This is a computer-generated Credit Note issued under Section 34 of the CGST Act, 2017.<br>
      ${company.name ? esc(company.name) : ''}${company.cin ? ` | CIN: ${esc(company.cin)}` : ''}
    </div>
  </div>
</body>
</html>`;
}
