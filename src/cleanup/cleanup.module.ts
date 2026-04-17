import { Module } from '@nestjs/common';
import { CleanupService } from './cleanup.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [CleanupService],
})
export class CleanupModule {}
