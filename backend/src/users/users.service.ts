import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // Lists members of ONE business (scoped by tenant.businessId from
  // TenantGuard) — never a global user listing, which would leak users
  // across tenants.
  async listBusinessMembers(businessId: string) {
    const members = await this.prisma.businessMember.findMany({
      where: { businessId, status: 'ACTIVE' },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, isActive: true } },
        role: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return members.map((m) => ({
      membershipId: m.id,
      user: m.user,
      role: m.role,
      status: m.status,
      joinedAt: m.createdAt,
    }));
  }
}
