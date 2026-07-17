import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module';

@Module({
  imports: [PrismaModule, ProductsModule, RabbitmqModule],
})
export class AppModule {}
