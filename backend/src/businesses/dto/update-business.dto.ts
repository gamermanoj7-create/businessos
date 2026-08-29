import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

// Note: businessId is intentionally NOT a field here. It is always derived
// server-side from TenantContext, never accepted from the client — this is
// what prevents an IDOR where a client tries to edit a different business
// by changing an ID in the payload.
export class UpdateBusinessDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(180) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(180) legalName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(180) email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) pincode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) gstNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10) currency?: string;
}
