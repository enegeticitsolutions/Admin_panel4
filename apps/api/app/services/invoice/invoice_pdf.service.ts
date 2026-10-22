import puppeteer from 'puppeteer';
import prisma from '../../core/database';
import { InvoiceHtmlRenderer, CompanyDetails } from '../invoice.html.renderer';
import { getStorageService } from '../storage';

export class InvoicePdfService {
  /**
   * Converts statutory invoice HTML into an A4 PDF buffer.
   */
  static async htmlToPdfBuffer(html: string): Promise<Buffer> {
    // Strip print button for clean PDF document output
    const cleanHtml = html.replace(/<div class="no-print">[\s\S]*?<\/div>/gi, '');

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(cleanHtml, { waitUntil: 'load' });
      const pdfUint8Array = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '12mm',
          right: '12mm',
          bottom: '12mm',
          left: '12mm',
        },
      });
      return Buffer.from(pdfUint8Array);
    } finally {
      await browser.close();
    }
  }

  /**
   * Generates a statutory PDF for a full invoice DB object, uploads to S3,
   * updates the database record with pdfUrl, and returns the S3 storage path.
   */
  static async generateAndUploadInvoicePdf(
    invoice: any,
    companyOverride?: Partial<CompanyDetails>
  ): Promise<string> {
    // Load company config if not provided
    let company = companyOverride;
    if (!company) {
      const configRows = await prisma.systemConfig.findMany({
        where: {
          key: {
            in: [
              'COMPANY_NAME',
              'COMPANY_ADDRESS',
              'COMPANY_GSTIN',
              'COMPANY_PAN',
              'COMPANY_CIN',
              'COMPANY_EMAIL',
              'COMPANY_PHONE',
            ],
          },
        },
      });
      const configMap: Record<string, string> = {};
      for (const r of configRows) configMap[r.key] = r.value;
      company = {
        name: configMap.COMPANY_NAME,
        address: configMap.COMPANY_ADDRESS,
        gstin: configMap.COMPANY_GSTIN,
        pan: configMap.COMPANY_PAN,
        cin: configMap.COMPANY_CIN,
        email: configMap.COMPANY_EMAIL,
        phone: configMap.COMPANY_PHONE,
      };
    }

    const html = InvoiceHtmlRenderer.render(invoice, company);
    const pdfBuffer = await this.htmlToPdfBuffer(html);

    const storage = getStorageService();
    const sanitizedNumber = (invoice.invoiceNumber || invoice.id || 'INV').replace(/[^a-zA-Z0-9_-]/g, '-');
    const s3Path = `invoices/${sanitizedNumber}.pdf`;

    await storage.upload(pdfBuffer, s3Path, 'application/pdf');

    // Update DB record with the S3 file key
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        pdfUrl: s3Path,
        pdfGeneratedAt: new Date(),
      },
    });

    return s3Path;
  }

  /**
   * Retrieves a secure, time-limited presigned URL for an invoice PDF.
   * If the PDF has not been generated yet, it will generate it on the fly and upload to S3.
   */
  static async getInvoicePdfUrl(
    invoiceIdOrNumber: string,
    subscriberId?: string
  ): Promise<{ downloadUrl: string; fileName: string; s3Key: string }> {
    const invoice = await prisma.invoice.findFirst({
      where: {
        OR: [{ id: invoiceIdOrNumber }, { invoiceNumber: invoiceIdOrNumber }],
        ...(subscriberId ? { subscriberId } : {}),
      },
      include: {
        subscriber: true,
        beneficiary: true,
        items: true,
        payments: true,
      },
    });

    if (!invoice) {
      throw new Error(`Invoice not found for reference: ${invoiceIdOrNumber}`);
    }

    const storage = getStorageService();
    let s3Key = invoice.pdfUrl;

    if (!s3Key) {
      console.log(`[InvoicePdfService] PDF not yet in S3 for ${invoice.invoiceNumber}. Generating and uploading...`);
      s3Key = await this.generateAndUploadInvoicePdf(invoice);
    }

    const sanitizedNumber = (invoice.invoiceNumber || invoice.id).replace(/[^a-zA-Z0-9_-]/g, '-');
    const fileName = `Invoice-${sanitizedNumber}.pdf`;
    const downloadUrl = await storage.getPresignedUrl(s3Key, 3600); // 1-hour expiration

    return { downloadUrl, fileName, s3Key };
  }
}
