import { getRedisClient } from './redis.connection';
import { NOTIFICATION_STREAMS, NOTIFICATION_CONSUMER_GROUP, NotificationStreamEvent } from './redis.types';
import { WhatsAppRegistry } from '../registry/whatsapp.registry';
import { WhatsAppChannel } from '../channels/whatsapp.channel';
import { PushChannel } from '../channels/push.channel';
import { EmailChannel } from '../channels/email.channel';

export class NotificationConsumer {
  private consumerName: string;
  private isRunning: boolean = false;
  private whatsAppChannel: WhatsAppChannel;
  private pushChannel: PushChannel;
  private emailChannel: EmailChannel;
  private autoClaimInterval: any = null;

  constructor(consumerName?: string) {
    this.consumerName = consumerName || `worker-${process.pid}-${Date.now().toString(36)}`;
    this.whatsAppChannel = new WhatsAppChannel();
    this.pushChannel = new PushChannel();
    this.emailChannel = new EmailChannel();
  }

  /**
   * Initializes Redis Consumer Groups idempotently across all streams
   */
  public async initConsumerGroups(): Promise<void> {
    const redis = getRedisClient();
    const streams = [
      NOTIFICATION_STREAMS.PUSH,
      NOTIFICATION_STREAMS.WHATSAPP,
      NOTIFICATION_STREAMS.EMAIL,
    ];

    for (const stream of streams) {
      try {
        // MKSTREAM creates the stream if it doesn't already exist
        await redis.xgroup('CREATE', stream, NOTIFICATION_CONSUMER_GROUP, '$', 'MKSTREAM');
        console.log(`[NotificationConsumer] Created consumer group "${NOTIFICATION_CONSUMER_GROUP}" for stream "${stream}"`);
      } catch (err: any) {
        if (err.message && err.message.includes('BUSYGROUP')) {
          // Consumer group already exists, safe to ignore
        } else {
          console.error(`[NotificationConsumer] Error creating group for ${stream}:`, err.message);
        }
      }
    }
  }

  /**
   * Starts the continuous consumer polling loop
   */
  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    await this.initConsumerGroups();
    console.log(`🚀 [NotificationConsumer] Worker started: ${this.consumerName}`);

    // Start background routine to reclaim orphaned pending messages every 30 seconds
    this.startAutoClaimLoop();

    const redis = getRedisClient();
    const streams = [
      NOTIFICATION_STREAMS.WHATSAPP,
      NOTIFICATION_STREAMS.PUSH,
      NOTIFICATION_STREAMS.EMAIL,
    ];

