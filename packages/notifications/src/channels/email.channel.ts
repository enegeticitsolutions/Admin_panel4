import { IEmailProvider, EmailMessage, EmailSendResponse } from '../interfaces/IEmailProvider';
import { AwsSesEmailProvider, TemplatedEmailOptions } from '../providers/email/AwsSesEmailProvider';

export class EmailChannel {
  private provider: IEmailProvider;

  constructor(provider?: IEmailProvider) {
    this.provider = provider || new AwsSesEmailProvider();
  }

  public setProvider(provider: IEmailProvider) {
    this.provider = provider;
  }

  public async send(message: EmailMessage): Promise<EmailSendResponse> {
    return this.provider.send(message);
  }

  public async sendTemplate(options: TemplatedEmailOptions): Promise<EmailSendResponse> {
    if (this.provider instanceof AwsSesEmailProvider) {
      return this.provider.sendTemplate(options);
    }

    // Fallback if generic provider: try send with basic message
    console.warn(`[EmailChannel] Provider "${this.provider.name}" does not support native SES templates. Falling back.`);
    return this.provider.send({
      to: options.to,
      subject: `Notification: ${options.templateName}`,
      html: `<pre>${JSON.stringify(options.templateData, null, 2)}</pre>`,
    });
  }
}
