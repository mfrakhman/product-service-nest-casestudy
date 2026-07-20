import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { RabbitmqPublisherModule } from '../rabbitmq/rabbitmq-publisher.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RabbitmqPublisherModule, RedisModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
