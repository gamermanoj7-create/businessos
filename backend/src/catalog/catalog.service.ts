import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}
  listCategories(businessId:string){ return this.prisma.category.findMany({where:{businessId},orderBy:{name:'asc'}}); }
  createCategory(businessId:string,d:any){ return this.prisma.category.create({data:{businessId,name:d.name,description:d.description}}); }
  async updateCategory(businessId:string,id:string,d:any){ const x=await this.prisma.category.findFirst({where:{id,businessId}}); if(!x) throw new NotFoundException('Category not found'); return this.prisma.category.update({where:{id},data:{name:d.name,description:d.description,isActive:d.isActive}}); }
  async deleteCategory(businessId:string,id:string){ const x=await this.prisma.category.findFirst({where:{id,businessId}}); if(!x) throw new NotFoundException('Category not found'); return this.prisma.category.update({where:{id},data:{isActive:false}}); }
  listProducts(businessId:string,q?:string){ return this.prisma.product.findMany({where:{businessId,isActive:true,...(q?{OR:[{name:{contains:q,mode:'insensitive'}},{sku:{contains:q,mode:'insensitive'}},{barcode:{contains:q,mode:'insensitive'}}]}:{})},include:{category:true,inventory:true},orderBy:{name:'asc'}}); }
  async getProduct(businessId:string,id:string){ const x=await this.prisma.product.findFirst({where:{id,businessId},include:{category:true,inventory:true}}); if(!x) throw new NotFoundException('Product not found'); return x; }
  async createProduct(businessId:string,d:any){ return this.prisma.$transaction(async tx=>{ const p=await tx.product.create({data:{businessId,categoryId:d.categoryId||null,name:d.name,sku:d.sku||null,barcode:d.barcode||null,description:d.description||null,unit:d.unit||'pcs',purchasePrice:d.purchasePrice??0,sellingPrice:d.sellingPrice??0,taxRate:d.taxRate??0,hsnCode:d.hsnCode||null}}); await tx.inventory.create({data:{businessId,productId:p.id,minStock:d.minStock??0}}); return p; }); }
  async updateProduct(businessId:string,id:string,d:any){ const x=await this.prisma.product.findFirst({where:{id,businessId}}); if(!x) throw new NotFoundException('Product not found'); return this.prisma.product.update({where:{id},data:{categoryId:d.categoryId,name:d.name,sku:d.sku,barcode:d.barcode,description:d.description,unit:d.unit,purchasePrice:d.purchasePrice,sellingPrice:d.sellingPrice,taxRate:d.taxRate,hsnCode:d.hsnCode,isActive:d.isActive}}); }
  async deleteProduct(businessId:string,id:string){ const x=await this.prisma.product.findFirst({where:{id,businessId}}); if(!x) throw new NotFoundException('Product not found'); return this.prisma.product.update({where:{id},data:{isActive:false}}); }
}