    while (this.isRunning) {
      try {
        // XREADGROUP BLOCK 2000 COUNT 10 STREAMS stream1 stream2 stream3 > > >
        const results = await (redis as any).xreadgroup(
          'GROUP',
          NOTIFICATION_CONSUMER_GROUP,
          this.consumerName,
          'BLOCK',
          2000,
          'COUNT',
          10,
          'STREAMS',
          ...streams,
          '>',
          '>',
          '>'
        );

        if (!results || results.length === 0) {
          continue;
        }

        for (const [streamName, entries] of results as any[]) {
          for (const [messageId, fields] of entries) {
            await this.processMessage(streamName, messageId, fields);
          }
        }
      } catch (err: any) {
        if (!this.isRunning) break;
        console.error('[NotificationConsumer] Polling loop error:', err.message || err);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  /**
   * Processes a single stream message, invokes the channel provider, and ACKs on success
   */
  private async processMessage(streamName: string, messageId: string, fields: string[]): Promise<void> {
    const redis = getRedisClient();
    let rawPayload: string | null = null;

    for (let i = 0; i < fields.length; i += 2) {
      if (fields[i] === 'payload') {
        rawPayload = fields[i + 1];
        break;
      }
    }

    if (!rawPayload) {
      console.warn(`[NotificationConsumer] Invalid entry in ${streamName} without payload (ID: ${messageId})`);
      await redis.xack(streamName, NOTIFICATION_CONSUMER_GROUP, messageId);
      return;
    }

    let eventData: NotificationStreamEvent;
    try {
      eventData = JSON.parse(rawPayload);
      eventData.id = messageId;
    } catch (parseErr: any) {
      console.error(`[NotificationConsumer] JSON parse failed for ${messageId}:`, parseErr.message);
      await redis.xack(streamName, NOTIFICATION_CONSUMER_GROUP, messageId);
      return;
    }

    try {
      console.log(`[NotificationConsumer] Processing ${eventData.channel.toUpperCase()} [${eventData.event}] (ID: ${messageId})`);
      const result = await this.dispatchToChannel(eventData);

      if (result.success) {
        console.log(`✅ [NotificationConsumer] Successfully delivered ${eventData.event} to ${eventData.recipient.phone || eventData.recipient.email || eventData.recipient.userId}`);
        await redis.xack(streamName, NOTIFICATION_CONSUMER_GROUP, messageId);
      } else {
        console.warn(`⚠️ [NotificationConsumer] Channel delivery failed for ${eventData.event}: ${result.error}`);
        await this.handleFailure(streamName, messageId, eventData, result.error);
      }
    } catch (err: any) {
      console.error(`❌ [NotificationConsumer] Exception delivering ${eventData.event}:`, err.message || err);
      await this.handleFailure(streamName, messageId, eventData, err.message);
    }
  }

  /**
   * Route event to the matching channel provider
   */
  private async dispatchToChannel(eventData: NotificationStreamEvent): Promise<{ success: boolean; error?: string; messageId?: string }> {
    switch (eventData.channel) {
      case 'whatsapp': {
        const phone = eventData.recipient.phone;
        if (!phone) return { success: false, error: 'Recipient phone number missing' };

        const templateConfig = WhatsAppRegistry[eventData.event];
        if (!templateConfig) {
          return { success: false, error: `Event "${eventData.event}" not registered in WhatsAppRegistry` };
        }

        const orderedVariables: string[] = [];
        for (const key of templateConfig.body) {
          const val = eventData.variables[key];
          if (val === undefined || val === null) {
            return { success: false, error: `Missing variable "${key}" for template "${templateConfig.template}"` };
          }
          orderedVariables.push(String(val));
        }

        return this.whatsAppChannel.send({
          to: phone,
          templateName: templateConfig.template,
          variables: orderedVariables,
          buttonPayload: eventData.buttonPayload,
          components: eventData.components,
        });
      }

      case 'push': {
        const pushToken = eventData.recipient.pushToken;
        if (!pushToken) return { success: false, error: 'Push token missing for recipient' };

        return this.pushChannel.send({
          to: pushToken,
          title: eventData.variables.title || 'MaiHoonNa Alert',
          body: eventData.variables.body || '',
          data: {
            ...eventData.variables,
            screen: eventData.metadata?.screen,
            event: eventData.event,
          },
          sound: eventData.metadata?.sound || 'default',
          badge: eventData.metadata?.badge || 1,
          priority: (eventData.metadata?.priority as any) || 'high',
          channelId: eventData.metadata?.channelId || 'default',
        });
      }

      case 'email': {
        const email = eventData.recipient.email;
        if (!email) return { success: false, error: 'Recipient email address missing' };

        return this.emailChannel.send({
          to: email,
          subject: eventData.metadata?.subject || eventData.variables.subject || 'MaiHoonNa Update',
          html: eventData.metadata?.html || eventData.variables.html,
          text: eventData.variables.text,
        });
      }

      default:
        return { success: false, error: `Unsupported channel: ${(eventData as any).channel}` };
    }
  }

  /**
   * Exponential backoff and Dead Letter Queue (DLQ) routing
   */
  private async handleFailure(streamName: string, messageId: string, eventData: NotificationStreamEvent, errorReason?: string): Promise<void> {
    const redis = getRedisClient();
    const retryCount = (eventData.retryCount || 0) + 1;

    if (retryCount >= 5) {
      // Exceeded max retries: route to Dead Letter Queue (DLQ)
      console.error(`🚨 [NotificationConsumer:DLQ] Message ${messageId} exceeded max retries. Routing to ${NOTIFICATION_STREAMS.DLQ}`);
      await redis.xadd(
        NOTIFICATION_STREAMS.DLQ,
        '*',
        'originalStream', streamName,
        'originalMessageId', messageId,
        'failedAt', String(Date.now()),
        'error', errorReason || 'Unknown error',
        'payload', JSON.stringify({ ...eventData, retryCount })
      );
      // ACK original message so it doesn't block the stream
      await redis.xack(streamName, NOTIFICATION_CONSUMER_GROUP, messageId);
    } else {
      // Leave in PEL for auto-claim retry or re-add with updated retryCount
      console.log(`[NotificationConsumer:Retry] Will retry ${eventData.event} (Attempt ${retryCount}/5)`);
    }
  }

  /**
   * Self-healing: Claims orphaned unacknowledged messages (workers that crashed)
   */
  private startAutoClaimLoop(): void {
    const redis = getRedisClient();
    const minIdleTimeMs = 60000; // 60 seconds idle in PEL

    this.autoClaimInterval = setInterval(async () => {
      if (!this.isRunning) return;

      const streams = [
        NOTIFICATION_STREAMS.WHATSAPP,
        NOTIFICATION_STREAMS.PUSH,
        NOTIFICATION_STREAMS.EMAIL,
      ];

      for (const stream of streams) {
        try {
          // XAUTOCLAIM stream group consumer min-idle-time start COUNT 10
          if (typeof (redis as any).xautoclaim === 'function') {
            const res = await (redis as any).xautoclaim(
              stream,
              NOTIFICATION_CONSUMER_GROUP,
              this.consumerName,
              minIdleTimeMs,
              '0-0',
              'COUNT',
              10
            );

            const claimedEntries = res?.[1] || [];
            if (claimedEntries.length > 0) {
              console.log(`[NotificationConsumer:AutoClaim] Reclaimed ${claimedEntries.length} orphaned entries from ${stream}`);
              for (const [msgId, fields] of claimedEntries) {
                await this.processMessage(stream, msgId, fields);
              }
            }
          }
        } catch (claimErr: any) {
          // Ignore if XAUTOCLAIM is not supported by older Redis or no pending messages
        }
      }
    }, 30000);
  }

  /**
   * Graceful Shutdown
   */
  public async stop(): Promise<void> {
    console.log('[NotificationConsumer] Stopping worker...');
    this.isRunning = false;
    if (this.autoClaimInterval) {
      clearInterval(this.autoClaimInterval);
      this.autoClaimInterval = null;
    }
  }
}
