import {Body,Controller,Get,Post,UseGuards} from '@nestjs/common'; import {CommerceService} from './commerce.service'; import {CurrentBusiness} from '../common/decorators/current-business.decorator'; import {Permissions} from '../common/decorators/permissions.decorator'; import {PERMISSIONS} from '../common/constants/permissions.constant'; import {TenantGuard} from '../common/guards/tenant.guard'; import {PermissionsGuard} from '../common/guards/permissions.guard';
@UseGuards(TenantGuard,PermissionsGuard) @Controller() export class CommerceController{constructor(private readonly s:CommerceService){}
@Post('purchases')@Permissions(PERMISSIONS.INVENTORY_UPDATE)purchase(@CurrentBusiness()t:any,@Body()d:any){return this.s.createPurchase(t.businessId,d)}
@Post('sales')@Permissions(PERMISSIONS.SALE_CREATE)sale(@CurrentBusiness()t:any,@Body()d:any){return this.s.createSale(t.businessId,d)}
@Get('sales')@Permissions(PERMISSIONS.SALE_VIEW)sales(@CurrentBusiness()t:any){return this.s.listSales(t.businessId)}
@Get('invoices')@Permissions(PERMISSIONS.INVOICE_VIEW)invoices(@CurrentBusiness()t:any){return this.s.listInvoices(t.businessId)}
@Post('payments')@Permissions(PERMISSIONS.PAYMENT_CREATE)payment(@CurrentBusiness()t:any,@Body()d:any){return this.s.addPayment(t.businessId,d)}
}
