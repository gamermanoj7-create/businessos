import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser, TenantContext } from '../types/authenticated-request.interface';

// Resolves which business the current request applies to, and proves —
// against the database, every single time — that the authenticated user
// is an ACTIVE member of it.
//
// SECURITY NOTE: this guard is the load-bearing wall of tenant isolation.
// It deliberately IGNORES any businessId present in the request body; the
// only source of truth for "which business" is the X-Business-Id header,
// cross-checked against BusinessMember. A businessId supplied in a POST
// body can never be used to widen access — controllers/services must
// always use `tenant.businessId` from this guard, never `dto.businessId`,
// when scoping or writing data.
//
// Must run AFTER JwtAuthGuard (it needs `request.user` to already be set).
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { tenant?: TenantContext }>();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user) {
      // JwtAuthGuard should have populated this already; if not, fail closed.
      throw new ForbiddenException('Authentication required.');
    }

    const businessId = request.headers['x-business-id'];
    if (!businessId || typeof businessId !== 'string') {
      throw new BadRequestException(
        'Missing X-Business-Id header. Specify which business this request applies to.',
      );
    }

    const membership = await this.prisma.businessMember.findUnique({
      where: { userId_businessId: { userId: user.id, businessId } },
      include: {
        role: {
          include: {
            rolePermissions: { include: { permission: true } },
          },
        },
      },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      // Same error whether the business doesn't exist, the user was never a
      // member, or membership was revoked — do not reveal which case it is.
      throw new ForbiddenException('You do not have access to this business.');
    }

    request.tenant = {
      businessId: membership.businessId,
      membershipId: membership.id,
      roleId: membership.roleId,
      roleName: membership.role.name,
      permissions: membership.role.rolePermissions.map((rp) => rp.permission.key),
    };

    return true;
  }
}
