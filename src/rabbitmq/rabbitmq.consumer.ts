import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as amqplib from 'amqplib';
import { ProductsService } from '../products/products.service';
import { OrderCreatedEvent, StockReplyEvent } from './events';
import { RabbitmqPublisher } from './rabbitmq.publisher';
import {
  DEAD_LETTER_QUEUE,
  DLX,
  EXCHANGE,
  ORDER_CREATED_QUEUE,
  RK_ORDER_CREATED,
  RK_STOCK_REJECTED,
  RK_STOCK_RESERVED,
} from './topology';

@Injectable()
export class RabbitmqConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitmqConsumer.name);
  private connection?: amqplib.ChannelModel;
  private channel?: amqplib.Channel;

  constructor(
    private readonly productsService: ProductsService,
    private readonly publisher: RabbitmqPublisher,
  ) {}

  async onModuleInit() {
    const url = process.env.RABBITMQ_URL ?? 'amqp://app:app@127.0.0.1:5672';
    // prefetch = the v2 backpressure knob: bounds in-flight reservations so the
    // backlog stays in the broker (durable, observable), not in process memory
    const prefetch = Number(process.env.PREFETCH || 30);

    this.connection = await amqplib.connect(url);
    this.channel = await this.connection.createChannel();

    await this.channel.assertExchange(EXCHANGE, 'topic', { durable: true });
    await this.channel.assertExchange(DLX, 'fanout', { durable: true });
    await this.channel.assertQueue(DEAD_LETTER_QUEUE, { durable: true });
    await this.channel.bindQueue(DEAD_LETTER_QUEUE, DLX, '');
    await this.channel.assertQueue(ORDER_CREATED_QUEUE, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': DLX,
        'x-dead-letter-routing-key': 'dead',
      },
    });
    await this.channel.bindQueue(ORDER_CREATED_QUEUE, EXCHANGE, RK_ORDER_CREATED);
    await this.channel.prefetch(prefetch);

    this.logger.log(`[RabbitMQ] consumer ready (prefetch ${prefetch})`);

    await this.channel.consume(ORDER_CREATED_QUEUE, (msg) => {
      if (msg) void this.handleOrderCreated(msg);
    });
  }

  private async handleOrderCreated(msg: amqplib.ConsumeMessage) {
    try {
      const event = JSON.parse(msg.content.toString()) as OrderCreatedEvent;
      const outcome = await this.productsService.decrement(
        event.orderId,
        event.productId,
        event.quantity,
      );

      if (outcome === undefined) {
        // redelivery of an already-processed orderId (§7.2 dedup guard) — a
        // prior attempt already published the reply, nothing left to do
        this.channel?.ack(msg);
        return;
      }

      const reply: StockReplyEvent = outcome.reserved
        ? { orderId: event.orderId }
        : { orderId: event.orderId, reason: outcome.reason };
      const routingKey = outcome.reserved ? RK_STOCK_RESERVED : RK_STOCK_REJECTED;

      // ack only after the broker confirms the reply — a crash in between
      // redelivers order.created, which the processedOrder dedup guard makes safe
      await this.publisher.publish(routingKey, reply);
      this.channel?.ack(msg);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`order.created processing failed: ${err.message}`, err.stack);
      // unexpected failure → ordering.dlx → ordering.dead-letter (audit: depth 0)
      // — deliberately no connectivity-vs-poison classification (ARCHITECTURE.md
      // §7.5 discussion 2026-07-21): keeps one code path, keeps DLQ depth==0 sharp
      this.channel?.nack(msg, false, false);
    }
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }
}
