import nodemailer from 'nodemailer';
import { SESClient, SendRawEmailCommand, SendTemplatedEmailCommand } from '@aws-sdk/client-ses';
import { IEmailProvider, EmailMessage, EmailSendResponse } from '../../interfaces/IEmailProvider';

export interface TemplatedEmailOptions {
  to: string | string[];
  templateName: string;
  templateData: Record<string, any>;
  from?: string;
  replyTo?: string[];
  cc?: string[];
  bcc?: string[];
}

export class AwsSesEmailProvider implements IEmailProvider {
  readonly name = 'aws-ses';
  private transporter: nodemailer.Transporter | null = null;
  private sesClient: SESClient | null = null;
  private defaultFrom: string;

  constructor() {
    const fromName = process.env.AWS_SES_FROM_NAME || 'MaiHoonNa Care';
    const fromEmail = process.env.AWS_SES_FROM_EMAIL || process.env.EMAIL_USER || 'info@maihoonna.com';
    this.defaultFrom = `"${fromName}" <${fromEmail}>`;
    this.initTransporter();
  }

  private initTransporter() {
    const accessKeyId = process.env.AWS_SES_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SES_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_SES_REGION || process.env.AWS_REGION || 'ap-south-1';

    // 1. If explicit credentials provided OR fallback to default AWS credentials chain
    try {
      const sesConfig: any = { region };
      if (accessKeyId && secretAccessKey) {
        sesConfig.credentials = { accessKeyId, secretAccessKey };
      }

      this.sesClient = new SESClient(sesConfig);
      console.log(`[AwsSesEmailProvider] Initialized with AWS SES Client (${region})`);
      return;
    } catch (err: any) {
      console.warn('[AwsSesEmailProvider] Failed to initialize AWS SES client:', err.message);
    }

    // 2. Fallback to SMTP (e.g. Zoho smtppro.zoho.in)
    const host = process.env.EMAIL_HOST;
    const port = Number(process.env.EMAIL_PORT) || 465;
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      console.log(`[AwsSesEmailProvider] Using SMTP fallback (${host}:${port})`);
      return;
    }

    console.warn('[AwsSesEmailProvider] No AWS SES keys or SMTP configuration found. Emails will run in dry-run mode.');
  }

  async send(message: EmailMessage): Promise<EmailSendResponse> {
    const fromAddress = message.from || this.defaultFrom;
    const toAddresses = Array.isArray(message.to) ? message.to : [message.to];

    // 1. Send via AWS SES SDK if client is initialized
    if (this.sesClient) {
      try {
        const { SendEmailCommand } = require('@aws-sdk/client-ses');
        const command = new SendEmailCommand({
          Source: fromAddress,
          Destination: {
            ToAddresses: toAddresses,
            CcAddresses: message.cc ? (Array.isArray(message.cc) ? message.cc : [message.cc]) : undefined,
            BccAddresses: message.bcc ? (Array.isArray(message.bcc) ? message.bcc : [message.bcc]) : undefined,
          },
          Message: {
            Subject: { Data: message.subject, Charset: 'UTF-8' },
            Body: {
              Html: message.html ? { Data: message.html, Charset: 'UTF-8' } : undefined,
              Text: { Data: message.text || (message.html ? message.html.replace(/<[^>]*>/g, '') : message.subject), Charset: 'UTF-8' },
            },
          },
          ReplyToAddresses: message.replyTo ? (Array.isArray(message.replyTo) ? message.replyTo : [message.replyTo]) : undefined,
        });

        const response: any = await this.sesClient.send(command);
        console.log(`[AwsSesEmailProvider] Email delivered to ${toAddresses.join(', ')} (MessageId: ${response.MessageId})`);
        return {
          success: true,
          messageId: response.MessageId,
        };
      } catch (err: any) {
        console.error(`[AwsSesEmailProvider] Failed to send email to ${toAddresses.join(', ')}:`, err.message || err);
        return {
          success: false,
          error: err.message || 'Failed to send email via SES',
        };
      }
    }

    // 2. Fallback to Nodemailer / SMTP transporter if configured
    if (this.transporter) {
      try {
        const mailOptions: nodemailer.SendMailOptions = {
          from: fromAddress,
          to: toAddresses.join(', '),
          subject: message.subject,
          html: message.html,
          text: message.text || (message.html ? message.html.replace(/<[^>]*>/g, '') : ''),
          replyTo: message.replyTo,
          cc: message.cc,
          bcc: message.bcc,
          attachments: message.attachments,
        };

        const info = await this.transporter.sendMail(mailOptions);
        console.log(`[AwsSesEmailProvider] SMTP Email delivered to ${toAddresses.join(', ')} (MessageId: ${info.messageId})`);
        return {
          success: true,
          messageId: info.messageId,
        };
      } catch (err: any) {
        console.error(`[AwsSesEmailProvider] SMTP send failed:`, err.message);
        return { success: false, error: err.message };
      }
    }

    // 3. Dry-Run
    console.log(`[AwsSesEmailProvider:DryRun] Sending to ${toAddresses.join(', ')} | Subject: "${message.subject}"`);
    return {
      success: true,
      messageId: `dry-run-${Date.now()}`,
    };
  }

  /**
   * Send AWS SES Templated Email using predefined template on AWS SES
   */
  async sendTemplate(options: TemplatedEmailOptions): Promise<EmailSendResponse> {
    const region = process.env.AWS_SES_REGION || process.env.AWS_REGION || 'ap-south-1';
    if (!this.sesClient) {
      this.sesClient = new SESClient({ region });
    }

    const toAddresses = Array.isArray(options.to) ? options.to : [options.to];
    const fromAddress = options.from || this.defaultFrom;

    try {
      const command = new SendTemplatedEmailCommand({
        Source: fromAddress,
        Destination: {
          ToAddresses: toAddresses,
          CcAddresses: options.cc,
          BccAddresses: options.bcc,
        },
        Template: options.templateName,
        TemplateData: JSON.stringify(options.templateData || {}),
        ReplyToAddresses: options.replyTo,
      });

      const response = await this.sesClient.send(command);
      console.log(`[AwsSesEmailProvider] Template "${options.templateName}" sent to ${toAddresses.join(', ')} (MessageId: ${response.MessageId})`);

      return {
        success: true,
        messageId: response.MessageId,
      };
    } catch (err: any) {
      console.error(`[AwsSesEmailProvider] Failed to send template "${options.templateName}" to ${toAddresses.join(', ')}:`, err.message || err);
      return {
        success: false,
        error: err.message || 'Failed to send SES template email',
      };
    }
  }
}

