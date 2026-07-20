import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { RabbitmqConsumer } from './rabbitmq.consumer';
import { RabbitmqPublisherModule } from './rabbitmq-publisher.module';

@Module({
  imports: [ProductsModule, RabbitmqPublisherModule],
  providers: [RabbitmqConsumer],
})
export class RabbitmqModule {}
