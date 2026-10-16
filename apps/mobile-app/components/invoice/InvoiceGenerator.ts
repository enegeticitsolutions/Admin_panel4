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
  /** Gross pre-discount amount (unitPrice * quantity) */
  grossAmount?: number;
  /** Allocated discount amount on this line */
  discountAmount?: number;
  /** Post-discount net taxable value */
  taxableAmount?: number;
  taxRate: number;
  /** Statutory GST on this line */
  taxAmount?: number;
  /** Line grand total (taxableAmount + taxAmount) */
  totalAmount?: number;

  // Legacy backward-compatibility aliases
  tax?: number;
  amount?: number;
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
  const itemsHtml = data.items.map((item, index) => {
    const qty = Number(item.quantity || 1);
    const unitPrice = Number(item.unitPrice || 0);
    const grossAmount = item.grossAmount !== undefined ? item.grossAmount : (unitPrice * qty);
    const discountAmount = item.discountAmount !== undefined ? item.discountAmount : 0;
    const taxableAmount = item.taxableAmount !== undefined
      ? item.taxableAmount
      : (item.amount !== undefined ? item.amount : Math.max(0, grossAmount - discountAmount));
    const taxRate = Number(item.taxRate || 0);
    const taxAmount = item.taxAmount !== undefined
      ? item.taxAmount
      : (item.tax !== undefined ? item.tax : Math.round(taxableAmount * taxRate) / 100);
    const lineTotal = item.totalAmount !== undefined
      ? item.totalAmount
      : Math.round((taxableAmount + taxAmount) * 100) / 100;

    return `
    <tr>
      <td>${index + 1}</td>
      <td>${item.description}</td>
      <td>${item.hsnSacCode}</td>
      <td>${qty}</td>
      <td>₹${unitPrice.toFixed(2)}</td>
      <td>${taxRate}%</td>
      <td>₹${taxAmount.toFixed(2)}</td>
      <td>₹${lineTotal.toFixed(2)}</td>
    </tr>
  `;
  }).join('');

  const baseAmount = Number(data.baseAmount || 0);
  const cgstAmount = Number(data.cgstAmount || 0);
  const sgstAmount = Number(data.sgstAmount || 0);
  const igstAmount = Number(data.igstAmount || 0);
  const totalTax = Number(data.taxAmount || (cgstAmount + sgstAmount + igstAmount) || 0);

  // Predefined tenure/duration discounts are already baked into the package price (priceThreeMonths, etc.).
  // In the discount section, ONLY applied coupon and Saathi discounts are calculated.
  const couponDiscount = Number(data.discountAmount || 0);
  const saathiDiscount = Number(data.saathiDiscountAmount || 0);
  const totalDiscount = Math.round((couponDiscount + saathiDiscount) * 100) / 100;

  // Gross before applied coupon / saathi discount:
  const grossBeforeDiscount = Math.round((baseAmount + totalTax) * 100) / 100;
  const payableAmount = Number(data.totalAmount !== undefined && data.totalAmount !== null
    ? data.totalAmount
    : Math.max(0, Math.round((grossBeforeDiscount - totalDiscount) * 100) / 100));

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
            <th>Unit Price</th>
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
            <td>₹${grossBeforeDiscount.toFixed(2)}</td>
          </tr>
          ${couponDiscount > 0 ? `
          <tr>
            <td>Discount</td>
            <td>-₹${couponDiscount.toFixed(2)}</td>
          </tr>
          ` : ''}
          ${saathiDiscount > 0 ? `
          <tr>
            <td>Saathi Discount</td>
            <td>-₹${saathiDiscount.toFixed(2)}</td>
          </tr>
          ` : ''}
          ${(couponDiscount > 0 && saathiDiscount > 0) ? `
          <tr>
            <td style="font-weight: 600;">Total Discount</td>
            <td style="font-weight: 600;">-₹${totalDiscount.toFixed(2)}</td>
          </tr>
          ` : ''}
          <tr class="bold">
            <td>Total Payable Amount</td>
            <td>₹${payableAmount.toFixed(2)}</td>
          </tr>
        </table>
      </div>

      <div class="amount-words">
        Total Amount (in words): ${numberToWords(Math.round(payableAmount))} Rupees Only
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
    let FileSystem: any = null;
    try {
      FileSystem = await import('expo-file-system/legacy');
    } catch (_) {}

    if (!Print) {
      Alert.alert('Notice', 'Invoice printing is not available on this platform/configuration.');
      return;
    }

    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    const sanitizedInvoiceNumber = (data.invoiceNumber || 'INV').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `Invoice-${sanitizedInvoiceNumber}.pdf`;

    if (Platform.OS === 'android' && FileSystem?.StorageAccessFramework) {
      try {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const destinationUri = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            fileName,
            'application/pdf'
          );
          const base64Content = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          await FileSystem.writeAsStringAsync(destinationUri, base64Content, {
            encoding: FileSystem.EncodingType.Base64,
          });
          Alert.alert('Download Complete', 'Invoice saved successfully to your selected folder.');
          return;
        }
      } catch (safErr) {
        console.warn('StorageAccessFramework save failed or cancelled, falling back to share sheet:', safErr);
      }
    }

    if (Platform.OS === 'ios' && FileSystem?.documentDirectory) {
      try {
        const targetPath = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.copyAsync({ from: uri, to: targetPath });
        if (Sharing) {
          await Sharing.shareAsync(targetPath, {
            mimeType: 'application/pdf',
            dialogTitle: 'Save Invoice to Files',
            UTI: 'com.adobe.pdf'
          });
          return;
        }
      } catch (iosErr) {
        console.warn('iOS document copy failed, using original uri:', iosErr);
      }
    }

    if (Sharing) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Download Invoice',
        UTI: 'com.adobe.pdf'
      });
    } else {
      Alert.alert('Notice', 'Invoice sharing/download is not available on this platform.');
    }
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

export const downloadInvoicePDF = generateInvoicePDF;

