import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { UnitEnum } from './create-item.dto';

export class UpdateItemDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  itemName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsEnum(UnitEnum)
  unit?: UnitEnum;

  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;
}
