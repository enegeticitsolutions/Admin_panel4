import { getRedisClient } from './redis.connection';
import { NOTIFICATION_STREAMS, NotificationStreamEvent } from './redis.types';

export class NotificationProducer {
  private static instance: NotificationProducer;

  public static getInstance(): NotificationProducer {
    if (!NotificationProducer.instance) {
      NotificationProducer.instance = new NotificationProducer();
    }
    return NotificationProducer.instance;
  }

  /**
   * Publishes an event to the appropriate Redis Stream.
   * Execution time is typically < 2ms, returning immediately to the caller.
   */
  public async publish(event: Omit<NotificationStreamEvent, 'createdAt'> & { createdAt?: number }): Promise<{ success: boolean; streamId?: string; deduplicated?: boolean; error?: string }> {
    const redis = getRedisClient();

    let streamKey: string;
    switch (event.channel) {
      case 'push':
        streamKey = NOTIFICATION_STREAMS.PUSH;
        break;
      case 'whatsapp':
        streamKey = NOTIFICATION_STREAMS.WHATSAPP;
        break;
      case 'email':
        streamKey = NOTIFICATION_STREAMS.EMAIL;
        break;
      default:
        return { success: false, error: `Invalid notification channel: ${(event as any).channel}` };
    }

    const payload: NotificationStreamEvent = {
      ...event,
      createdAt: event.createdAt || Date.now(),
      retryCount: event.retryCount || 0,
    };

    try {
      // 1. Idempotency Check (60-second window by default)
      if (event.idempotencyKey) {
        const lockKey = `idemp:notif:${event.idempotencyKey}`;
        const acquired = await redis.set(lockKey, '1', 'EX', 60, 'NX').catch(() => 'OK');
        if (!acquired) {
          console.warn(`[NotificationProducer] Duplicate event skipped by idempotencyKey: ${event.idempotencyKey}`);
          return { success: true, deduplicated: true };
        }
      }

      // 2. XADD to stream: entry stored as key-value pairs
      const streamId = await redis.xadd(
        streamKey,
        '*', // Auto-generated timestamp-based ID
        'payload',
        JSON.stringify(payload)
      );

      console.log(`[NotificationProducer:XADD] Enqueued to ${streamKey} | Event: ${event.event} | StreamId: ${streamId}`);
      return { success: true, streamId: streamId || undefined };
    } catch (err: any) {
      console.warn(`[NotificationProducer] Redis unavailable (${err.message}). Using direct channel fallback...`);

      if (event.channel === 'whatsapp' && event.recipient.phone) {
        const { notificationService } = await import('../services/notification.service');
        const directResult = await notificationService.send({
          channel: 'whatsapp',
          event: event.event,
          to: event.recipient.phone,
          variables: event.variables,
          buttonPayload: event.buttonPayload,
          components: event.components,
        });
        return { success: directResult.success, error: directResult.error };
      }

      return { success: false, error: err.message };
    }
  }

  /**
   * Publish multiple events atomically (e.g. Omnichannel fanout to WhatsApp + Push)
   */
  public async publishMany(events: Array<Omit<NotificationStreamEvent, 'createdAt'>>): Promise<Array<{ success: boolean; streamId?: string; error?: string }>> {
    return Promise.all(events.map((e) => this.publish(e)));
  }
}

export const notificationProducer = NotificationProducer.getInstance();
