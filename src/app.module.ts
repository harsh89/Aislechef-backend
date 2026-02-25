import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { SupabaseAuthGuard } from './auth/guards/supabase-auth.guard';
import { AuthModule } from './auth/auth.module';
import { ItemsModule } from './items/items.module';
import { ListsModule } from './lists/lists.module';
import { ReccoModule } from './recco/recco.module';
import { SupabaseModule } from './supabase/supabase.module';
import { SyncModule } from './sync/sync.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
    AuthModule,
    ListsModule,
    ItemsModule,
    SyncModule,
    ReccoModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: SupabaseAuthGuard,
    },
  ],
})
export class AppModule {}
