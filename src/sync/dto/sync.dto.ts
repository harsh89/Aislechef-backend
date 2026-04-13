import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UnitEnum } from '../../items/dto/create-item.dto';

export class SyncListDto {
  @IsString()
  listId: string;

  @IsString()
  name: string;

  @IsString()
  lastUpdated: string;

  @IsBoolean()
  isDeleted: boolean;
}

export class SyncItemDto {
  @IsString()
  itemId: string;

  @IsString()
  listId: string;

  @IsString()
  itemName: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsEnum(UnitEnum)
  unit: UnitEnum;

  @IsString()
  lastUpdated: string;

  @IsBoolean()
  isDeleted: boolean;

  @IsBoolean()
  isCompleted: boolean;
}

export class SyncDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncListDto)
  lists: SyncListDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncItemDto)
  items: SyncItemDto[];
}
