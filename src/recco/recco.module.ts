import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { ReccoController } from './recco.controller';
import { ReccoService } from './recco.service';

@Module({
  controllers: [ReccoController],
  providers: [
    ReccoService,
    {
      provide: 'ANTHROPIC_CLIENT',
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Anthropic({ apiKey: config.get<string>('ANTHROPIC_API_KEY') }),
    },
    {
      provide: 'OPENAI_CLIENT',
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new OpenAI({ apiKey: config.get<string>('OPENAI_API_KEY') }),
    },
  ],
})
export class ReccoModule {}
