import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReserveItemDto } from './dtos/reserve-stock.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * All-or-nothing reservation: every item is a conditional decrement
   * (stock >= qty) inside one transaction. Any item falling short rolls
   * back the whole order — no partial reservations, no read-then-write
   * race on stock.
   */
  async reserve(items: ReserveItemDto[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        const result = await tx.sku.updateMany({
          where: { id: item.skuId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (result.count === 0) {
          throw new ConflictException(
            `insufficient stock for sku ${item.skuId}`,
          );
        }
      }
    });
  }

  findAllSkus() {
    return this.prisma.sku.findMany({ orderBy: { id: 'asc' } });
  }
}
