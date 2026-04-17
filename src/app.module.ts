import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerMiddleware } from './logger.middleware';
import { HealthController } from './health.controller';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { SupabaseAuthGuard } from './auth/guards/supabase-auth.guard';
import { AuthModule } from './auth/auth.module';
import { ItemsModule } from './items/items.module';
import { ListsModule } from './lists/lists.module';
import { ReccoModule } from './recco/recco.module';
import { SupabaseModule } from './supabase/supabase.module';
import { SyncModule } from './sync/sync.module';
import { CleanupModule } from './cleanup/cleanup.module';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    SupabaseModule,
    AuthModule,
    ListsModule,
    ItemsModule,
    SyncModule,
    ReccoModule,
    CleanupModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: SupabaseAuthGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
