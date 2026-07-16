import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ReserveStockDto } from './dtos/reserve-stock.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /** 200 = all items reserved; 409 = insufficient stock (nothing decremented). */
  @Post('reserve')
  @HttpCode(200)
  async reserve(@Body() body: ReserveStockDto) {
    await this.productsService.reserve(body.items);
    return { reserved: true };
  }

  /** SKU list — used by the post-run consistency audit (and manual checks). */
  @Get('skus')
  findAllSkus() {
    return this.productsService.findAllSkus();
  }
}
