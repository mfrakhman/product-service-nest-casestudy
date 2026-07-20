import { Module } from '@nestjs/common';
import { RabbitmqPublisher } from './rabbitmq.publisher';

// Split from RabbitmqModule so ProductsModule (which needs to publish
// product.created straight from the controller) doesn't have to import the
// consumer wiring too — RabbitmqModule already depends on ProductsModule for
// the order.created consumer, so the reverse import would cycle.
@Module({
  providers: [RabbitmqPublisher],
  exports: [RabbitmqPublisher],
})
export class RabbitmqPublisherModule {}
