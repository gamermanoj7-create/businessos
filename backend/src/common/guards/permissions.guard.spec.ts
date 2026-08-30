import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { PERMISSIONS } from '../constants/permissions.constant';

function buildContext(tenant: { permissions: string[] } | undefined): ExecutionContext {
  const request = { tenant };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  it('allows the request when no @Permissions() metadata is present', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    expect(guard.canActivate(buildContext(undefined))).toBe(true);
  });

  it('throws ForbiddenException if tenant context is missing entirely', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([PERMISSIONS.PRODUCT_CREATE]),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    expect(() => guard.canActivate(buildContext(undefined))).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when the role lacks the required permission', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([PERMISSIONS.PRODUCT_CREATE]),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    expect(() =>
      guard.canActivate(buildContext({ permissions: [PERMISSIONS.PRODUCT_VIEW] })),
    ).toThrow(ForbiddenException);
  });

  it('allows the request when the role has all required permissions', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue([PERMISSIONS.PRODUCT_CREATE, PERMISSIONS.PRODUCT_VIEW]),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    expect(
      guard.canActivate(
        buildContext({ permissions: [PERMISSIONS.PRODUCT_CREATE, PERMISSIONS.PRODUCT_VIEW] }),
      ),
    ).toBe(true);
  });
});
