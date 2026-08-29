import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  action: string; // e.g. "auth.login", "auth.register"
  businessId?: string;
  userId?: string;
  entity?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Writes an audit entry. Accepts an optional transaction client so audit
   * rows can be committed atomically alongside the business action they
   * describe (e.g. registration). Never accepts or stores passwords, raw
   * tokens, or secrets in `metadata` — callers must not pass them.
   *
   * Audit logging failures are logged but never thrown — a broken audit
   * trail should not be able to take down a business-critical operation
   * when this is called outside a shared transaction.
   */
  async record(entry: AuditEntry, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    try {
      await client.auditLog.create({
        data: {
          action: entry.action,
          businessId: entry.businessId,
          userId: entry.userId,
          entity: entry.entity,
          entityId: entry.entityId,
          metadata: entry.metadata as Prisma.InputJsonValue | undefined,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        },
      });
    } catch (err) {
      if (tx) {
        // Inside a shared transaction, a failure here must roll back the
        // whole operation — audit trail gaps for financial actions are not
        // acceptable, so we re-throw.
        throw err;
      }
      this.logger.error('Failed to write audit log entry', err instanceof Error ? err.stack : err);
    }
  }
}
