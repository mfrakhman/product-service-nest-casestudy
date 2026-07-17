import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { RabbitmqConsumer } from './rabbitmq.consumer';
import { RabbitmqPublisher } from './rabbitmq.publisher';

@Module({
  imports: [ProductsModule],
  providers: [RabbitmqPublisher, RabbitmqConsumer],
})
export class RabbitmqModule {}
