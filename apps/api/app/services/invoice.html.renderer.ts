// ─── InvoiceHtmlRenderer ───────────────────────────────────────────────────────
//
// Pure class responsible for rendering a GST Tax Invoice matching the mobile app
// standard template (apps/mobile-app/components/invoice/InvoiceGenerator.ts).
// Reusable across apps/api, apps/website, and apps/admin-backend.
//

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

export function numberToWords(num: number): string {
  if (num === 0) return 'Zero';

  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n: number): string => {
    let str = '';
    if (n > 99) {
      str += a[Math.floor(n / 100)] + 'Hundred ';
      n %= 100;
    }
    if (n > 19) {
      str += b[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      str += a[n];
    }
    return str;
  };

  let word = '';
  if (Math.floor(num / 10000000) > 0) {
    word += inWords(Math.floor(num / 10000000)) + 'Crore ';
    num %= 10000000;
  }
  if (Math.floor(num / 100000) > 0) {
    word += inWords(Math.floor(num / 100000)) + 'Lakh ';
    num %= 100000;
  }
  if (Math.floor(num / 1000) > 0) {
    word += inWords(Math.floor(num / 1000)) + 'Thousand ';
    num %= 1000;
  }
  if (num > 0) {
    word += inWords(Math.floor(num));
  }

  return word.trim();
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
   * Renders the tax invoice HTML strictly matching InvoiceGenerator.ts format.
   */
  static render(invoice: any, companyOverride?: Partial<CompanyDetails>): string {
    const co = { ...InvoiceHtmlRenderer.defaultCompany(), ...companyOverride };

    const subscriberName = invoice.subscriber?.name || 'Valued Customer';
    const subscriberPhone = invoice.subscriber?.phone || '';
    const subscriberEmail = invoice.subscriber?.email || '';
    const subscriberAddress = invoice.subscriber?.address || invoice.placeOfSupply || 'Haryana';
    const placeOfSupply = invoice.placeOfSupply || 'Haryana';
    const issuedDate = invoice.issuedAt
      ? new Date(invoice.issuedAt).toLocaleDateString('en-IN')
      : new Date().toLocaleDateString('en-IN');
    const status = (invoice.status || 'PAID').toUpperCase();

    const items = invoice.items || [];
    const itemsHtml = items.map((item: any, index: number) => {
      const price = Number(item.unitPrice || 0);
      const qty = Number(item.quantity || 1);
      const taxRate = Number(item.taxRate || 0);
      const taxAmount = Number(
        item.taxAmount !== undefined
          ? item.taxAmount
          : item.tax !== undefined
          ? item.tax
          : price * qty * (taxRate / 100)
      );
      const lineAmount = Number(
        item.amount !== undefined
          ? item.amount
          : (price * qty) + taxAmount
      );

      return `
    <tr>
      <td>${index + 1}</td>
      <td>${item.description || item.name || 'Service'}</td>
      <td>${item.hsnSacCode || '998399'}</td>
      <td>${qty}</td>
      <td>₹${price.toFixed(2)}</td>
      <td>${taxRate}%</td>
      <td>₹${taxAmount.toFixed(2)}</td>
      <td>₹${lineAmount.toFixed(2)}</td>
    </tr>`;
    }).join('');

    const baseAmount = Number(invoice.baseAmount || 0);
    const cgstAmount = Number(invoice.cgstAmount || 0);
    const sgstAmount = Number(invoice.sgstAmount || 0);
    const igstAmount = Number(invoice.igstAmount || 0);
    const totalTax = Number(invoice.taxAmount || (cgstAmount + sgstAmount + igstAmount) || 0);
    const discountAmount = Number(invoice.discountAmount || 0);
    const totalAmount = Number(invoice.totalAmount || (baseAmount + totalTax - discountAmount));

    const totalBeforeDiscount = baseAmount + (cgstAmount || 0) + (sgstAmount || 0) + (igstAmount || totalTax);
    const amountInWords = numberToWords(Math.round(totalAmount));

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tax Invoice - ${invoice.invoiceNumber}</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #333;
      line-height: 1.4;
      margin: 0;
      padding: 20px;
    }
    .no-print {
      text-align: right;
      margin-bottom: 15px;
    }
    .print-btn {
      background-color: #333;
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .print-btn:hover {
      background-color: #555;
    }
    .header {
      display: flex;
      justify-content: space-between;
      border-bottom: 2px solid #333;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    .company-details h1 {
      margin: 0 0 5px 0;
      font-size: 24px;
    }
    .company-details p {
      margin: 2px 0;
      font-size: 12px;
    }
    .invoice-title h2 {
      margin: 0 0 5px 0;
      font-size: 28px;
      text-align: right;
      text-transform: uppercase;
    }
    .invoice-title p {
      margin: 2px 0;
      font-size: 12px;
      text-align: right;
    }
    .billing-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    .billing-section > div {
      width: 48%;
    }
    .billing-section h3 {
      margin: 0 0 10px 0;
      font-size: 14px;
      border-bottom: 1px solid #ccc;
      padding-bottom: 5px;
    }
    .billing-section p {
      margin: 2px 0;
      font-size: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 12px;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #f5f5f5;
      font-weight: bold;
    }
    .totals-section {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 20px;
    }
    .totals-table {
      width: 50%;
    }
    .totals-table td {
      text-align: right;
    }
    .totals-table .bold td {
      font-weight: bold;
      border-top: 2px solid #333;
    }
    .amount-words {
      font-size: 12px;
      font-weight: bold;
      margin-bottom: 20px;
    }
    .footer-details {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      margin-top: 40px;
      border-top: 1px solid #ccc;
      padding-top: 10px;
    }
    .bank-details p, .auth-sign p {
      margin: 2px 0;
    }
    .auth-sign {
      text-align: right;
    }
    .signature-line {
      margin-top: 40px;
      border-top: 1px solid #333;
      display: inline-block;
      width: 150px;
    }
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

  <div class="header">
    <div class="company-details">
      <h1>${co.name}</h1>
      <p>${co.address}</p>
      <p><strong>GSTIN:</strong> ${co.gstin}</p>
      <p><strong>PAN:</strong> ${co.pan}</p>
      <p><strong>CIN:</strong> ${co.cin}</p>
      <p><strong>Email:</strong> ${co.email}</p>
      <p><strong>Phone:</strong> ${co.phone}</p>
    </div>
    <div class="invoice-title">
      <h2>TAX INVOICE</h2>
      <p><strong>Invoice No:</strong> ${invoice.invoiceNumber}</p>
      <p><strong>Date:</strong> ${issuedDate}</p>
      <p><strong>Status:</strong> ${status}</p>
    </div>
  </div>

  <div class="billing-section">
    <div class="billed-to">
      <h3>Billed To</h3>
      <p><strong>Name:</strong> ${subscriberName}</p>
      ${subscriberPhone ? `<p><strong>Phone:</strong> ${subscriberPhone}</p>` : ''}
      ${subscriberEmail ? `<p><strong>Email:</strong> ${subscriberEmail}</p>` : ''}
      <p>${subscriberAddress}</p>
    </div>
    <div class="supply-details">
      <h3>Supply Details</h3>
      <p><strong>Place of Supply:</strong> ${placeOfSupply}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Name</th>
        <th>HSN/SAC</th>
        <th>Quantity</th>
        <th>Price</th>
        <th>Tax %</th>
        <th>Tax Amount</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="totals-section">
    <table class="totals-table">
      <tr>
        <td>Total Amount</td>
        <td>₹${totalBeforeDiscount.toFixed(2)}</td>
      </tr>
      ${discountAmount > 0 ? `
      <tr>
        <td>Discount</td>
        <td>-₹${discountAmount.toFixed(2)}</td>
      </tr>
      ` : ''}
      <tr class="bold">
        <td>Total Payable Amount</td>
        <td>₹${totalAmount.toFixed(2)}</td>
      </tr>
    </table>
  </div>

  <div class="amount-words">
    Total Amount (in words): ${amountInWords} Rupees Only
  </div>

  <div class="footer-details">
    <div class="bank-details">
    </div>
    <div class="auth-sign">
      <p>For ${co.name}</p>
      <div class="signature-line"></div>
      <p>Authorised Signatory</p>
    </div>
  </div>
  
  <p style="text-align: center; font-size: 10px; margin-top: 20px; color: #777;">This is a computer generated invoice and does not require physical signature.</p>
</body>
</html>`;
  }
}
