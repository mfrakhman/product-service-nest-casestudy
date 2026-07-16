import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ReserveItemDto {
  @IsString()
  @IsNotEmpty()
  skuId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class ReserveStockDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ReserveItemDto)
  items!: ReserveItemDto[];
}
