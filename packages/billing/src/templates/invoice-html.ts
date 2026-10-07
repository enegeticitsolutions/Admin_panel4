import { InvoiceSnapshot, StatutoryCompanyDetails, InvoiceRecipientDetails } from '../types';
import { numberToWords } from './number-to-words';

export interface RenderInvoiceOptions {
  invoiceNumber: string;
  issuedAt?: Date | string;
  status?: string;
  company: StatutoryCompanyDetails;
  recipient: InvoiceRecipientDetails;
  snapshot: InvoiceSnapshot;
  paymentDetails?: {
    paymentMethod?: string;
    transactionId?: string;
    paidAt?: Date | string;
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

export function renderInvoiceHtml(opts: RenderInvoiceOptions): string {
  const { invoiceNumber, company, recipient, snapshot, paymentDetails } = opts;
  const issuedDate = opts.issuedAt ? new Date(opts.issuedAt) : new Date();
  const formattedDate = issuedDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const status = (opts.status || 'PAID').toUpperCase();

  const isInterState = snapshot.isInterState;
  const items = snapshot.items || [];
  const taxSummary = snapshot.taxSummary || [];

  const itemsRows = items
    .map((item, idx) => {
      const taxRateLabel = item.isGstExempt ? '0% (Exempt)' : `${item.taxRate}%`;
      return `
      <tr>
        <td class="text-center">${idx + 1}</td>
        <td>
          <div class="font-semibold text-gray-900">${esc(item.name)}</div>
          ${item.description && item.description !== item.name ? `<div class="text-xs text-gray-500">${esc(item.description)}</div>` : ''}
        </td>
        <td class="text-center font-mono">${esc(item.hsnSacCode)}</td>
        <td class="text-center">${item.quantity}</td>
        <td class="text-right font-mono">₹${item.unitPrice.toFixed(2)}</td>
        <td class="text-right font-mono">₹${item.taxableAmount.toFixed(2)}</td>
        <td class="text-center">${taxRateLabel}</td>
        <td class="text-right font-mono">₹${item.taxAmount.toFixed(2)}</td>
        <td class="text-right font-mono font-semibold">₹${item.totalAmount.toFixed(2)}</td>
      </tr>
    `;
    })
    .join('');

  const taxSummaryRows = taxSummary
    .map(
      (ts) => `
      <tr>
        <td class="text-center">${ts.taxRate}%</td>
        <td class="text-right font-mono">₹${ts.taxableAmount.toFixed(2)}</td>
        ${
          !isInterState
            ? `
          <td class="text-right font-mono">₹${ts.cgstAmount.toFixed(2)}</td>
          <td class="text-right font-mono">₹${ts.sgstAmount.toFixed(2)}</td>
        `
            : `
          <td class="text-right font-mono" colspan="2">₹${ts.igstAmount.toFixed(2)}</td>
        `
        }
        <td class="text-right font-mono font-semibold">₹${ts.totalTax.toFixed(2)}</td>
      </tr>
    `
    )
    .join('');

  const amountInWords = numberToWords(snapshot.totalAmount);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tax Invoice - ${esc(invoiceNumber)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #1f2937;
      background: #f9fafb;
      padding: 24px;
    }
    .invoice-container {
      max-width: 860px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 32px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .header {
      display: flex;
      justify-content: space-between;
      border-bottom: 2px solid #ea580c;
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
    .brand-title {
      font-size: 24px;
      font-weight: 800;
      color: #ea580c;
      letter-spacing: -0.5px;
    }
    .invoice-title {
      font-size: 20px;
      font-weight: 700;
      text-transform: uppercase;
      color: #111827;
      text-align: right;
    }
    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      background: #dcfce7;
      color: #15803d;
      margin-top: 4px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 24px;
    }
    .card {
      background: #f9fafb;
      border: 1px solid #f3f4f6;
      border-radius: 6px;
      padding: 12px 16px;
    }
    .card-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #6b7280;
      margin-bottom: 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th {
      background: #f3f4f6;
      color: #374151;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      padding: 8px 10px;
      border: 1px solid #e5e7eb;
    }
    td {
      padding: 8px 10px;
      border: 1px solid #e5e7eb;
      vertical-align: top;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-semibold { font-weight: 600; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .totals-area {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 24px;
      margin-bottom: 24px;
    }
    .totals-table td {
      border: none;
      padding: 4px 8px;
    }
    .grand-total-row {
      border-top: 2px solid #111827 !important;
      font-size: 14px;
      font-weight: 700;
      color: #ea580c;
    }
    .words-box {
      background: #eff6ff;
      border-left: 4px solid #3b82f6;
      padding: 10px 14px;
      border-radius: 4px;
      margin-bottom: 24px;
    }
    .footer {
      border-top: 1px solid #e5e7eb;
      padding-top: 16px;
      text-align: center;
      font-size: 11px;
      color: #9ca3af;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .invoice-container { border: none; box-shadow: none; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <!-- Header -->
    <div class="header">
      <div>
        <div class="brand-title">${esc(company.name || 'Mai-Hoonaa')}</div>
        <div style="color: #4b5563; margin-top: 4px;">
          ${esc(company.address)}<br>
          GSTIN: <span class="font-mono font-semibold">${esc(company.gstin)}</span> | PAN: <span class="font-mono">${esc(company.pan)}</span><br>
          Email: ${esc(company.email)} | Phone: ${esc(company.phone)}
        </div>
      </div>
      <div style="text-align: right;">
        <div class="invoice-title">Tax Invoice</div>
        <div class="font-mono" style="font-size: 14px; font-weight: 600; margin-top: 4px;">${esc(invoiceNumber)}</div>
        <div style="color: #6b7280; font-size: 11px;">Date: ${formattedDate}</div>
        <div class="status-badge">${status}</div>
      </div>
    </div>

    <!-- Bill To / Place of Supply -->
    <div class="meta-grid">
      <div class="card">
        <div class="card-title">Bill To (Subscriber)</div>
        <div class="font-semibold" style="font-size: 13px;">${esc(recipient.name)}</div>
        <div style="color: #4b5563; margin-top: 2px;">
          ${recipient.address ? `${esc(recipient.address)}<br>` : ''}
          ${recipient.phone ? `Phone: ${esc(recipient.phone)} | ` : ''}${recipient.email ? `Email: ${esc(recipient.email)}` : ''}
        </div>
      </div>
      <div class="card">
        <div class="card-title">Place of Supply & Tax Mode</div>
        <div><strong>Place of Supply:</strong> ${esc(snapshot.placeOfSupply || 'Same as Company State')}</div>
        <div><strong>Tax Category:</strong> ${isInterState ? 'Inter-State Supply (IGST)' : 'Intra-State Supply (CGST + SGST)'}</div>
        <div><strong>Company Registered State:</strong> ${esc(snapshot.companyState)}</div>
      </div>
    </div>

    <!-- Line Items Table -->
    <table>
      <thead>
        <tr>
          <th style="width: 30px;">#</th>
          <th>Item / Benefit Description</th>
          <th style="width: 70px;">HSN/SAC</th>
          <th style="width: 45px;">Qty</th>
          <th style="width: 80px;" class="text-right">Unit Price</th>
          <th style="width: 90px;" class="text-right">Taxable Amt</th>
          <th style="width: 65px;" class="text-center">GST Rate</th>
          <th style="width: 80px;" class="text-right">Tax Amt</th>
          <th style="width: 90px;" class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <!-- Totals and Words Area -->
    <div class="totals-area">
      <div>
        <!-- Tax Schedule Table -->
        <div style="font-weight: 600; margin-bottom: 6px; font-size: 11px; text-transform: uppercase; color: #4b5563;">Statutory GST Summary</div>
        <table>
          <thead>
            <tr>
              <th class="text-center">Rate</th>
              <th class="text-right">Taxable</th>
              ${!isInterState ? '<th class="text-right">CGST</th><th class="text-right">SGST</th>' : '<th class="text-right" colspan="2">IGST</th>'}
              <th class="text-right">Tax</th>
            </tr>
          </thead>
          <tbody>
            ${taxSummaryRows}
          </tbody>
        </table>
      </div>

      <div>
        <table class="totals-table">
          <tr>
            <td>Gross Base Amount:</td>
            <td class="text-right font-mono">₹${snapshot.baseAmount.toFixed(2)}</td>
          </tr>
          ${
            snapshot.discountAmount > 0
              ? `
          <tr>
            <td style="color: #dc2626;">Total Discount (Pre-tax):</td>
            <td class="text-right font-mono" style="color: #dc2626;">-₹${snapshot.discountAmount.toFixed(2)}</td>
          </tr>
          `
              : ''
          }
          <tr>
            <td><strong>Net Taxable Value:</strong></td>
            <td class="text-right font-mono font-semibold">₹${snapshot.taxableAmount.toFixed(2)}</td>
          </tr>
          ${
            !isInterState
              ? `
          <tr>
            <td>CGST:</td>
            <td class="text-right font-mono">₹${snapshot.cgstAmount.toFixed(2)}</td>
          </tr>
          <tr>
            <td>SGST:</td>
            <td class="text-right font-mono">₹${snapshot.sgstAmount.toFixed(2)}</td>
          </tr>
          `
              : `
          <tr>
            <td>IGST:</td>
            <td class="text-right font-mono">₹${snapshot.igstAmount.toFixed(2)}</td>
          </tr>
          `
          }
          ${
            snapshot.miscellaneousCost > 0
              ? `
          <tr>
            <td>Miscellaneous Charges:</td>
            <td class="text-right font-mono">₹${snapshot.miscellaneousCost.toFixed(2)}</td>
          </tr>
          `
              : ''
          }
          <tr class="grand-total-row">
            <td>Grand Total:</td>
            <td class="text-right font-mono">₹${snapshot.totalAmount.toFixed(2)}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Amount in Words -->
    <div class="words-box">
      <span style="font-weight: 600; color: #1e40af;">Amount in Words:</span>
      <span style="color: #1e3a8a;">${esc(amountInWords)}</span>
    </div>

    <!-- Payment & Statutory Info -->
    ${
      paymentDetails
        ? `
    <div style="font-size: 11px; color: #6b7280; margin-bottom: 20px;">
      Payment Mode: <strong>${esc(paymentDetails.paymentMethod || 'Online / Gateway')}</strong>
      ${paymentDetails.transactionId ? ` | Transaction Ref: <strong class="font-mono">${esc(paymentDetails.transactionId)}</strong>` : ''}
    </div>
    `
        : ''
    }

    <!-- Footer -->
    <div class="footer">
      This is a computer-generated statutory Tax Invoice. No signature is required.<br>
      Thank you for choosing ${esc(company.name || 'Mai-Hoonaa')}!
    </div>
  </div>
</body>
</html>`;
}
