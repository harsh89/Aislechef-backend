import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { User } from '../auth/decorators/user.decorator';
import { CreateListDto } from './dto/create-list.dto';
import { UpdateListDto } from './dto/update-list.dto';
import { ListsService } from './lists.service';

@Controller('lists')
export class ListsController {
  constructor(private readonly listsService: ListsService) {}

  @Post()
  create(@User() user: { id: string }, @Body() dto: CreateListDto) {
    return this.listsService.create(user.id, dto);
  }

  @Get()
  findAll(@User() user: { id: string }) {
    return this.listsService.findAll(user.id);
  }

  // search must come before :listId to avoid shadowing
  @Get(':listId/search')
  search(
    @User() user: { id: string },
    @Param('listId') listId: string,
    @Query('q') q = '',
  ) {
    return this.listsService.searchItems(user.id, listId, q);
  }

  @Get(':listId')
  findOne(
    @User() user: { id: string },
    @Param('listId') listId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.listsService.findOne(user.id, listId, +page, +limit);
  }

  @Put(':listId')
  update(
    @User() user: { id: string },
    @Param('listId') listId: string,
    @Body() dto: UpdateListDto,
  ) {
    return this.listsService.update(user.id, listId, dto);
  }

  @Delete(':listId')
  @HttpCode(HttpStatus.NO_CONTENT)
  softDelete(@User() user: { id: string }, @Param('listId') listId: string) {
    return this.listsService.softDelete(user.id, listId);
  }
}
