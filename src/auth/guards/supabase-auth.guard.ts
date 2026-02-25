import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }

    const token = authHeader.slice(7);
    const { data, error } = await this.supabase.client.auth.getUser(token);

    if (error ?? !data.user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    (request as Request & { user: unknown }).user = data.user;
    return true;
  }
}
