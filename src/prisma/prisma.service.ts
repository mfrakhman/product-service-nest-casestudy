import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL!,
        // node-postgres Pool defaults to max 10 — measured as the prime suspect
        // for the sync throughput ceiling (k6/results/run-4). One-variable
        // experiment: 10 -> 30. Env-tunable for further probing.
        max: Number(process.env.DB_POOL_MAX || 30),
      }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
