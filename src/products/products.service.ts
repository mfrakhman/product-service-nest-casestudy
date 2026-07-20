import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateProductDto } from './dto/create-product.dto';

export interface ProductProfile {
  id: string;
  name: string;
  price: number;
  qty: number;
  createdAt: string;
}

export type DecrementOutcome =
  | { reserved: true }
  | { reserved: false; reason: string };

class InsufficientStockError extends Error {
  constructor(productId: string) {
    super(`insufficient stock or unknown product ${productId}`);
  }
}

// TTL for the product:{id} cache (ARCHITECTURE.md §7.4 placement A/B) — long,
// no invalidation: price/name are immutable in v3 (no update endpoint), and
// qty staleness here is fine because nothing reads qty from this cache to
// gate a stock decision (that's always a live Postgres read, see decrement()).
const PRODUCT_CACHE_TTL_SECONDS = 60;

function cacheKey(id: string): string {
  return `product:${id}`;
}

function toProfile(row: {
  id: string;
  name: string;
  price: { toNumber(): number };
  qty: number;
  createdAt: Date;
}): ProductProfile {
  return {
    id: row.id,
    name: row.name,
    price: row.price.toNumber(),
    qty: row.qty,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async create(dto: CreateProductDto): Promise<ProductProfile> {
    const row = await this.prisma.product.create({
      data: { name: dto.name, price: dto.price, qty: dto.qty },
    });
    const profile = toProfile(row);
    // best-effort warm — a miss just means the next reader fills it
    await this.redis.setJson(cacheKey(profile.id), profile, PRODUCT_CACHE_TTL_SECONDS);
    return profile;
  }

  /**
   * Read-through cache (ARCHITECTURE.md §7.4 placement B — profile display).
   * Positive-only: a not-found result is never cached, so a just-created
   * product is never hidden behind a stale miss.
   */
  async findById(id: string): Promise<ProductProfile | undefined> {
    const cached = await this.redis.getJson<ProductProfile>(cacheKey(id));
    if (cached) {
      return cached;
    }
    const row = await this.prisma.product.findUnique({ where: { id } });
    if (!row) {
      return undefined;
    }
    const profile = toProfile(row);
    await this.redis.setJson(cacheKey(id), profile, PRODUCT_CACHE_TTL_SECONDS);
    return profile;
  }

  /**
   * order.created handler logic (ARCHITECTURE.md §7.2/§7.3/§7.6): one
   * transaction does the redelivery-dedup guard INSERT and the conditional
   * decrement together. A redelivered orderId hits the processedOrder PK
   * conflict and skips the decrement without re-deciding anything — the
   * first attempt's outcome already published (or is about to).
   */
  async decrement(
    orderId: string,
    productId: string,
    quantity: number,
  ): Promise<DecrementOutcome | undefined> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.processedOrder.create({ data: { orderId, quantity } });
        const result = await tx.product.updateMany({
          where: { id: productId, qty: { gte: quantity } },
          data: { qty: { decrement: quantity } },
        });
        if (result.count === 0) {
          throw new InsufficientStockError(productId);
        }
      });
      return { reserved: true };
    } catch (error) {
      if (isDuplicateProcessedOrder(error)) {
        this.logger.log(`order ${orderId} already processed — redelivery, skipping`);
        return undefined; // already handled by a prior attempt — no reply to (re)publish
      }
      if (error instanceof InsufficientStockError) {
        return { reserved: false, reason: error.message };
      }
      throw error; // unexpected → consumer nacks → DLQ
    }
  }
}

/** Prisma P2002 = unique constraint violation (processedOrder row already exists). */
function isDuplicateProcessedOrder(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'P2002'
  );
}
