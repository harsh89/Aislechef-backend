import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateListDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;
}
