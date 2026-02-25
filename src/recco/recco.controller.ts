import { Body, Controller, Post } from '@nestjs/common';
import { User } from '../auth/decorators/user.decorator';
import { ReccoRequestDto } from './dto/recco-request.dto';
import { ReccoService } from './recco.service';

@Controller('recco')
export class ReccoController {
  constructor(private readonly reccoService: ReccoService) {}

  @Post()
  getRecipes(@User() user: { id: string }, @Body() dto: ReccoRequestDto) {
    return this.reccoService.getRecipes(user.id, dto);
  }
}
