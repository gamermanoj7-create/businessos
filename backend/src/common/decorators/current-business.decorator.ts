import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { TenantContext } from '../types/authenticated-request.interface';

// Extracts the resolved, server-verified tenant context (attached by
// TenantGuard) from the request. Usage: @CurrentBusiness() tenant: TenantContext
// Never derive the business ID from client input directly — always go
// through this, which is only populated after TenantGuard has confirmed
// active membership.
export const CurrentBusiness = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext => {
    const request = ctx.switchToHttp().getRequest<Request & { tenant?: TenantContext }>();
    return request.tenant as TenantContext;
  },
);
