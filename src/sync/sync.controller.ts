import { Body, Controller, Post } from '@nestjs/common';
import { User } from '../auth/decorators/user.decorator';
import { SyncDto } from './dto/sync.dto';
import { SyncService } from './sync.service';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post()
  sync(@User() user: { id: string }, @Body() dto: SyncDto) {
    return this.syncService.sync(user.id, dto);
  }
}
