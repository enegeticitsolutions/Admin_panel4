import escapeHtml from 'escape-html';
import { numberToWords } from '@maihoonna/billing';

export { numberToWords };

export interface CompanyDetails {
  name: string;
  address: string;
  gstin: string;
  pan: string;
  cin: string;
  email: string;
  phone: string;
  bankName?: string;
  bankAccount?: string;
  bankIfsc?: string;
  upiId?: string;
}

// ── Indian State / UT code lookup ────────────────────────────────────────────
const INDIAN_STATE_CODES: Record<string, string> = {
  'jammu & kashmir': '01', 'jammu and kashmir': '01',
  'himachal pradesh': '02',
  'punjab': '03',
  'chandigarh': '04',
  'uttarakhand': '05', 'uttaranchal': '05',
  'haryana': '06',
  'delhi': '07',
  'rajasthan': '08',
  'uttar pradesh': '09',
  'bihar': '10',
  'sikkim': '11',
  'arunachal pradesh': '12',
  'nagaland': '13',
  'manipur': '14',
  'mizoram': '15',
  'tripura': '16',
  'meghalaya': '17',
  'assam': '18',
  'west bengal': '19',
  'jharkhand': '20',
  'odisha': '21', 'orissa': '21',
  'chhattisgarh': '22',
  'madhya pradesh': '23',
  'gujarat': '24',
  'dadra and nagar haveli and daman and diu': '26',
  'maharashtra': '27',
  'andhra pradesh': '28',
  'karnataka': '29',
  'goa': '30',
  'lakshadweep': '31',
  'kerala': '32',
  'tamil nadu': '33',
  'puducherry': '34', 'pondicherry': '34',
  'andaman and nicobar islands': '35',
  'telangana': '36',
  'ladakh': '38',
};

function getStateCode(state: string): string {
  if (!state) return '';
  return INDIAN_STATE_CODES[state.trim().toLowerCase()] || '';
}

