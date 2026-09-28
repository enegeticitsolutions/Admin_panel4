import { Platform, Alert } from 'react-native';
import { numberToWords } from '../../utils/numberToWords';

const getPrintModule = async () => {
  try {
    return await import('expo-print');
  } catch {
    return null;
  }
};

const getSharingModule = async () => {
  try {
    return await import('expo-sharing');
  } catch {
    return null;
  }
};

export interface InvoiceItem {
  description: string;
  hsnSacCode: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  tax?: number;
  amount: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  issuedAt: string;
  status: string;
  companyName: string;
  companyAddress: string;
  companyGstin: string;
  companyPan: string;
  companyCin: string;
  companyEmail: string;
  companyPhone: string;
  companyBankName: string;
  companyBankAccount: string;
  companyBankIfsc: string;
  companyUpiId: string;
  subscriberName: string;
  subscriberAddress: string;
  subscriberPhone?: string;
  subscriberEmail?: string;
  placeOfSupply: string;
  items: InvoiceItem[];
  baseAmount: number;
  discountAmount: number;
  saathiDiscountAmount?: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod?: string;
  transactionId?: string;
  paymentStatus?: string;
  gatewayName?: string;
}

export const generateInvoicePDF = async (data: InvoiceData) => {
const itemsHtml = data.items.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${item.description}</td>
      <td>${item.hsnSacCode}</td>
      <td>${item.quantity}</td>
      <td>₹${item.unitPrice.toFixed(2)}</td>
      <td>${item.taxRate}%</td>
      <td>₹${(item.tax || 0).toFixed(2)}</td>
      <td>₹${((item.unitPrice * item.quantity) + (item.tax || 0)).toFixed(2)}</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Tax Invoice - ${data.invoiceNumber}</title>
      <style>
        body {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          color: #333;
          line-height: 1.4;
          margin: 0;
          padding: 20px;
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
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-details">
          <h1>${data.companyName}</h1>
          <p>${data.companyAddress}</p>
          <p><strong>GSTIN:</strong> ${data.companyGstin}</p>
          <p><strong>PAN:</strong> ${data.companyPan}</p>
          <p><strong>CIN:</strong> ${data.companyCin}</p>
          <p><strong>Email:</strong> ${data.companyEmail}</p>
          <p><strong>Phone:</strong> ${data.companyPhone}</p>
        </div>
        <div class="invoice-title">
          <h2>TAX INVOICE</h2>
          <p><strong>Invoice No:</strong> ${data.invoiceNumber}</p>
          <p><strong>Date:</strong> ${new Date(data.issuedAt).toLocaleDateString('en-IN')}</p>
          <p><strong>Status:</strong> ${data.status}</p>
        </div>
      </div>

      <div class="billing-section">
        <div class="billed-to">
          <h3>Billed To</h3>
          <p><strong>Name:</strong> ${data.subscriberName}</p>
          ${data.subscriberPhone ? `<p><strong>Phone:</strong> ${data.subscriberPhone}</p>` : ''}
          ${data.subscriberEmail ? `<p><strong>Email:</strong> ${data.subscriberEmail}</p>` : ''}
          <p>${data.subscriberAddress}</p>
        </div>
        <div class="supply-details">
          <h3>Supply Details</h3>
          <p><strong>Place of Supply:</strong> ${data.placeOfSupply}</p>
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
            <td>₹${(data.baseAmount + (data.cgstAmount || 0) + (data.sgstAmount || 0) + (data.igstAmount || 0)).toFixed(2)}</td>
          </tr>
          ${(data.discountAmount + (data.saathiDiscountAmount || 0)) > 0 ? `
          <tr>
            <td>Total Discount</td>
            <td>-₹${(data.discountAmount + (data.saathiDiscountAmount || 0)).toFixed(2)}</td>
          </tr>
          ` : ''}
          <tr class="bold">
            <td>Total Payable Amount</td>
            <td>₹${data.totalAmount.toFixed(2)}</td>
          </tr>
        </table>
      </div>

      <div class="amount-words">
        Total Amount (in words): ${numberToWords(Math.round(data.totalAmount))} Rupees Only
      </div>

      <div class="footer-details">
        <div class="bank-details">
        </div>
        <div class="auth-sign">
          <p>For ${data.companyName}</p>
          <div class="signature-line"></div>
          <p>Authorised Signatory</p>
        </div>
      </div>
      
      <p style="text-align: center; font-size: 10px; margin-top: 20px; color: #777;">This is a computer generated invoice and does not require a physical signature.</p>
    </body>
    </html>
  `;

  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.focus();
          printWindow.print();
          return;
        }
      }
    }

    const Print = await getPrintModule();
    const Sharing = await getSharingModule();

    if (Print && Sharing) {
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });
      
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Download Invoice',
        UTI: 'com.adobe.pdf'
      });
    } else {
      Alert.alert('Notice', 'Invoice printing is not available on this platform/configuration.');
    }
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};
