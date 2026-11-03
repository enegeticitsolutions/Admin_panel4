export const NOTIFICATION_STREAMS = {
  PUSH: 'stream:notifications:push',
  WHATSAPP: 'stream:notifications:whatsapp',
  EMAIL: 'stream:notifications:email',
  DLQ: 'stream:notifications:dlq',
} as const;

export const NOTIFICATION_CONSUMER_GROUP = 'notification-workers';

export interface NotificationRecipient {
  userId?: string;
  phone?: string;
  email?: string;
  pushToken?: string;
}

export interface NotificationStreamEvent {
  id?: string; // Redis Stream Entry ID (e.g. 1725350000000-0)
  idempotencyKey?: string;
  channel: 'push' | 'whatsapp' | 'email';
  event: string; // E.g. 'VISIT_SCHEDULED', 'OTP_LOGIN', 'CC_PERFORMANCE_RATING'
  recipient: NotificationRecipient;
  variables: Record<string, any>;
  buttonPayload?: string;
  components?: Record<string, any>;
  metadata?: {
    screen?: string;
    priority?: 'high' | 'normal' | 'low';
    sound?: string;
    badge?: number;
    channelId?: string;
    subject?: string; // For email
    html?: string;    // For email
    sourceApp?: string;
  };
  retryCount?: number;
  createdAt: number;
}