function formatInDate(d: Date | string | undefined | null): string {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d as string);
  if (isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatInDateShort(d: Date | string | undefined | null): string {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d as string);
  if (isNaN(dt.getTime())) return '';
  // DD.MM.YYYY format as used in reference invoice
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function formatPaymentDateTime(d: Date | string | undefined | null): string {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d as string);
  if (isNaN(dt.getTime())) return '';
  return dt.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export class InvoiceHtmlRenderer {

  // ── Company statutory defaults ───────────────────────────────────────────────
  static defaultCompany(): CompanyDetails {
    return {
      name: process.env.COMPANY_NAME || 'MaiHoonNa Eldercare Private Limited',
      address: process.env.COMPANY_ADDRESS || 'DLF Phase V, Gurugram, Haryana',
      gstin: process.env.COMPANY_GSTIN || '06AAUCM9447N1ZE',
      pan: process.env.COMPANY_PAN || 'AAUCM9447N',
      cin: process.env.COMPANY_CIN || 'U86900HR2026PTC145612',
      email: process.env.COMPANY_EMAIL || 'info@maihoonna.com',
      phone: process.env.COMPANY_PHONE || '8507070049',
    };
  }

  /**
   * Renders the statutory GST Tax Invoice HTML in Amazon-style A4 layout.
   * Mirrors the structure of the reference invoice PDF.
   */
  static render(invoice: any, companyOverride?: Partial<CompanyDetails>): string {
    const co = { ...InvoiceHtmlRenderer.defaultCompany(), ...companyOverride };

    // ── Subscriber / Billing info ─────────────────────────────────────────────
    const subscriberName    = escapeHtml(invoice.subscriber?.name || 'Valued Customer');
    const subscriberPhone   = escapeHtml(invoice.subscriber?.phone || '');
    const subscriberEmail   = escapeHtml(invoice.subscriber?.email || '');
    const subscriberState   = escapeHtml(invoice.subscriber?.state || invoice.placeOfSupply || '');
    const subscriberAddress = escapeHtml(
      invoice.subscriber?.address || invoice.placeOfSupply || ''
    );
    const subscriberStateCode = getStateCode(subscriberState);

    // ── Beneficiary / Service delivery info ───────────────────────────────────
    const beneficiaryName    = escapeHtml(invoice.beneficiary?.name || subscriberName);
    const beneficiaryState   = escapeHtml(invoice.beneficiary?.state || subscriberState);
    const beneficiaryAddress = escapeHtml(
      invoice.beneficiary?.address || subscriberAddress || ''
    );
    const beneficiaryStateCode = getStateCode(beneficiaryState) || subscriberStateCode;

    // ── Place of supply ───────────────────────────────────────────────────────
    const placeOfSupply = escapeHtml(
      invoice.placeOfSupply || invoice.beneficiary?.state || subscriberState || ''
    );
    const placeOfSupplyCode = getStateCode(placeOfSupply) || beneficiaryStateCode;
    const placeOfSupplyDisplay = placeOfSupply
      ? `${placeOfSupply}${placeOfSupplyCode ? ` (${placeOfSupplyCode})` : ''}`
      : '—';

    // ── Dates ─────────────────────────────────────────────────────────────────
    const issuedAt = invoice.issuedAt ? new Date(invoice.issuedAt) : new Date();
    const issuedDateDisplay   = formatInDateShort(issuedAt);
    const issuedDateLong      = formatInDate(issuedAt);
    const status              = escapeHtml((invoice.status || 'PAID').toUpperCase());

    // ── Order / subscription reference ────────────────────────────────────────
    const orderRef = escapeHtml(
      invoice.subscriptionId || invoice.appointmentId || invoice.subscription?.id || '—'
    );
    const orderDate = invoice.subscription?.startDate
      ? formatInDateShort(invoice.subscription.startDate)
      : issuedDateDisplay;

    // ── Tax amounts ───────────────────────────────────────────────────────────
    const baseAmount    = Number(invoice.baseAmount    || 0);
    const discountAmt   = Number(invoice.discountAmount || 0);
    const saathiDisc    = Number(invoice.saathiDiscountAmount || 0);
    const totalDiscount = Math.round((discountAmt + saathiDisc) * 100) / 100;
    const taxableAmount = Math.round((baseAmount - totalDiscount) * 100) / 100;
    const cgstAmount    = Number(invoice.cgstAmount || 0);
    const sgstAmount    = Number(invoice.sgstAmount || 0);
    const igstAmount    = Number(invoice.igstAmount || 0);
    const payableAmount = Number(invoice.totalAmount || 0);
    const isInterState  = igstAmount > 0;

    // ── Line items ────────────────────────────────────────────────────────────
    const items: any[] = invoice.items || [];

    // Running totals for table footer row
    let totalNetAmount  = 0;
    let totalTaxAmount  = 0;
    let totalLineAmount = 0;

    const itemsHtml = items.map((item: any, index: number) => {
      const qty         = Number(item.quantity || 1);
      const unitPrice   = Number(item.unitPrice || 0);
      const grossAmount = unitPrice * qty;

      // Net amount (taxable) — use stored amount if available
      const netAmount = item.taxableAmount !== undefined
        ? Number(item.taxableAmount)
        : (item.amount !== undefined
            ? Number(item.amount)
            : Math.max(0, grossAmount - (item.discountAmount || 0)));

      const itemDiscount = Math.max(0, grossAmount - netAmount);
      const taxRate      = Number(item.taxRate || 0);
      const isExempt     = Boolean(item.isGstExempt);

      const taxAmount = item.taxAmount !== undefined
        ? Number(item.taxAmount)
        : (item.tax !== undefined
            ? Number(item.tax)
            : (isExempt ? 0 : Math.round(netAmount * taxRate) / 100));

      const lineTotal = item.totalAmount !== undefined
        ? Number(item.totalAmount)
        : Math.round((netAmount + taxAmount) * 100) / 100;

      totalNetAmount  += netAmount;
      totalTaxAmount  += taxAmount;
      totalLineAmount += lineTotal;

      // Tax type label
      let taxTypeHtml: string;
      if (isExempt || taxRate === 0) {
        taxTypeHtml = 'Exempt';
      } else if (isInterState) {
        taxTypeHtml = `IGST (${taxRate}%)`;
      } else {
        const half = taxRate / 2;
        taxTypeHtml = `CGST (${half}%)<br/>+ SGST (${half}%)`;
      }

      const taxRateDisplay = isExempt ? '0% (Exempt)' : `${taxRate}%`;
      const hsnSac = escapeHtml(item.hsnSacCode || (isExempt ? '999312' : '998399'));

      return `
      <tr>
        <td class="text-center">${index + 1}</td>
        <td>
          <div class="desc-title">${escapeHtml(item.description || item.name || 'Service')}</div>
          <div class="desc-sub">SAC / HSN: ${hsnSac}</div>
        </td>
        <td class="text-right">₹${unitPrice.toFixed(2)}</td>
        <td class="text-right">₹${itemDiscount.toFixed(2)}</td>
        <td class="text-center">${qty}</td>
        <td class="text-right">₹${netAmount.toFixed(2)}</td>
        <td class="text-center">${escapeHtml(taxRateDisplay)}</td>
        <td class="text-center">${taxTypeHtml}</td>
        <td class="text-right">₹${taxAmount.toFixed(2)}</td>
        <td class="text-right bold">₹${lineTotal.toFixed(2)}</td>
      </tr>`;
    }).join('');

    // Table footer totals row
    const itemsTotalsRow = items.length > 0 ? `
      <tr class="items-total-row">
        <td colspan="5" class="text-right bold">TOTALS:</td>
        <td class="text-right bold">₹${totalNetAmount.toFixed(2)}</td>
        <td class="text-center">—</td>
        <td class="text-center">—</td>
        <td class="text-right bold">₹${totalTaxAmount.toFixed(2)}</td>
        <td class="text-right bold">₹${totalLineAmount.toFixed(2)}</td>
      </tr>` : '';

    // ── Amount in words ───────────────────────────────────────────────────────
    let amountInWordsDisplay = numberToWords(payableAmount);
    if (!amountInWordsDisplay.endsWith('Only')) {
      amountInWordsDisplay = `${amountInWordsDisplay} Rupees Only`;
    }

    // ── GST totals section (right side) ──────────────────────────────────────
    const gstRows = isInterState
      ? `<tr><td>Total IGST:</td><td class="text-right">₹${igstAmount.toFixed(2)}</td></tr>`
      : `<tr><td>Total CGST:</td><td class="text-right">₹${cgstAmount.toFixed(2)}</td></tr>
         <tr><td>Total SGST:</td><td class="text-right">₹${sgstAmount.toFixed(2)}</td></tr>`;

    const discountRows = totalDiscount > 0 ? `
      ${discountAmt > 0 ? `<tr><td>Discount:</td><td class="text-right">-₹${discountAmt.toFixed(2)}</td></tr>` : ''}
      ${saathiDisc > 0 ? `<tr><td>Saathi Discount:</td><td class="text-right">-₹${saathiDisc.toFixed(2)}</td></tr>` : ''}
    ` : '';

    // ── Payment details ───────────────────────────────────────────────────────
    const payments: any[] = invoice.payments || [];
    let paymentsHtml = '';
    if (payments.length > 0 && status === 'PAID') {
      const payRows = payments.map((p: any) => {
        const txId     = escapeHtml(p.gatewayPaymentId || p.transactionId || p.gatewayOrderId || '—');
        const paidAt   = formatPaymentDateTime(p.paidAt);
        const method   = escapeHtml(p.paymentMethod || 'Online / Gateway');
        const pAmount  = payableAmount;
        return `
        <tr>
          <td style="width:32%"><strong>Payment Transaction ID:</strong><br/><span class="font-mono">${txId}</span></td>
          <td style="width:28%"><strong>Payment Date &amp; Time:</strong><br/>${escapeHtml(paidAt)}</td>
          <td style="width:20%"><strong>Mode of Payment:</strong><br/>${method}</td>
          <td style="width:20%" class="text-right"><strong>Invoice Value:</strong><br/><span class="bold">₹${pAmount.toFixed(2)}</span></td>
        </tr>`;
      }).join('');

      paymentsHtml = `
  <table class="payment-table">
    <thead>
      <tr><th colspan="4">Payment Information</th></tr>
    </thead>
    <tbody>
      ${payRows}
    </tbody>
  </table>`;
    } else if (status !== 'PAID') {
      paymentsHtml = `
  <table class="payment-table">
    <thead>
      <tr><th colspan="4">Payment Information</th></tr>
    </thead>
    <tbody>
      <tr><td colspan="4" class="text-center" style="color:#555; padding: 8px;">
        Payment Status: <strong>${status}</strong>
      </td></tr>
    </tbody>
  </table>`;
    }


    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tax Invoice - ${escapeHtml(invoice.invoiceNumber)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, Helvetica, sans-serif;
      font-size: 11px;
      line-height: 1.35;
      color: #111;
      background: #fff;
      padding: 15px;
    }

    /* ── Print button ── */
    .no-print { text-align: right; margin-bottom: 12px; }
    .print-btn {
      background-color: #232f3e;
      color: #fff;
      border: 1px solid #131a22;
      padding: 7px 16px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
    }
    .print-btn:hover { background-color: #37475a; }

    /* ── Layout helpers ── */
    table.full-width { width: 100%; border-collapse: collapse; margin-bottom: 0; }

    /* ── Header ── */
    .header-table td { vertical-align: top; padding-bottom: 8px; }
    .company-brand h1 {
      font-size: 20px;
      font-weight: 800;
      color: #111;
      letter-spacing: -0.3px;
      margin-bottom: 2px;
    }
    .company-brand .tagline {
      font-size: 10px;
      color: #555;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .invoice-title { text-align: right; }
    .invoice-title h2 {
      font-size: 15px;
      font-weight: 700;
      color: #111;
      margin-bottom: 2px;
    }
    .invoice-title .subtitle { font-size: 11px; font-weight: 600; color: #444; }

    /* ── Address block ── */
    .address-table {
      border: 1px solid #333;
      margin-top: 8px;
      margin-bottom: 0;
      width: 100%;
      border-collapse: collapse;
    }
    .address-table td {
      width: 50%;
      vertical-align: top;
      padding: 8px 10px;
      font-size: 10.5px;
      border-right: 1px solid #333;
    }
    .address-table td:last-child { border-right: none; }
    .section-heading {
      font-size: 11px;
      font-weight: 700;
      color: #000;
      border-bottom: 1px solid #ddd;
      padding-bottom: 3px;
      margin-bottom: 5px;
      text-transform: uppercase;
    }
    .address-block p { margin: 1px 0; color: #222; }
    .address-sep {
      border-top: 1px solid #ccc;
      margin: 6px 0;
    }

    /* ── Order / Invoice details bar ── */
    .details-bar {
      border: 1px solid #333;
      border-top: none;
      margin-bottom: 10px;
      background-color: #fafafa;
      width: 100%;
      border-collapse: collapse;
    }
    .details-bar td {
      width: 50%;
      padding: 6px 10px;
      vertical-align: top;
      font-size: 10.5px;
      border-right: 1px solid #333;
    }
    .details-bar td:last-child { border-right: none; }
    .details-bar p { margin: 2px 0; }

    /* ── 10-column items table ── */
    table.items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
      border: 1px solid #333;
    }
    table.items-table th {
      background-color: #f2f2f2;
      border: 1px solid #333;
      padding: 6px 4px;
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      color: #111;
    }
    table.items-table td {
      border: 1px solid #ccc;
      padding: 6px 4px;
      font-size: 10px;
      vertical-align: top;
    }
    .items-total-row td {
      border-top: 2px solid #333;
      background-color: #fafafa;
      font-weight: 700;
      font-size: 10.5px;
    }
    .desc-title { font-weight: 600; color: #111; }
    .desc-sub   { font-size: 9px; color: #555; margin-top: 1px; }

    /* ── Summary / totals section ── */
    .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    .summary-table td { vertical-align: top; }
    .words-box { width: 55%; padding-right: 15px; font-size: 10.5px; }
    .amount-words { font-weight: 700; font-size: 11px; margin: 4px 0 10px; color: #000; line-height: 1.4; }
    .reverse-charge { font-size: 10px; margin-top: 6px; color: #222; }
    .totals-box { width: 45%; }
    .totals-subtable { width: 100%; border-collapse: collapse; border: 1px solid #333; }
    .totals-subtable td { padding: 4px 8px; font-size: 10.5px; border-bottom: 1px solid #eee; }
    .totals-subtable tr:last-child td { border-bottom: none; }
    .totals-subtable tr.grand-total td {
      font-weight: 800;
      font-size: 12px;
      border-top: 2px solid #333;
      border-bottom: 2px solid #333;
      background-color: #f7f7f7;
    }

    /* ── Signatory ── */
    .signatory-container { margin-top: 10px; text-align: right; padding-right: 10px; }
    .signatory-box { margin-top: 35px; font-weight: 700; font-size: 10.5px; color: #111; }

    /* ── Payment information ── */
    .payment-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #333;
      margin-top: 12px;
      margin-bottom: 12px;
      background-color: #fafafa;
    }
    .payment-table th {
      background-color: #f2f2f2;
      border-bottom: 1px solid #333;
      padding: 5px 8px;
      font-size: 10px;
      font-weight: 700;
      text-align: left;
      text-transform: uppercase;
    }
    .payment-table td {
      padding: 6px 8px;
      font-size: 10px;
      border-right: 1px solid #ddd;
    }
    .payment-table td:last-child { border-right: none; }

    /* ── Footer ── */
    .footer-section {
      border-top: 1px solid #333;
      padding-top: 8px;
      margin-top: 10px;
      text-align: center;
      font-size: 9.5px;
      color: #444;
      line-height: 1.5;
    }
    .footer-demand { font-size: 10.5px; font-weight: 700; color: #111; margin-bottom: 3px; }

    /* ── Utilities ── */
    .text-center  { text-align: center; }
    .text-left    { text-align: left; }
    .text-right   { text-align: right; }
    .bold         { font-weight: 700; }
    .font-mono    { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }

    @media print {
      .no-print { display: none !important; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()" class="print-btn">🖨️ Print / Save as PDF</button>
  </div>

  <!-- ── Page Header ── -->
  <table class="full-width header-table">
    <tr>
      <td class="company-brand">
        <h1>${escapeHtml(co.name)}</h1>
        <div class="tagline">Eldercare Services &amp; Assistance</div>
      </td>
      <td class="invoice-title">
        <h2>Tax Invoice</h2>
      </td>
    </tr>
  </table>

  <!-- ── Seller Address | Billing / Service Address ── -->
  <table class="address-table">
    <tr>
      <!-- LEFT: Sold By -->
      <td>
        <div class="section-heading">Sold By:</div>
        <div class="address-block">
          <p class="bold">${escapeHtml(co.name)}</p>
          <p>${escapeHtml(co.address)}</p>
          <p><strong>PAN No:</strong> ${escapeHtml(co.pan)}</p>
          <p><strong>GST Registration No:</strong> ${escapeHtml(co.gstin)}</p>
          ${co.cin ? `<p><strong>CIN:</strong> ${escapeHtml(co.cin)}</p>` : ''}
          <p><strong>Customer Care:</strong> +91 ${escapeHtml(co.phone)} | ${escapeHtml(co.email)}</p>
        </div>
      </td>

      <!-- RIGHT: Billing Address + Service Address -->
      <td>
        <div class="section-heading">Billing Address:</div>
        <div class="address-block">
          <p class="bold">${subscriberName}</p>
          ${subscriberAddress ? `<p>${subscriberAddress}</p>` : ''}
          ${subscriberState ? `<p>${subscriberState}</p>` : ''}
          ${subscriberStateCode ? `<p><strong>State/UT Code:</strong> ${subscriberStateCode}</p>` : ''}
          <p><strong>Place of Supply:</strong> ${placeOfSupplyDisplay}</p>
          ${subscriberPhone ? `<p><strong>Phone:</strong> ${subscriberPhone}</p>` : ''}
          ${subscriberEmail ? `<p><strong>Email:</strong> ${subscriberEmail}</p>` : ''}
        </div>

        ${invoice.beneficiary ? `
        <div class="address-sep"></div>
        <div class="section-heading">Service Address:</div>
        <div class="address-block">
          <p class="bold">${beneficiaryName}</p>
          ${beneficiaryAddress && beneficiaryAddress !== subscriberAddress ? `<p>${beneficiaryAddress}</p>` : ''}
          ${beneficiaryState ? `<p>${beneficiaryState}</p>` : ''}
          ${beneficiaryStateCode ? `<p><strong>State/UT Code:</strong> ${beneficiaryStateCode}</p>` : ''}
          <p><strong>Place of Delivery:</strong> ${escapeHtml(beneficiaryState || placeOfSupply)}</p>
        </div>` : ''}
      </td>
    </tr>
  </table>

  <!-- ── Order & Invoice Details Bar ── -->
  <table class="details-bar">
    <tr>
      <td>
        <p><strong>Order Number:</strong> ${escapeHtml(orderRef)}</p>
        <p><strong>Order Date:</strong> ${escapeHtml(orderDate)}</p>
      </td>
      <td>
        <p><strong>Invoice Number:</strong> ${escapeHtml(invoice.invoiceNumber || '—')}</p>
        <p><strong>Invoice Date:</strong> ${escapeHtml(issuedDateDisplay)}</p>
        <p><strong>Invoice Status:</strong> ${status}</p>
      </td>
    </tr>
  </table>

  <!-- ── 10-Column Itemized Table ── -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width:4%">Sl.<br/>No.</th>
        <th style="width:30%">Description</th>
        <th style="width:9%" class="text-right">Unit Price</th>
        <th style="width:7%" class="text-right">Discount</th>
        <th style="width:4%" class="text-center">Qty</th>
        <th style="width:9%" class="text-right">Net Amount</th>
        <th style="width:7%" class="text-center">Tax Rate</th>
        <th style="width:10%" class="text-center">Tax Type</th>
        <th style="width:8%" class="text-right">Tax Amount</th>
        <th style="width:10%" class="text-right">Total Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml || `<tr><td colspan="10" class="text-center" style="padding:10px; color:#777;">No items</td></tr>`}
      ${itemsTotalsRow}
    </tbody>
  </table>

  <!-- ── Summary: Amount in Words + Totals + Signatory ── -->
  <table class="summary-table">
    <tr>
      <!-- LEFT: Words + Reverse Charge -->
      <td class="words-box">
        <p class="bold" style="text-transform:uppercase; font-size:10px; color:#333;">Amount in Words:</p>
        <div class="amount-words">${escapeHtml(amountInWordsDisplay)}</div>
        <div class="reverse-charge">
          <p><strong>Whether tax is payable under reverse charge:</strong> No</p>
        </div>
      </td>

      <!-- RIGHT: Totals table + Signatory -->
      <td class="totals-box">
        <table class="totals-subtable">
          <tr>
            <td>Total Gross Amount:</td>
            <td class="text-right">₹${baseAmount.toFixed(2)}</td>
          </tr>
          ${discountRows}
          <tr>
            <td>Net Taxable Amount:</td>
            <td class="text-right">₹${taxableAmount.toFixed(2)}</td>
          </tr>
          ${gstRows}
          <tr class="grand-total">
            <td>Grand Total:</td>
            <td class="text-right">₹${payableAmount.toFixed(2)}</td>
          </tr>
        </table>

        <div class="signatory-container">
          <p style="font-size:10px;">For <strong>${escapeHtml(co.name)}:</strong></p>
          <div class="signatory-box">Authorised Signatory</div>
        </div>
      </td>
    </tr>
  </table>

  <!-- ── Payment Information ── -->
  ${paymentsHtml}

  <!-- ── Statutory Footer ── -->
  <div class="footer-section">
    <p style="color:#777;">This is a computer-generated statutory tax invoice and does not require a physical signature.</p>
  </div>

</body>
</html>`;
  }
}
