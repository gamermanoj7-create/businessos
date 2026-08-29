import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BusinessesService } from './businesses.service';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constant';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { TenantContext } from '../common/types/authenticated-request.interface';

// This controller is the reference pattern every future tenant-scoped
// module (products, sales, invoices, ...) should follow:
//   1. JwtAuthGuard authenticates the user
//   2. TenantGuard resolves + verifies X-Business-Id membership
//   3. PermissionsGuard checks the resolved role's permissions
//   4. The handler uses `tenant.businessId` — never a client-supplied ID
@ApiTags('businesses')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Business-Id', required: true, description: 'Active business context' })
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('business')
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Get()
  @Permissions(PERMISSIONS.BUSINESS_VIEW)
  @ApiOperation({ summary: 'Get the current business profile' })
  async getCurrent(@CurrentBusiness() tenant: TenantContext) {
    return this.businessesService.getById(tenant.businessId);
  }

  @Patch()
  @Permissions(PERMISSIONS.BUSINESS_UPDATE)
  @ApiOperation({ summary: 'Update the current business profile' })
  async update(@CurrentBusiness() tenant: TenantContext, @Body() dto: UpdateBusinessDto) {
    return this.businessesService.update(tenant.businessId, dto);
  }
}
