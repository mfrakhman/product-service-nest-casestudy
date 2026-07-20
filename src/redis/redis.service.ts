import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Thin wrapper around ioredis — fail-open (ARCHITECTURE.md §7.4): if Redis
 * errors or is slow, callers just get undefined back and fall through to
 * Postgres instead of failing the request.
 *
 * `commandTimeout` + `enableOfflineQueue: false` are what make that fast —
 * without them, ioredis queues commands and waits through reconnect
 * attempts while Redis is down, which can block a request for 10+ seconds
 * even with a low retry count (found by actually stopping Redis and testing).
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client?: Redis;

  onModuleInit() {
    this.client = new Redis({
      host: process.env.REDIS_HOST ?? '127.0.0.1',
      port: Number(process.env.REDIS_PORT ?? 6379),
      commandTimeout: 250, // give up on a slow/hung command after 250ms
      enableOfflineQueue: false, // don't queue commands while disconnected — fail now
      maxRetriesPerRequest: 1,
    });
    this.client.on('error', (err) => this.logger.warn(`[Redis] ${err.message}`));
  }

  async getJson<T>(key: string): Promise<T | undefined> {
    try {
      const raw = await this.client?.get(key);
      return raw ? (JSON.parse(raw) as T) : undefined;
    } catch (err) {
      this.logger.warn(`[Redis] GET ${key} failed, treating as miss: ${(err as Error).message}`);
      return undefined;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.client?.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      this.logger.warn(`[Redis] SET ${key} failed (non-fatal): ${(err as Error).message}`);
    }
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }
}
