import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ReccoController } from './recco.controller';
import { ReccoService } from './recco.service';

@Module({
  controllers: [ReccoController],
  providers: [
    ReccoService,
    {
      provide: 'OPENAI_CLIENT',
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new OpenAI({ apiKey: config.get<string>('OPENAI_API_KEY') }),
    },
  ],
})
export class ReccoModule {}
