import { Injectable,NotFoundException } from '@nestjs/common'; import { PrismaService } from '../prisma/prisma.service';
@Injectable() export class ContactsService{constructor(private readonly prisma:PrismaService){}
 listCustomers(b:string){return this.prisma.customer.findMany({where:{businessId:b},orderBy:{name:'asc'}})}
 createCustomer(b:string,d:any){return this.prisma.customer.create({data:{businessId:b,name:d.name,phone:d.phone,email:d.email,address:d.address,gstNumber:d.gstNumber,openingBalance:d.openingBalance??0,creditLimit:d.creditLimit??0}})}
 async updateCustomer(b:string,id:string,d:any){const x=await this.prisma.customer.findFirst({where:{id,businessId:b}});if(!x)throw new NotFoundException('Customer not found');return this.prisma.customer.update({where:{id},data:{name:d.name,phone:d.phone,email:d.email,address:d.address,gstNumber:d.gstNumber,openingBalance:d.openingBalance,creditLimit:d.creditLimit}})}
 listSuppliers(b:string){return this.prisma.supplier.findMany({where:{businessId:b},orderBy:{name:'asc'}})}
 createSupplier(b:string,d:any){return this.prisma.supplier.create({data:{businessId:b,name:d.name,phone:d.phone,email:d.email,address:d.address,gstNumber:d.gstNumber,openingBalance:d.openingBalance??0}})}
 async updateSupplier(b:string,id:string,d:any){const x=await this.prisma.supplier.findFirst({where:{id,businessId:b}});if(!x)throw new NotFoundException('Supplier not found');return this.prisma.supplier.update({where:{id},data:{name:d.name,phone:d.phone,email:d.email,address:d.address,gstNumber:d.gstNumber,openingBalance:d.openingBalance}})}
}
