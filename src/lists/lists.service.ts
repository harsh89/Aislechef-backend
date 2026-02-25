import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateListDto } from './dto/create-list.dto';
import { UpdateListDto } from './dto/update-list.dto';

@Injectable()
export class ListsService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(userId: string, dto: CreateListDto) {
    const { data, error } = await this.supabase.client
      .from('lists')
      .insert({
        userId,
        name: dto.name,
        lastUpdated: new Date().toISOString(),
        isDeleted: false,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async findAll(userId: string) {
    const { data, error } = await this.supabase.client
      .from('lists')
      .select('*')
      .eq('userId', userId)
      .eq('isDeleted', false)
      .order('createdAt', { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async findOne(userId: string, listId: string, page = 1, limit = 20) {
    const { data: list, error: listError } = await this.supabase.client
      .from('lists')
      .select('*')
      .eq('listId', listId)
      .eq('userId', userId)
      .eq('isDeleted', false)
      .single();

    if (listError ?? !list) throw new NotFoundException('List not found');

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: items, error: itemsError } = await this.supabase.client
      .from('items')
      .select('*')
      .eq('listId', listId)
      .eq('isDeleted', false)
      .order('createdAt', { ascending: false })
      .range(from, to);

    if (itemsError) throw new Error(itemsError.message);
    return { ...list, items: items ?? [] };
  }

  async update(userId: string, listId: string, dto: UpdateListDto) {
    const { data, error } = await this.supabase.client
      .from('lists')
      .update({ name: dto.name, lastUpdated: new Date().toISOString() })
      .eq('listId', listId)
      .eq('userId', userId)
      .eq('isDeleted', false)
      .select()
      .single();

    if (error ?? !data) throw new NotFoundException('List not found');
    return data;
  }

  async softDelete(userId: string, listId: string) {
    const now = new Date().toISOString();

    const { error } = await this.supabase.client
      .from('lists')
      .update({ isDeleted: true, lastUpdated: now })
      .eq('listId', listId)
      .eq('userId', userId);

    if (error) throw new Error(error.message);

    await this.supabase.client
      .from('items')
      .update({ isDeleted: true, lastUpdated: now })
      .eq('listId', listId);
  }

  async searchItems(userId: string, listId: string, q: string) {
    const { data: list } = await this.supabase.client
      .from('lists')
      .select('listId')
      .eq('listId', listId)
      .eq('userId', userId)
      .eq('isDeleted', false)
      .single();

    if (!list) throw new NotFoundException('List not found');

    const { data, error } = await this.supabase.client
      .from('items')
      .select('*')
      .eq('listId', listId)
      .eq('isDeleted', false)
      .ilike('itemName', `%${q}%`);

    if (error) throw new Error(error.message);
    return data ?? [];
  }
}
