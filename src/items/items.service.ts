import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';

@Injectable()
export class ItemsService {
  constructor(private readonly supabase: SupabaseService) {}

  private async verifyListOwnership(
    userId: string,
    listId: string,
  ): Promise<void> {
    const { data } = await this.supabase.client
      .from('lists')
      .select('listId')
      .eq('listId', listId)
      .eq('userId', userId)
      .eq('isDeleted', false)
      .single();

    if (!data) throw new NotFoundException('List not found');
  }

  async create(userId: string, listId: string, dto: CreateItemDto) {
    await this.verifyListOwnership(userId, listId);

    const trimmedName = dto.itemName.trim();

    console.log('Checking for existing item with name:', trimmedName);

    const { data: existing } = await this.supabase.client
      .from('items')
      .select('itemId, quantity, unit')
      .eq('listId', listId)
      .ilike('itemName', trimmedName)
      .eq('isDeleted', false)
      .maybeSingle();

    if (existing) {
      const { data, error } = await this.supabase.client
        .from('items')
        .update({
          quantity: existing.quantity + dto.quantity,
          lastUpdated: new Date().toISOString(),
        })
        .eq('itemId', existing.itemId)
        .select()
        .single();

      if (error ?? !data) throw new NotFoundException('Item not found');
      return data;
    }

    const { data, error } = await this.supabase.client
      .from('items')
      .insert({
        listId,
        itemName: trimmedName,
        quantity: dto.quantity,
        unit: dto.unit,
        lastUpdated: new Date().toISOString(),
        isDeleted: false,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async update(
    userId: string,
    listId: string,
    itemId: string,
    dto: UpdateItemDto,
  ) {
    await this.verifyListOwnership(userId, listId);

    const { data, error } = await this.supabase.client
      .from('items')
      .update({ ...dto, lastUpdated: new Date().toISOString() })
      .eq('itemId', itemId)
      .eq('listId', listId)
      .eq('isDeleted', false)
      .select()
      .single();

    if (error ?? !data) throw new NotFoundException('Item not found');
    return data;
  }

  async softDelete(
    userId: string,
    listId: string,
    itemId: string,
  ): Promise<void> {
    await this.verifyListOwnership(userId, listId);

    const { error } = await this.supabase.client
      .from('items')
      .update({ isDeleted: true, lastUpdated: new Date().toISOString() })
      .eq('itemId', itemId)
      .eq('listId', listId);

    if (error) throw new Error(error.message);
  }
}
