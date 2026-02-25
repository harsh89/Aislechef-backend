import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export enum UnitEnum {
  PCS = 'pcs',
  KG = 'kg',
  G = 'g',
  L = 'L',
  ML = 'mL',
  TBSP = 'tbsp',
  TSP = 'tsp',
  CUP = 'cup',
}

export class CreateItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  itemName: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsEnum(UnitEnum)
  unit: UnitEnum;
}
