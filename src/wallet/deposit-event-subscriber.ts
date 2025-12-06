import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Example service demonstrating how to subscribe to deposit events
 * This service listens to the Redis pub/sub channel for deposit notifications
 */
@Injectable()
export class DepositEventSubscriber implements OnModuleInit {
  private readonly logger = new Logger(DepositEventSubscriber.name);
  private subscriber: Redis;

  constructor(private readonly configService: ConfigService) {
    const redisHost = this.configService.get<string>('redis.host') || 'localhost';
    const redisPort = this.configService.get<number>('redis.port') || 6379;
    
    // Create a separate Redis client for subscribing
    this.subscriber = new Redis({
      host: redisHost,
      port: redisPort,
    });
  }

  async onModuleInit() {
    this.subscribeToDeposits();
  }

  private subscribeToDeposits() {
    this.subscriber.subscribe('deposits', (err, count) => {
      if (err) {
        this.logger.error('Failed to subscribe to deposits channel', err);
        return;
      }
      this.logger.log(`Subscribed to ${count} channel(s)`);
    });

    this.subscriber.on('message', (channel, message) => {
      if (channel === 'deposits') {
        this.handleDepositEvent(message);
      }
    });

    this.logger.log('Deposit event subscriber initialized');
  }

  private handleDepositEvent(message: string) {
    try {
      const event = JSON.parse(message);
      
      this.logger.log('='.repeat(60));
      this.logger.log('💰 NEW DEPOSIT RECEIVED');
      this.logger.log('='.repeat(60));
      this.logger.log(`Transaction ID: ${event.transactionId}`);
      this.logger.log(`User ID: ${event.userId}`);
      this.logger.log(`Currency: ${event.currency}`);
      this.logger.log(`Amount: ${event.amount}`);
      this.logger.log(`TX Hash: ${event.txHash}`);
      this.logger.log(`Address: ${event.address}`);
      this.logger.log(`Confirmations: ${event.confirmations}`);
      this.logger.log(`Timestamp: ${event.timestamp}`);
      this.logger.log('='.repeat(60));

      // Here you can add custom logic:
      // - Send email notification to user
      // - Send push notification
      // - Update trading account
      // - Trigger webhooks
      // - Log to analytics
      // - Update user dashboard via WebSocket

      this.notifyUser(event);
      this.updateAnalytics(event);

    } catch (error) {
      this.logger.error('Error handling deposit event', error);
    }
  }

  private notifyUser(event: any) {
    // Example: Send notification to user
    this.logger.log(`📧 Sending notification to user ${event.userId}`);
    
    // In production:
    // - Send email via SendGrid/AWS SES
    // - Send push notification via Firebase
    // - Send WebSocket message to connected clients
    // - Trigger SMS via Twilio
  }

  private updateAnalytics(event: any) {
    // Example: Update analytics/metrics
    this.logger.log(`📊 Updating analytics for ${event.currency} deposit`);
    
    // In production:
    // - Track deposit volume metrics
    // - Update user activity stats
    // - Send to data warehouse
    // - Update real-time dashboards
  }
}
