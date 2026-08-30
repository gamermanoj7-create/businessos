import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PermissionKey } from '../constants/permissions.constant';
import { TenantContext } from '../types/authenticated-request.interface';

// Enforces @Permissions(...) metadata against the TenantContext resolved by
// TenantGuard. Must run AFTER TenantGuard (needs `request.tenant`).
//
// Order in @UseGuards should always be:
//   @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionKey[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { tenant?: TenantContext }>();
    const tenant = request.tenant;

    if (!tenant) {
      throw new ForbiddenException('Business context is required for this action.');
    }

    const hasAll = required.every((perm) => tenant.permissions.includes(perm));
    if (!hasAll) {
      throw new ForbiddenException('You do not have permission to perform this action.');
    }

    return true;
  }
}
