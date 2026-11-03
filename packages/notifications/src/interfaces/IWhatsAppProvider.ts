export interface WhatsAppMessage {
  to: string;            // "+919876543210"
  templateName: string;  // Approved WhatsApp template name
  language?: string;     // "en" | "hi" (defaults to "en")
  variables?: string[];  // Template body variable substitutions
  components?: Record<string, any>; // Direct custom components (e.g. body_1, button_1)
  mediaUrl?: string;     // Optional image/document URL
  buttonPayload?: string; // Quick reply callback payload (e.g. ACTIVATE_SUB:123:subscriber)
}

export interface IWhatsAppProvider {
  readonly name: string; // "msg91-whatsapp" | "gupshup"
  send(message: WhatsAppMessage): Promise<{ success: boolean; messageId?: string; error?: string }>;
}
