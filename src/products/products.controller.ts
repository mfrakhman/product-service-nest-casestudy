import { Body, Controller, Get, HttpCode, NotFoundException, Param, Post } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { RabbitmqPublisher } from '../rabbitmq/rabbitmq.publisher';
import { RK_PRODUCT_CREATED } from '../rabbitmq/topology';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly publisher: RabbitmqPublisher,
  ) {}

  @Post()
  @HttpCode(201)
  async create(@Body() dto: CreateProductDto) {
    const product = await this.productsService.create(dto);
    // spec-required, no consumer yet (ARCHITECTURE.md §7.5) — published for
    // compliance/extensibility, not load-bearing for any current flow
    await this.publisher.publish(RK_PRODUCT_CREATED, product);
    return product;
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const product = await this.productsService.findById(id);
    if (!product) {
      throw new NotFoundException('product not found');
    }
    return product;
  }
}
