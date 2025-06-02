import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY } from '../roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.get<string[]>(ROLES_KEY, context.getHandler());
    if (!roles) return true; // No roles required

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as any;
    if (!user || !user.role) throw new ForbiddenException('No user role found');

    if (roles.includes(user.role)) {
      return true;
    }
    throw new ForbiddenException('Insufficient role');
  }
} 