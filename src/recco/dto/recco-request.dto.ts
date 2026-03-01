import { IsArray, IsEnum, IsString } from 'class-validator';

export enum CuisineEnum {
  INDIAN = 'Indian',
  CHINESE = 'Chinese',
  ITALIAN = 'Italian',
  MEXICAN = 'Mexican',
  OTHER = 'Other',
}

export enum RecipeModeEnum {
  EXACT = 'exact',
  DETAILED = 'detailed',
}

export class ReccoRequestDto {
  @IsArray()
  @IsString({ each: true })
  selectedItems: string[];

  @IsEnum(CuisineEnum)
  cuisineFilter: CuisineEnum;

  @IsEnum(RecipeModeEnum)
  recipeMode: RecipeModeEnum;
}
