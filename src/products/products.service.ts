import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderItemPayload } from '../rabbitmq/events';

export type ReserveOutcome =
  | { reserved: true }
  | { reserved: false; reason: string };

class InsufficientStockError extends Error {
  constructor(skuId: string) {
    super(`insufficient stock or unknown sku ${skuId}`);
  }
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * All-or-nothing reservation (v2 consumer logic, ARCHITECTURE.md §2/§5):
   * a `reservations` receipt row + one conditional decrement per item
   * (stock >= qty), all inside one transaction. Any shortfall (or unknown SKU
   * — the decrement matches zero rows either way) rolls back everything.
   *
   * Delivery is at-least-once, so the receipt row is what makes redelivery
   * safe: it commits atomically with the decrements, and a redelivered order
   * hits its PK conflict → we skip the decrements and just re-reply reserved.
   * Rejections write no row — re-running a rejection changes nothing.
   */
  async reserveForOrder(
    orderId: string,
    items: OrderItemPayload[],
  ): Promise<ReserveOutcome> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.reservation.create({ data: { orderId } });
        for (const item of items) {
          const result = await tx.sku.updateMany({
            where: { id: item.skuId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
          if (result.count === 0) {
            throw new InsufficientStockError(item.skuId);
          }
        }
      });
      return { reserved: true };
    } catch (error) {
      if (isDuplicateReservation(error)) {
        return { reserved: true }; // redelivery — already reserved, re-reply
      }
      if (error instanceof InsufficientStockError) {
        return { reserved: false, reason: error.message };
      }
      throw error; // unexpected → consumer nacks → DLQ
    }
  }

  findAllSkus() {
    return this.prisma.sku.findMany({ orderBy: { id: 'asc' } });
  }
}

/** Prisma P2002 = unique constraint violation (receipt row already exists). */
function isDuplicateReservation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'P2002'
  );
}
