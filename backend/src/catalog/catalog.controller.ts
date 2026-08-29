import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constant';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
@UseGuards(TenantGuard,PermissionsGuard)
@Controller()
export class CatalogController {
 constructor(private readonly s:CatalogService){}
 @Get('categories') @Permissions(PERMISSIONS.CATEGORY_VIEW) categories(@CurrentBusiness() t:any){return this.s.listCategories(t.businessId)}
 @Post('categories') @Permissions(PERMISSIONS.CATEGORY_CREATE) createCategory(@CurrentBusiness() t:any,@Body() d:any){return this.s.createCategory(t.businessId,d)}
 @Patch('categories/:id') @Permissions(PERMISSIONS.CATEGORY_UPDATE) updateCategory(@CurrentBusiness() t:any,@Param('id') id:string,@Body() d:any){return this.s.updateCategory(t.businessId,id,d)}
 @Delete('categories/:id') @Permissions(PERMISSIONS.CATEGORY_DELETE) deleteCategory(@CurrentBusiness() t:any,@Param('id') id:string){return this.s.deleteCategory(t.businessId,id)}
 @Get('products') @Permissions(PERMISSIONS.PRODUCT_VIEW) products(@CurrentBusiness() t:any,@Query('q') q?:string){return this.s.listProducts(t.businessId,q)}
 @Get('products/:id') @Permissions(PERMISSIONS.PRODUCT_VIEW) product(@CurrentBusiness() t:any,@Param('id') id:string){return this.s.getProduct(t.businessId,id)}
 @Post('products') @Permissions(PERMISSIONS.PRODUCT_CREATE) createProduct(@CurrentBusiness() t:any,@Body() d:any){return this.s.createProduct(t.businessId,d)}
 @Patch('products/:id') @Permissions(PERMISSIONS.PRODUCT_UPDATE) updateProduct(@CurrentBusiness() t:any,@Param('id') id:string,@Body() d:any){return this.s.updateProduct(t.businessId,id,d)}
 @Delete('products/:id') @Permissions(PERMISSIONS.PRODUCT_DELETE) deleteProduct(@CurrentBusiness() t:any,@Param('id') id:string){return this.s.deleteProduct(t.businessId,id)}
}
