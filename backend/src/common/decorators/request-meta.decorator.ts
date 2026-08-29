import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

// Pulls best-effort client IP and user-agent for audit logging purposes
// only. Never used for security decisions (IPs are trivially spoofable
// without a trusted proxy chain) — access control always goes through
// JwtAuthGuard/TenantGuard/PermissionsGuard instead.
export const ReqMeta = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestMeta => {
  const request = ctx.switchToHttp().getRequest<Request>();
  const forwardedFor = request.headers['x-forwarded-for'];
  const ipAddress = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : (forwardedFor?.split(',')[0]?.trim() ?? request.socket.remoteAddress);

  return {
    ipAddress: ipAddress ?? undefined,
    userAgent: request.headers['user-agent'],
  };
});
