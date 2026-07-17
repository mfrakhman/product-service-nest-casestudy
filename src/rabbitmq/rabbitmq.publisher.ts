import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as amqplib from 'amqplib';
import { EXCHANGE } from './topology';

/**
 * Publisher on a confirm channel: publish() resolves only when the broker has
 * accepted the message. The consumer acks order.created only after that
 * resolution, so a stock.* reply can never be silently lost between our DB
 * commit and the broker (ARCHITECTURE.md §5 "reply durability").
 */
@Injectable()
export class RabbitmqPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitmqPublisher.name);
  private connection?: amqplib.ChannelModel;
  private channel?: amqplib.ConfirmChannel;

  async onModuleInit() {
    const url = process.env.RABBITMQ_URL ?? 'amqp://app:app@127.0.0.1:5672';
    this.connection = await amqplib.connect(url);
    this.channel = await this.connection.createConfirmChannel();
    await this.channel.assertExchange(EXCHANGE, 'topic', { durable: true });
    this.logger.log('[RabbitMQ] publisher ready (confirm channel)');
  }

  publish(routingKey: string, data: unknown): Promise<void> {
    const channel = this.channel;
    if (!channel) {
      throw new Error('RabbitMQ confirm channel is not initialized');
    }
    const payload = Buffer.from(JSON.stringify(data));
    return new Promise((resolve, reject) => {
      channel.publish(
        EXCHANGE,
        routingKey,
        payload,
        // contentType lets the Quarkus connector map the body straight to JSON
        { persistent: true, contentType: 'application/json' },
        (err) => (err ? reject(err) : resolve()),
      );
    });
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }
}
