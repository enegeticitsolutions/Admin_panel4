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
  // ── Indian State / UT code lookup ──────────────────────────────────────────
  const INDIAN_STATE_CODES: Record<string, string> = {
    'jammu & kashmir': '01', 'jammu and kashmir': '01',
    'himachal pradesh': '02', 'punjab': '03', 'chandigarh': '04',
    'uttarakhand': '05', 'uttaranchal': '05',
    'haryana': '06', 'gurgaon': '06', 'gurugram': '06', 'faridabad': '06',
    'delhi': '07', 'new delhi': '07', 'delhi ncr': '07', 'ncr': '07',
    'rajasthan': '08', 'jaipur': '08',
    'uttar pradesh': '09', 'noida': '09', 'greater noida': '09', 'ghaziabad': '09',
    'bihar': '10', 'patna': '10',
    'sikkim': '11', 'arunachal pradesh': '12', 'nagaland': '13', 'manipur': '14', 'mizoram': '15',
    'tripura': '16', 'meghalaya': '17', 'assam': '18',
    'west bengal': '19', 'kolkata': '19', 'calcutta': '19',
    'jharkhand': '20', 'ranchi': '20', 'odisha': '21', 'orissa': '21', 'chhattisgarh': '22',
    'madhya pradesh': '23', 'bhopal': '23', 'indore': '23',
    'gujarat': '24', 'ahmedabad': '24',
    'dadra and nagar haveli and daman and diu': '26',
    'maharashtra': '27', 'mumbai': '27', 'pune': '27',
    'andhra pradesh': '28',
    'karnataka': '29', 'bangalore': '29', 'bengaluru': '29',
    'goa': '30', 'lakshadweep': '31', 'kerala': '32',
    'tamil nadu': '33', 'chennai': '33',
    'puducherry': '34', 'pondicherry': '34',
    'andaman and nicobar islands': '35',
    'telangana': '36', 'hyderabad': '36', 'ladakh': '38',
  };
  const getStateCode = (s: string) => INDIAN_STATE_CODES[s?.trim().toLowerCase()] || '';

  const formatDateShort = (d: string | Date | undefined) => {
    if (!d) return '';
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) return '';
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    return `${dd}.${mm}.${dt.getFullYear()}`;
  };

  const formatPayDateTime = (d: string | Date | undefined) => {
    if (!d) return '';
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) return '';
    return dt.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  };

  // ── Amounts ───────────────────────────────────────────────────────────────
  const baseAmount    = Number(data.baseAmount || 0);
  const cgstAmount    = Number(data.cgstAmount || 0);
  const sgstAmount    = Number(data.sgstAmount || 0);
  const igstAmount    = Number(data.igstAmount || 0);
  const posRaw  = data.placeOfSupply || '';
  const posCode = getStateCode(posRaw);
  const posDisplay = posRaw ? `${posRaw}${posCode ? ` (${posCode})` : ''}` : '—';
  const subStateCode = getStateCode(posRaw);
  const isInterState = igstAmount > 0 || (posRaw && posRaw.trim().toLowerCase() !== 'haryana' && !['gurgaon', 'gurugram', 'faridabad'].includes(posRaw.trim().toLowerCase()));

  // Predefined tenure/duration discounts are already baked into the package price.
  // In the discount section, ONLY applied coupon and Saathi discounts are shown.
  const couponDiscount = Number(data.discountAmount || 0);
  const saathiDiscount = Number(data.saathiDiscountAmount || 0);
  const totalDiscount  = Math.round((couponDiscount + saathiDiscount) * 100) / 100;
  const taxableAmount  = Math.round((baseAmount - totalDiscount) * 100) / 100;
  const payableAmount  = Number(data.totalAmount !== undefined && data.totalAmount !== null
    ? data.totalAmount
    : Math.max(0, baseAmount + cgstAmount + sgstAmount + igstAmount - totalDiscount));

  // ── Items table ───────────────────────────────────────────────────────────
  let totalNetAmount  = 0;
  let totalTaxAmt     = 0;
  let totalLineAmount = 0;

  const itemsHtml = data.items.map((item, index) => {
    const qty         = Number(item.quantity || 1);
    const unitPrice   = Number(item.unitPrice || 0);
    const grossAmount = item.grossAmount !== undefined ? item.grossAmount : (unitPrice * qty);
    const netAmount   = item.taxableAmount !== undefined
      ? item.taxableAmount
      : (item.amount !== undefined ? item.amount : Math.max(0, grossAmount - (item.discountAmount || 0)));
    const itemDiscount = Math.max(0, grossAmount - netAmount);
    const taxRate  = Number(item.taxRate || 0);
    const taxAmount = item.taxAmount !== undefined
      ? item.taxAmount
      : (item.tax !== undefined ? item.tax : Math.round(netAmount * taxRate) / 100);
    const lineTotal = item.totalAmount !== undefined
      ? item.totalAmount
      : Math.round((netAmount + taxAmount) * 100) / 100;

    totalNetAmount  += netAmount;
    totalTaxAmt     += taxAmount;
    totalLineAmount += lineTotal;

    const isExempt = taxRate === 0 && taxAmount === 0;
    let taxTypeHtml: string;
    if (isExempt) {
      taxTypeHtml = 'Exempt';
    } else if (isInterState) {
      taxTypeHtml = `IGST (${taxRate}%)`;
    } else {
      taxTypeHtml = `CGST (${taxRate / 2}%)<br/>+ SGST (${taxRate / 2}%)`;
    }
    const taxRateDisplay = isExempt ? '0% (Exempt)' : `${taxRate}%`;

    return `
    <tr>
      <td class="text-center">${index + 1}</td>
      <td>
        <div class="desc-title">${item.description}</div>
        <div class="desc-sub">SAC / HSN: ${item.hsnSacCode}</div>
      </td>
      <td class="text-right">₹${unitPrice.toFixed(2)}</td>
      <td class="text-right">₹${itemDiscount.toFixed(2)}</td>
      <td class="text-center">${qty}</td>
      <td class="text-right">₹${netAmount.toFixed(2)}</td>
      <td class="text-center">${taxRateDisplay}</td>
      <td class="text-center">${taxTypeHtml}</td>
      <td class="text-right">₹${taxAmount.toFixed(2)}</td>
      <td class="text-right bold">₹${lineTotal.toFixed(2)}</td>
    </tr>`;
  }).join('');

  const itemsTotalsRow = data.items.length > 0 ? `
    <tr class="items-total-row">
      <td colspan="5" class="text-right bold">TOTALS:</td>
      <td class="text-right bold">₹${totalNetAmount.toFixed(2)}</td>
      <td class="text-center">—</td>
      <td class="text-center">—</td>
      <td class="text-right bold">₹${totalTaxAmt.toFixed(2)}</td>
      <td class="text-right bold">₹${totalLineAmount.toFixed(2)}</td>
    </tr>` : '';

  // ── Amount in words ───────────────────────────────────────────────────────
  const words = numberToWords(payableAmount);
  let amountInWordsDisplay = words;
  if (!amountInWordsDisplay.endsWith('Only')) {
    const paise = Math.round((payableAmount % 1) * 100);
    amountInWordsDisplay = paise > 0
      ? `${numberToWords(Math.floor(payableAmount))} Rupees and ${numberToWords(paise)} Paise Only`
      : `${numberToWords(Math.floor(payableAmount))} Rupees Only`;
  }

  // ── GST summary ───────────────────────────────────────────────────────────
  // Statutory requirement: Explicitly display all GST components so 0 is shown when not applicable
  const gstRows = `
    <tr><td>Total CGST:</td><td class="text-right">₹${cgstAmount.toFixed(2)}</td></tr>
    <tr><td>Total SGST:</td><td class="text-right">₹${sgstAmount.toFixed(2)}</td></tr>
    <tr><td>Total IGST:</td><td class="text-right">₹${igstAmount.toFixed(2)}</td></tr>
  `;

  const discountRows = totalDiscount > 0 ? `
    ${couponDiscount > 0 ? `<tr><td>Discount:</td><td class="text-right">-₹${couponDiscount.toFixed(2)}</td></tr>` : ''}
    ${saathiDiscount > 0 ? `<tr><td>Saathi Discount:</td><td class="text-right">-₹${saathiDiscount.toFixed(2)}</td></tr>` : ''}
  ` : '';

  // ── Payment information ───────────────────────────────────────────────────
  const paymentMethod  = data.paymentMethod  || '';
  const transactionId  = data.transactionId  || '';
  const paymentStatus  = (data.paymentStatus || data.status || '').toUpperCase();
  const isPaid         = paymentStatus === 'PAID' || paymentStatus === 'SUCCESS';

  const paymentSection = isPaid && (transactionId || paymentMethod) ? `
    <table class="payment-table">
      <thead><tr><th colspan="4">Payment Information</th></tr></thead>
      <tbody>
        <tr>
          <td style="width:32%"><strong>Payment Transaction ID:</strong><br/><span class="font-mono">${transactionId || '—'}</span></td>
          <td style="width:28%"><strong>Payment Date &amp; Time:</strong><br/>${formatPayDateTime(data.issuedAt)}</td>
          <td style="width:20%"><strong>Mode of Payment:</strong><br/>${paymentMethod || 'Online / Gateway'}</td>
          <td style="width:20%" class="text-right"><strong>Invoice Value:</strong><br/><span class="bold">₹${payableAmount.toFixed(2)}</span></td>
        </tr>
      </tbody>
    </table>` : '';

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Tax Invoice - ${data.invoiceNumber}</title>
      <style>
        @page { size: A4 portrait; margin: 10mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, Helvetica, sans-serif; font-size: 11px; line-height: 1.35; color: #111; background: #fff; padding: 15px; }
        table.full-width { width: 100%; border-collapse: collapse; margin-bottom: 0; }
        .header-table td { vertical-align: top; padding-bottom: 8px; }
        .company-brand h1 { font-size: 20px; font-weight: 800; color: #111; letter-spacing: -0.3px; margin-bottom: 2px; }
        .company-brand .tagline { font-size: 10px; color: #555; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
        .invoice-title { text-align: right; }
        .invoice-title h2 { font-size: 15px; font-weight: 700; color: #111; margin-bottom: 2px; }
        .invoice-title .subtitle { font-size: 11px; font-weight: 600; color: #444; }
        .address-table { border: 1px solid #333; margin-top: 8px; margin-bottom: 0; width: 100%; border-collapse: collapse; }
        .address-table td { width: 50%; vertical-align: top; padding: 8px 10px; font-size: 10.5px; border-right: 1px solid #333; }
        .address-table td:last-child { border-right: none; }
        .section-heading { font-size: 11px; font-weight: 700; color: #000; border-bottom: 1px solid #ddd; padding-bottom: 3px; margin-bottom: 5px; text-transform: uppercase; }
        .address-block p { margin: 1px 0; color: #222; }
        .address-sep { border-top: 1px solid #ccc; margin: 6px 0; }
        .details-bar { border: 1px solid #333; border-top: none; margin-bottom: 10px; background-color: #fafafa; width: 100%; border-collapse: collapse; }
        .details-bar td { width: 50%; padding: 6px 10px; vertical-align: top; font-size: 10.5px; border-right: 1px solid #333; }
        .details-bar td:last-child { border-right: none; }
        .details-bar p { margin: 2px 0; }
        table.items-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; border: 1px solid #333; }
        table.items-table th { background-color: #f2f2f2; border: 1px solid #333; padding: 6px 4px; font-size: 9.5px; font-weight: 700; text-transform: uppercase; color: #111; }
        table.items-table td { border: 1px solid #ccc; padding: 6px 4px; font-size: 10px; vertical-align: top; }
        .items-total-row td { border-top: 2px solid #333; background-color: #fafafa; font-weight: 700; font-size: 10.5px; }
        .desc-title { font-weight: 600; color: #111; }
        .desc-sub { font-size: 9px; color: #555; margin-top: 1px; }
        .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        .summary-table td { vertical-align: top; }
        .words-box { width: 55%; padding-right: 15px; font-size: 10.5px; }
        .amount-words { font-weight: 700; font-size: 11px; margin: 4px 0 10px; color: #000; line-height: 1.4; }
        .reverse-charge { font-size: 10px; margin-top: 6px; color: #222; }
        .totals-box { width: 45%; }
        .totals-subtable { width: 100%; border-collapse: collapse; border: 1px solid #333; }
        .totals-subtable td { padding: 4px 8px; font-size: 10.5px; border-bottom: 1px solid #eee; }
        .totals-subtable tr:last-child td { border-bottom: none; }
        .totals-subtable tr.grand-total td { font-weight: 800; font-size: 12px; border-top: 2px solid #333; border-bottom: 2px solid #333; background-color: #f7f7f7; }
        .signatory-container { margin-top: 10px; text-align: right; padding-right: 10px; }
        .signatory-box { margin-top: 35px; font-weight: 700; font-size: 10.5px; color: #111; }
        .payment-table { width: 100%; border-collapse: collapse; border: 1px solid #333; margin-top: 12px; margin-bottom: 12px; background-color: #fafafa; }
        .payment-table th { background-color: #f2f2f2; border-bottom: 1px solid #333; padding: 5px 8px; font-size: 10px; font-weight: 700; text-align: left; text-transform: uppercase; }
        .payment-table td { padding: 6px 8px; font-size: 10px; border-right: 1px solid #ddd; }
        .payment-table td:last-child { border-right: none; }
        .footer-section { border-top: 1px solid #333; padding-top: 8px; margin-top: 10px; text-align: center; font-size: 9.5px; color: #444; line-height: 1.5; }
        .footer-demand { font-size: 10.5px; font-weight: 700; color: #111; margin-bottom: 3px; }
        .text-center { text-align: center; }
        .text-left { text-align: left; }
        .text-right { text-align: right; }
        .bold { font-weight: 700; }
        .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
      </style>
    </head>
    <body>

      <table class="full-width header-table">
        <tr>
          <td class="company-brand">
            <h1>${data.companyName}</h1>
            <div class="tagline">Eldercare Services &amp; Assistance</div>
          </td>
          <td class="invoice-title">
            <h2>Tax Invoice</h2>
          </td>
        </tr>
      </table>

      <table class="address-table">
        <tr>
          <td>
            <div class="section-heading">Sold By:</div>
            <div class="address-block">
              <p class="bold">${data.companyName}</p>
              <p>${data.companyAddress}</p>
              <p><strong>PAN No:</strong> ${data.companyPan}</p>
              <p><strong>GST Registration No:</strong> ${data.companyGstin}</p>
              ${data.companyCin ? `<p><strong>CIN:</strong> ${data.companyCin}</p>` : ''}
              <p><strong>Customer Care:</strong> +91 ${data.companyPhone} | ${data.companyEmail}</p>
            </div>
          </td>
          <td>
            <div class="section-heading">Billing Address:</div>
            <div class="address-block">
              <p class="bold">${data.subscriberName}</p>
              ${data.subscriberAddress ? `<p>${data.subscriberAddress}</p>` : ''}
              ${subStateCode ? `<p><strong>State/UT Code:</strong> ${subStateCode}</p>` : ''}
              <p><strong>Place of Supply:</strong> ${posDisplay}</p>
              ${data.subscriberPhone ? `<p><strong>Phone:</strong> ${data.subscriberPhone}</p>` : ''}
              ${data.subscriberEmail ? `<p><strong>Email:</strong> ${data.subscriberEmail}</p>` : ''}
            </div>
          </td>
        </tr>
      </table>

      <table class="details-bar">
        <tr>
          <td>
            <p><strong>Order Number:</strong> —</p>
            <p><strong>Order Date:</strong> ${formatDateShort(data.issuedAt)}</p>
          </td>
          <td>
            <p><strong>Invoice Number:</strong> ${data.invoiceNumber}</p>
            <p><strong>Invoice Date:</strong> ${formatDateShort(data.issuedAt)}</p>
            <p><strong>Invoice Status:</strong> ${data.status}</p>
          </td>
        </tr>
      </table>

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
          ${itemsHtml || '<tr><td colspan="10" class="text-center" style="padding:10px; color:#777;">No items</td></tr>'}
          ${itemsTotalsRow}
        </tbody>
      </table>

      <table class="summary-table">
        <tr>
          <td class="words-box">
            <p class="bold" style="text-transform:uppercase; font-size:10px; color:#333;">Amount in Words:</p>
            <div class="amount-words">${amountInWordsDisplay}</div>
            <div class="reverse-charge">
              <p><strong>Whether tax is payable under reverse charge:</strong> No</p>
            </div>
          </td>
          <td class="totals-box">
            <table class="totals-subtable">
              <tr><td>Total Gross Amount:</td><td class="text-right">₹${baseAmount.toFixed(2)}</td></tr>
              ${discountRows}
              <tr><td>Net Taxable Amount:</td><td class="text-right">₹${taxableAmount.toFixed(2)}</td></tr>
              ${gstRows}
              <tr class="grand-total"><td>Grand Total:</td><td class="text-right">₹${payableAmount.toFixed(2)}</td></tr>
            </table>
            <div class="signatory-container">
              <p style="font-size:10px;">For <strong>${data.companyName}:</strong></p>
              <div class="signatory-box">Authorised Signatory</div>
            </div>
          </td>
        </tr>
      </table>

      ${paymentSection}

      <div class="footer-section">
        <p style="color:#777;">This is a computer-generated statutory tax invoice and does not require a physical signature.</p>
      </div>

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

/**
 * Downloads the canonical statutory PDF directly from the S3 presigned URL
 * and opens the system Share/Save sheet for the user.
 */
export const downloadS3InvoicePDF = async (pdfUrl: string, fileName?: string) => {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.open(pdfUrl, '_blank');
        return;
      }
    }

    let FileSystem: any = null;
    try {
      FileSystem = await import('expo-file-system/legacy');
    } catch (_) {}
    const Sharing = await getSharingModule();

    const name = fileName || `Invoice-${Date.now()}.pdf`;

    if (FileSystem?.documentDirectory) {
      const localUri = `${FileSystem.documentDirectory}${name}`;
      const downloadResult = await FileSystem.downloadAsync(pdfUrl, localUri);

      if (Sharing && downloadResult?.uri) {
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save Invoice to Files',
          UTI: 'com.adobe.pdf',
        });
        return;
      }
    }

    // Fallback: Native browser/linking
    const Linking = (await import('react-native')).Linking;
    await Linking.openURL(pdfUrl);
  } catch (err: any) {
    console.error('[downloadS3InvoicePDF] Error downloading PDF:', err);
    Alert.alert('Download Error', 'Could not download or open invoice PDF. Please try again.');
  }
};

