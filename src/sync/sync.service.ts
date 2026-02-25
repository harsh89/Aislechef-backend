import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SyncDto, SyncItemDto, SyncListDto } from './dto/sync.dto';

export interface SyncConflict {
  type: 'list' | 'item';
  id: string;
  reason: string;
}

@Injectable()
export class SyncService {
  constructor(private readonly supabase: SupabaseService) {}

  async sync(
    userId: string,
    dto: SyncDto,
  ): Promise<{ conflicts: SyncConflict[] }> {
    const conflicts: SyncConflict[] = [];

    for (const list of dto.lists) {
      const conflict = await this.syncList(userId, list);
      if (conflict) conflicts.push(conflict);
    }

    for (const item of dto.items) {
      const conflict = await this.syncItem(item);
      if (conflict) conflicts.push(conflict);
    }

    return { conflicts };
  }

  private async syncList(
    userId: string,
    list: SyncListDto,
  ): Promise<SyncConflict | null> {
    const { data: existing } = await this.supabase.client
      .from('lists')
      .select('listId, lastUpdated')
      .eq('listId', list.listId)
      .single();

    if (existing) {
      if (
        new Date(list.lastUpdated) > new Date(existing.lastUpdated as string)
      ) {
        await this.supabase.client
          .from('lists')
          .update({
            name: list.name,
            isDeleted: list.isDeleted,
            lastUpdated: list.lastUpdated,
          })
          .eq('listId', list.listId);
        return null;
      }
      return {
        type: 'list',
        id: list.listId,
        reason: 'Server has a newer version',
      };
    }

    await this.supabase.client.from('lists').insert({
      listId: list.listId,
      userId,
      name: list.name,
      isDeleted: list.isDeleted,
      lastUpdated: list.lastUpdated,
    });
    return null;
  }

  private async syncItem(item: SyncItemDto): Promise<SyncConflict | null> {
    const { data: existing } = await this.supabase.client
      .from('items')
      .select('itemId, lastUpdated')
      .eq('itemId', item.itemId)
      .single();

    if (existing) {
      if (
        new Date(item.lastUpdated) > new Date(existing.lastUpdated as string)
      ) {
        await this.supabase.client
          .from('items')
          .update({
            itemName: item.itemName,
            quantity: item.quantity,
            unit: item.unit,
            isDeleted: item.isDeleted,
            lastUpdated: item.lastUpdated,
          })
          .eq('itemId', item.itemId);
        return null;
      }
      return {
        type: 'item',
        id: item.itemId,
        reason: 'Server has a newer version',
      };
    }

    await this.supabase.client.from('items').insert({
      itemId: item.itemId,
      listId: item.listId,
      itemName: item.itemName,
      quantity: item.quantity,
      unit: item.unit,
      isDeleted: item.isDeleted,
      lastUpdated: item.lastUpdated,
    });
    return null;
  }
}
