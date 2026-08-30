import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constant';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { TenantContext } from '../common/types/authenticated-request.interface';

@ApiTags('users')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Business-Id', required: true })
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Permissions(PERMISSIONS.USER_VIEW)
  @ApiOperation({ summary: 'List members of the current business' })
  async list(@CurrentBusiness() tenant: TenantContext) {
    return this.usersService.listBusinessMembers(tenant.businessId);
  }
}
