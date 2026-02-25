import { IsEmail } from 'class-validator';

export class RestoreAccountDto {
  @IsEmail()
  email: string;
}
