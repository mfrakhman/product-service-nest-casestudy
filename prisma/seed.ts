import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Fixed IDs so k6 scripts and the post-run audit can reference SKUs directly.
// sku-1..3: stock high enough that a 60s/1000rps run cannot sell out —
// keeps the workload mix constant for clean baseline rows.
// sku-4: deliberately tiny — the sellout/409-contention scenario lever
// (finite-stock failure injection, STRATEGY.md §5).
const skus = [
  { id: 'sku-1', name: 'Case Study Tee', stock: 1_000_000 },
  { id: 'sku-2', name: 'Case Study Hoodie', stock: 1_000_000 },
  { id: 'sku-3', name: 'Case Study Cap', stock: 1_000_000 },
  { id: 'sku-4', name: 'Limited Sticker Pack', stock: 1_000 },
];

async function main() {
  for (const sku of skus) {
    await prisma.sku.upsert({
      where: { id: sku.id },
      update: { stock: sku.stock },
      create: sku,
    });
  }
  console.log(`Seeded ${skus.length} SKUs`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
