import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

const GRACE_PERIOD_DAYS = 30;

@Injectable()
export class AuthService {
  constructor(private readonly supabase: SupabaseService) {}

  async deleteAccount(userId: string): Promise<void> {
    // Fetch email from Supabase Auth so we can restore by email later
    const { data: authUser } =
      await this.supabase.adminClient.auth.admin.getUserById(userId);

    const email = authUser.user?.email ?? '';

    // Upsert the users row (creates it if this is the first time)
    await this.supabase.client
      .from('users')
      .upsert(
        { userId, email, isDeleted: true, deletedAt: new Date().toISOString() },
        { onConflict: 'userId' },
      );

    // Ban for the grace period so credentials are preserved
    await this.supabase.adminClient.auth.admin.updateUserById(userId, {
      ban_duration: `${GRACE_PERIOD_DAYS * 24}h`,
    });
  }

  async restoreAccount(email: string): Promise<void> {
    const { data: user } = await this.supabase.client
      .from('users')
      .select('userId, deletedAt')
      .eq('email', email)
      .eq('isDeleted', true)
      .single();

    if (!user) {
      throw new NotFoundException('No deleted account found for this email');
    }

    const deletedAt = new Date(user.deletedAt as string);
    const gracePeriodEnd = new Date(
      deletedAt.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
    );

    if (new Date() > gracePeriodEnd) {
      throw new HttpException(
        'Account grace period has expired and cannot be restored',
        HttpStatus.GONE,
      );
    }

    // Lift the ban
    await this.supabase.adminClient.auth.admin.updateUserById(
      user.userId as string,
      { ban_duration: 'none' },
    );

    // Clear the soft-delete
    await this.supabase.client
      .from('users')
      .update({ isDeleted: false, deletedAt: null })
      .eq('userId', user.userId);
  }
}
