import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import { AuditService } from '../audit/audit.service';
import { hashPassword, verifyPassword } from '../common/utils/password.util';
import { hashToken } from '../common/utils/token-hash.util';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { RequestMeta } from '../common/decorators/request-meta.decorator';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly rolesService: RolesService,
    private readonly audit: AuditService,
  ) {}

  async register(dto: RegisterDto, meta: RequestMeta): Promise<AuthResponseDto> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      // Deliberately generic — do not reveal whether the email exists via a
      // different message than any other validation failure would produce.
      throw new ConflictException('An account with this email already exists.');
    }

    const passwordHash = await hashPassword(dto.password);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: dto.ownerName,
          email: dto.email,
          phone: dto.phone,
          passwordHash,
        },
      });

      const business = await tx.business.create({
        data: { name: dto.businessName },
      });

      const roleIdByName = await this.rolesService.seedDefaultRoles(tx, business.id);

      const membership = await tx.businessMember.create({
        data: {
          userId: user.id,
          businessId: business.id,
          roleId: roleIdByName.OWNER,
          status: 'ACTIVE',
        },
      });

      await this.audit.record(
        {
          action: 'auth.register',
          userId: user.id,
          businessId: business.id,
          entity: 'Business',
          entityId: business.id,
          metadata: { membershipId: membership.id },
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
        tx,
      );

      return { user, business };
    });

    const tokens = await this.issueTokens(result.user.id, result.user.email, meta);

    return {
      ...tokens,
      user: { id: result.user.id, name: result.user.name, email: result.user.email },
      business: { id: result.business.id, name: result.business.name, role: 'OWNER' },
    };
  }

  async login(dto: LoginDto, meta: RequestMeta): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // Constant-shape response regardless of which check fails, to avoid
    // leaking account existence via timing or message differences. We still
    // run verifyPassword against a dummy hash when the user doesn't exist,
    // so response timing does not reveal whether the email is registered.
    const passwordHash =
      user?.passwordHash ??
      '$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const passwordValid = await verifyPassword(passwordHash, dto.password);

    if (!user || !user.isActive || !passwordValid) {
      await this.audit.record({
        action: 'auth.login_failed',
        userId: user?.id,
        metadata: { email: dto.email },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException('Invalid email or password.');
    }

    const tokens = await this.issueTokens(user.id, user.email, meta);

    await this.audit.record({
      action: 'auth.login',
      userId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      ...tokens,
      user: { id: user.id, name: user.name, email: user.email },
    };
  }

  async refresh(rawRefreshToken: string, meta: RequestMeta): Promise<AuthResponseDto> {
    let payload: { sub: string };
    try {
      payload = this.jwt.verify(rawRefreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    const tokenHash = hashToken(rawRefreshToken);
    const session = await this.prisma.session.findUnique({ where: { refreshTokenHash: tokenHash } });

    if (!session || session.isRevoked || session.expiresAt < new Date() || session.userId !== payload.sub) {
      // Reused/rotated-out or forged token — treat as a possible token-theft
      // signal, not just a bad token.
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account is inactive or no longer exists.');
    }

    // Rotation: revoke the presented session, issue a brand new one. If this
    // exact refresh token is ever presented again, it will already be
    // isRevoked and rejected above — this detects refresh-token reuse.
    const tokens = await this.issueTokens(user.id, user.email, meta);

    await this.prisma.session.update({
      where: { id: session.id },
      data: { isRevoked: true, revokedAt: new Date() },
    });

    await this.audit.record({
      action: 'auth.refresh',
      userId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      ...tokens,
      user: { id: user.id, name: user.name, email: user.email },
    };
  }

  async logout(userId: string, rawRefreshToken: string): Promise<void> {
    const tokenHash = hashToken(rawRefreshToken);
    const session = await this.prisma.session.findUnique({ where: { refreshTokenHash: tokenHash } });

    // Only revoke if it actually belongs to the caller — a user should never
    // be able to revoke someone else's session by guessing/submitting a
    // different token.
    if (session && session.userId === userId && !session.isRevoked) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { isRevoked: true, revokedAt: new Date() },
      });
    }

    await this.audit.record({ action: 'auth.logout', userId });
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
        memberships: {
          where: { status: 'ACTIVE' },
          select: {
            businessId: true,
            role: { select: { name: true } },
            business: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Account no longer exists.');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      isActive: user.isActive,
      createdAt: user.createdAt,
      businesses: user.memberships.map((m) => ({
        id: m.business.id,
        name: m.business.name,
        role: m.role.name,
      })),
    };
  }

  private async issueTokens(
    userId: string,
    email: string,
    meta: RequestMeta,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: string }> {
    const accessExpiresIn = this.config.get<string>('jwt.accessExpiresIn') as string;
    const refreshExpiresIn = this.config.get<string>('jwt.refreshExpiresIn') as string;

    const accessToken = await this.jwt.signAsync(
      { sub: userId, email },
      { secret: this.config.get<string>('jwt.accessSecret'), expiresIn: accessExpiresIn },
    );

    const refreshToken = await this.jwt.signAsync(
      { sub: userId, jti: randomUUID() },
      { secret: this.config.get<string>('jwt.refreshSecret'), expiresIn: refreshExpiresIn },
    );

    await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt: addDuration(new Date(), refreshExpiresIn),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    return { accessToken, refreshToken, expiresIn: accessExpiresIn };
  }
}

// Minimal duration parser for strings like "15m", "30d", "1h" — avoids
// pulling in a heavier date library just for session expiry bookkeeping.
function addDuration(base: Date, duration: string): Date {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(duration.trim());
  if (!match) {
    // Fall back to 30 days if misconfigured, rather than crashing auth.
    return new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);
  }
  const value = parseInt(match[1], 10);
  const unitMs: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return new Date(base.getTime() + value * unitMs[match[2]]);
}
