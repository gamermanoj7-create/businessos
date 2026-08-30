import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BusinessesModule } from './businesses/businesses.module';
import { RolesModule } from './roles/roles.module';
import { AuditModule } from './audit/audit.module';
import { HealthModule } from './health/health.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { CatalogModule } from './catalog/catalog.module';
import { InventoryModule } from './inventory/inventory.module';
import { ContactsModule } from './contacts/contacts.module';
import { CommerceModule } from './commerce/commerce.module';
import { FinanceModule } from './finance/finance.module';
import { ReportsModule } from './reports/reports.module';
import { SyncModule } from './sync/sync.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    // Global rate limiting baseline; auth endpoints apply a stricter
    // override (see auth.controller / auth-specific throttle in Phase 5+
    // if per-route limits are needed beyond this default).
    ThrottlerModule.forRoot([
      {
        ttl: 60_000, // 1 minute
        limit: 100, // 100 requests/min per client by default
      },
    ]),
    PrismaModule,
    AuditModule,
    RolesModule,
    AuthModule,
    UsersModule,
    BusinessesModule,
    HealthModule,
    CatalogModule,
    InventoryModule,
    ContactsModule,
    CommerceModule,
    FinanceModule,
    ReportsModule,
    SyncModule,
    AiModule,
  ],
  providers: [
    // Fail-closed by default: every route requires a valid JWT unless
    // explicitly marked @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
