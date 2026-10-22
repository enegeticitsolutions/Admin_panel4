const puppeteer = require('puppeteer');
const { prisma } = require('../../lib/prisma');
const { render: renderInvoiceHtml } = require('./invoice.html.renderer');
const storage = require('../../services/storage');

class InvoicePdfService {
  /**
   * Converts statutory invoice HTML into an A4 PDF buffer.
   */
  static async htmlToPdfBuffer(html) {
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
  static async generateAndUploadInvoicePdf(invoice, companyOverride) {
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
      const configMap = {};
      for (const r of configRows) configMap[r.key] = r.value;
      company = {
        name: configMap.COMPANY_NAME || process.env.COMPANY_NAME || 'MaiHoonNa Eldercare Private Limited',
        address: configMap.COMPANY_ADDRESS || process.env.COMPANY_ADDRESS || 'DLF Phase V, Gurugram, Haryana',
        gstin: configMap.COMPANY_GSTIN || process.env.COMPANY_GSTIN || '06AAUCM9447N1ZE',
        pan: configMap.COMPANY_PAN || process.env.COMPANY_PAN || 'AAUCM9447N',
        cin: configMap.COMPANY_CIN || process.env.COMPANY_CIN || 'U86900HR2026PTC145612',
        email: configMap.COMPANY_EMAIL || process.env.COMPANY_EMAIL || 'info@maihoonna.com',
        phone: configMap.COMPANY_PHONE || process.env.COMPANY_PHONE || '8507070049',
      };
    }

    const html = renderInvoiceHtml(invoice, company);
    const pdfBuffer = await this.htmlToPdfBuffer(html);

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
  static async getInvoicePdfUrl(invoiceIdOrNumber) {
    const invoice = await prisma.invoice.findFirst({
      where: {
        OR: [{ id: invoiceIdOrNumber }, { invoiceNumber: invoiceIdOrNumber }],
      },
      include: {
        subscriber: true,
        beneficiary: true,
        subscription: {
          include: {
            package: true,
            packageVersion: true,
          },
        },
        items: true,
        payments: true,
      },
    });

    if (!invoice) {
      throw new Error(`Invoice not found for reference: ${invoiceIdOrNumber}`);
    }

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

module.exports = { InvoicePdfService };
