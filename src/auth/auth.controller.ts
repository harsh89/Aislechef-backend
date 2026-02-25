import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RestoreAccountDto } from './dto/restore-account.dto';
import { Public } from './decorators/public.decorator';
import { User } from './decorators/user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Delete('account')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(@User() user: { id: string }): Promise<void> {
    await this.authService.deleteAccount(user.id);
  }

  @Public()
  @Post('restore')
  @HttpCode(HttpStatus.NO_CONTENT)
  async restoreAccount(@Body() dto: RestoreAccountDto): Promise<void> {
    await this.authService.restoreAccount(dto.email);
  }
}
