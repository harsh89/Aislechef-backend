import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { User } from '../auth/decorators/user.decorator';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ItemsService } from './items.service';

@Controller('lists/:listId/items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Post()
  create(
    @User() user: { id: string },
    @Param('listId') listId: string,
    @Body() dto: CreateItemDto,
  ) {
    return this.itemsService.create(user.id, listId, dto);
  }

  @Put(':itemId')
  update(
    @User() user: { id: string },
    @Param('listId') listId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.itemsService.update(user.id, listId, itemId, dto);
  }

  @Delete(':itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  softDelete(
    @User() user: { id: string },
    @Param('listId') listId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.itemsService.softDelete(user.id, listId, itemId);
  }
}
