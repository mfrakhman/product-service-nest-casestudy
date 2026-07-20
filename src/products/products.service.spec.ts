import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

// Prisma P2002 error shape, mocked without importing the generated client's
// error class (keeps this test independent of the generated output).
class MockPrismaError extends Error {
  code = 'P2002';
}

describe('ProductsService.decrement', () => {
  function buildService(tx: {
    processedOrderCreate: jest.Mock;
    productUpdateMany: jest.Mock;
  }) {
    const prisma = {
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) =>
        fn({
          processedOrder: { create: tx.processedOrderCreate },
          product: { updateMany: tx.productUpdateMany },
        }),
      ),
    } as unknown as PrismaService;
    const redis = {
      getJson: jest.fn(),
      setJson: jest.fn(),
    } as unknown as RedisService;
    return new ProductsService(prisma, redis);
  }

  it('reserves stock when the guarded decrement matches a row', async () => {
    const service = buildService({
      processedOrderCreate: jest.fn().mockResolvedValue(undefined),
      productUpdateMany: jest.fn().mockResolvedValue({ count: 1 }),
    });

    const outcome = await service.decrement('order-1', 'sku-1', 2);

    expect(outcome).toEqual({ reserved: true });
  });

  it('rejects when the guarded decrement matches zero rows (insufficient stock)', async () => {
    const service = buildService({
      processedOrderCreate: jest.fn().mockResolvedValue(undefined),
      productUpdateMany: jest.fn().mockResolvedValue({ count: 0 }),
    });

    const outcome = await service.decrement('order-2', 'sku-4', 999);

    expect(outcome).toMatchObject({ reserved: false });
  });

  it('treats a redelivered orderId as already-handled, not a new decrement', async () => {
    const productUpdateMany = jest.fn();
    const service = buildService({
      processedOrderCreate: jest.fn().mockRejectedValue(new MockPrismaError()),
      productUpdateMany,
    });

    const outcome = await service.decrement('order-1', 'sku-1', 2);

    expect(outcome).toBeUndefined();
    expect(productUpdateMany).not.toHaveBeenCalled();
  });
});
