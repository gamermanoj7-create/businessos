import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateBusinessDto } from './dto/update-business.dto';

@Injectable()
export class BusinessesService {
  constructor(private readonly prisma: PrismaService) {}

  // `businessId` here always comes from TenantContext (resolved server-side
  // by TenantGuard), never from a client-supplied path/body parameter.
  async getById(businessId: string) {
    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) {
      throw new NotFoundException('Business not found.');
    }
    return business;
  }

  async update(businessId: string, dto: UpdateBusinessDto) {
    await this.getById(businessId); // 404s cleanly if somehow missing
    return this.prisma.business.update({ where: { id: businessId }, data: dto });
  }
}
