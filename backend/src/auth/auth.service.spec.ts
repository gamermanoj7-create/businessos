import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import { AuditService } from '../audit/audit.service';
import * as passwordUtil from '../common/utils/password.util';
import * as tokenHashUtil from '../common/utils/token-hash.util';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock };
    business: { create: jest.Mock };
    businessMember: { create: jest.Mock };
    session: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
  };
  let jwt: { signAsync: jest.Mock; verify: jest.Mock };
  let rolesService: { seedDefaultRoles: jest.Mock };
  let auditService: { record: jest.Mock };

  const meta = { ipAddress: '127.0.0.1', userAgent: 'jest' };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), create: jest.fn() },
      business: { create: jest.fn() },
      businessMember: { create: jest.fn() },
      session: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      $transaction: jest.fn(),
    };
    jwt = { signAsync: jest.fn(), verify: jest.fn() };
    rolesService = { seedDefaultRoles: jest.fn() };
    auditService = { record: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              ({
                'jwt.accessSecret': 'access-secret',
                'jwt.refreshSecret': 'refresh-secret',
                'jwt.accessExpiresIn': '15m',
                'jwt.refreshExpiresIn': '30d',
              })[key],
          },
        },
        { provide: RolesService, useValue: rolesService },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
    jwt.signAsync.mockResolvedValue('signed.jwt.token');
    prisma.session.create.mockResolvedValue({ id: 'session-1' });
  });

  afterEach(() => jest.restoreAllMocks());

  describe('register', () => {
    it('rejects registration when the email is already taken', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

      await expect(
        service.register(
          {
            ownerName: 'Jane',
            email: 'jane@example.com',
            password: 'S3curePass!23',
            businessName: 'Store',
          },
          meta,
        ),
      ).rejects.toThrow(ConflictException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('creates user, business, roles, and OWNER membership in one transaction', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      jest.spyOn(passwordUtil, 'hashPassword').mockResolvedValue('hashed-password');

      const fakeUser = { id: 'user-1', name: 'Jane', email: 'jane@example.com' };
      const fakeBusiness = { id: 'biz-1', name: 'Store' };
      rolesService.seedDefaultRoles.mockResolvedValue({
        OWNER: 'role-owner',
        ADMIN: 'role-admin',
        MANAGER: 'role-manager',
        STAFF: 'role-staff',
        ACCOUNTANT: 'role-accountant',
      });

      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          user: { create: jest.fn().mockResolvedValue(fakeUser) },
          business: { create: jest.fn().mockResolvedValue(fakeBusiness) },
          businessMember: { create: jest.fn().mockResolvedValue({ id: 'member-1' }) },
        };
        return fn(tx);
      });

      const result = await service.register(
        {
          ownerName: 'Jane',
          email: 'jane@example.com',
          password: 'S3curePass!23',
          businessName: 'Store',
        },
        meta,
      );

      expect(result.user.email).toEqual('jane@example.com');
      expect(result.business?.role).toEqual('OWNER');
      expect(rolesService.seedDefaultRoles).toHaveBeenCalledWith(expect.anything(), 'biz-1');
      expect(prisma.session.create).toHaveBeenCalled(); // tokens were issued
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException for an unknown email without revealing existence', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      jest.spyOn(passwordUtil, 'verifyPassword').mockResolvedValue(false);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'whatever' }, meta),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for a wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'jane@example.com',
        name: 'Jane',
        passwordHash: 'hashed',
        isActive: true,
      });
      jest.spyOn(passwordUtil, 'verifyPassword').mockResolvedValue(false);

      await expect(
        service.login({ email: 'jane@example.com', password: 'wrong' }, meta),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for an inactive (deactivated) user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'jane@example.com',
        name: 'Jane',
        passwordHash: 'hashed',
        isActive: false,
      });
      jest.spyOn(passwordUtil, 'verifyPassword').mockResolvedValue(true);

      await expect(
        service.login({ email: 'jane@example.com', password: 'S3curePass!23' }, meta),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('succeeds and issues tokens for correct, active-user credentials', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'jane@example.com',
        name: 'Jane',
        passwordHash: 'hashed',
        isActive: true,
      });
      jest.spyOn(passwordUtil, 'verifyPassword').mockResolvedValue(true);

      const result = await service.login(
        { email: 'jane@example.com', password: 'S3curePass!23' },
        meta,
      );

      expect(result.accessToken).toEqual('signed.jwt.token');
      expect(result.refreshToken).toEqual('signed.jwt.token');
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.login' }),
      );
    });
  });

  describe('refresh', () => {
    it('rejects a refresh token that fails JWT verification', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      await expect(service.refresh('bad.token', meta)).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a refresh token with no matching session (e.g. already rotated out)', async () => {
      jwt.verify.mockReturnValue({ sub: 'user-1' });
      prisma.session.findUnique.mockResolvedValue(null);

      await expect(service.refresh('valid.but.orphaned', meta)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a revoked session (reuse-detection path)', async () => {
      jwt.verify.mockReturnValue({ sub: 'user-1' });
      prisma.session.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        isRevoked: true,
        expiresAt: new Date(Date.now() + 100000),
      });

      await expect(service.refresh('reused.token', meta)).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an expired session even if not explicitly revoked', async () => {
      jwt.verify.mockReturnValue({ sub: 'user-1' });
      prisma.session.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        isRevoked: false,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.refresh('expired.token', meta)).rejects.toThrow(UnauthorizedException);
    });

    it('rotates: issues new tokens and revokes the presented session', async () => {
      jwt.verify.mockReturnValue({ sub: 'user-1' });
      prisma.session.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 100000),
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'jane@example.com',
        name: 'Jane',
        isActive: true,
      });

      const result = await service.refresh('valid.token', meta);

      expect(result.accessToken).toEqual('signed.jwt.token');
      expect(prisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: expect.objectContaining({ isRevoked: true }),
      });
    });
  });

  describe('logout', () => {
    it('only revokes a session that belongs to the calling user', async () => {
      prisma.session.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'someone-else',
        isRevoked: false,
      });

      await service.logout('user-1', 'their-token');

      expect(prisma.session.update).not.toHaveBeenCalled();
    });

    it('revokes the session when it belongs to the caller', async () => {
      prisma.session.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        isRevoked: false,
      });

      await service.logout('user-1', 'my-token');

      expect(prisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: expect.objectContaining({ isRevoked: true }),
      });
    });
  });
});
