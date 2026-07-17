import { Controller, Get } from '@nestjs/common';
import { ProductsService } from './products.service';

/**
 * v2: reservation moved to the order.created consumer — no HTTP reserve
 * endpoint anymore. Only the audit surface remains.
 */
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /** SKU list — used by the post-run consistency audit (and manual checks). */
  @Get('skus')
  findAllSkus() {
    return this.productsService.findAllSkus();
  }
}
