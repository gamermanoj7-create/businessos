import { BadRequestException, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { TenantGuard } from './tenant.guard';

function buildContext(headers: Record<string, string>, user?: { id: string; email: string }) {
  const request: Record<string, unknown> = { headers, user };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('TenantGuard', () => {
  let prisma: { businessMember: { findUnique: jest.Mock } };
  let guard: TenantGuard;

  beforeEach(() => {
    prisma = { businessMember: { findUnique: jest.fn() } };
    guard = new TenantGuard(prisma as never);
  });

  it('throws ForbiddenException if no authenticated user is present', async () => {
    const ctx = buildContext({ 'x-business-id': 'biz-1' }, undefined);
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('throws BadRequestException if X-Business-Id header is missing', async () => {
    const ctx = buildContext({}, { id: 'user-1', email: 'a@b.com' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(BadRequestException);
  });

  it('throws ForbiddenException when the user has no membership in that business', async () => {
    prisma.businessMember.findUnique.mockResolvedValue(null);
    const ctx = buildContext({ 'x-business-id': 'biz-B' }, { id: 'user-1', email: 'a@b.com' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when membership exists but is not ACTIVE', async () => {
    prisma.businessMember.findUnique.mockResolvedValue({
      id: 'member-1',
      businessId: 'biz-B',
      roleId: 'role-1',
      status: 'SUSPENDED',
      role: { name: 'STAFF', rolePermissions: [] },
    });
    const ctx = buildContext({ 'x-business-id': 'biz-B' }, { id: 'user-1', email: 'a@b.com' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('CRITICAL: a user belonging to business A cannot access business B by header alone', async () => {
    // Simulates: user-1 is only a member of biz-A, but sends X-Business-Id: biz-B.
    // The lookup is keyed on (userId, businessId) from the header, so it
    // correctly returns null for a business the user does not belong to —
    // this is the core tenant-isolation guarantee under test.
    prisma.businessMember.findUnique.mockImplementation(({ where }) => {
      const { userId, businessId } = where.userId_businessId;
      if (userId === 'user-1' && businessId === 'biz-A') {
        return Promise.resolve({
          id: 'member-1',
          businessId: 'biz-A',
          roleId: 'role-1',
          status: 'ACTIVE',
          role: { name: 'OWNER', rolePermissions: [] },
        });
      }
      return Promise.resolve(null); // biz-B: no membership for user-1
    });

    const forgedCtx = buildContext({ 'x-business-id': 'biz-B' }, { id: 'user-1', email: 'a@b.com' });
    await expect(guard.canActivate(forgedCtx)).rejects.toThrow(ForbiddenException);

    const legitimateCtx = buildContext({ 'x-business-id': 'biz-A' }, { id: 'user-1', email: 'a@b.com' });
    await expect(guard.canActivate(legitimateCtx)).resolves.toBe(true);
  });

  it('populates request.tenant with resolved businessId, role, and flattened permissions', async () => {
    prisma.businessMember.findUnique.mockResolvedValue({
      id: 'member-1',
      businessId: 'biz-A',
      roleId: 'role-owner',
      status: 'ACTIVE',
      role: {
        name: 'OWNER',
        rolePermissions: [
          { permission: { key: 'PRODUCT_CREATE' } },
          { permission: { key: 'PRODUCT_VIEW' } },
        ],
      },
    });

    const request: Record<string, unknown> = {
      headers: { 'x-business-id': 'biz-A' },
      user: { id: 'user-1', email: 'a@b.com' },
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await guard.canActivate(ctx);

    expect(request.tenant).toEqual({
      businessId: 'biz-A',
      membershipId: 'member-1',
      roleId: 'role-owner',
      roleName: 'OWNER',
      permissions: ['PRODUCT_CREATE', 'PRODUCT_VIEW'],
    });
  });
});
