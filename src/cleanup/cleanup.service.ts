import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';

const GRACE_PERIOD_DAYS = 30;

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private readonly supabase: SupabaseService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async purgeExpiredAccounts(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - GRACE_PERIOD_DAYS);

    const { data: expiredUsers } = await this.supabase.client
      .from('users')
      .select('userId')
      .eq('isDeleted', true)
      .lt('deletedAt', cutoff.toISOString());

    if (!expiredUsers?.length) return;

    const userIds = expiredUsers.map((u) => u.userId as string);
    this.logger.log(`Purging ${userIds.length} expired account(s)`);

    for (const userId of userIds) {
      try {
        // Get all lists for this user so we can cascade-delete items
        const { data: lists } = await this.supabase.client
          .from('lists')
          .select('listId')
          .eq('userId', userId);

        if (lists?.length) {
          const listIds = lists.map((l) => l.listId as string);
          await this.supabase.client.from('items').delete().in('listId', listIds);
          await this.supabase.client.from('lists').delete().eq('userId', userId);
        }

        await this.supabase.client.from('users').delete().eq('userId', userId);
        await this.supabase.adminClient.auth.admin.deleteUser(userId);

        this.logger.log(`Purged account: ${userId}`);
      } catch (err) {
        this.logger.error(`Failed to purge account ${userId}`, err);
      }
    }
  }
}
