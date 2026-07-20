import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Fixed IDs so k6 scripts and the post-run audit can reference products
// directly. sku-1..3: qty high enough that a 60s/1000rps run cannot sell
// out — keeps the workload mix constant for clean baseline rows.
// sku-4: deliberately tiny — the sellout scenario lever (finite-stock
// failure injection, STRATEGY.md §5) — now surfaces as CANCELLED via the
// v3 reply leg (ARCHITECTURE.md §7.3), not a 409.
const products = [
  { id: 'sku-1', name: 'Case Study Tee', price: 19.99, qty: 1_000_000 },
  { id: 'sku-2', name: 'Case Study Hoodie', price: 39.99, qty: 1_000_000 },
  { id: 'sku-3', name: 'Case Study Cap', price: 14.99, qty: 1_000_000 },
  { id: 'sku-4', name: 'Limited Sticker Pack', price: 4.99, qty: 1_000 },
];

async function main() {
  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: { qty: product.qty },
      create: product,
    });
  }
  console.log(`Seeded ${products.length} products`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
