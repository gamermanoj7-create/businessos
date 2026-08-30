import { Injectable } from '@nestjs/common';
import { Prisma, SystemRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ALL_PERMISSION_KEYS,
  DEFAULT_ROLE_PERMISSIONS,
} from '../common/constants/permissions.constant';

const SYSTEM_ROLE_NAMES: SystemRole[] = ['OWNER', 'ADMIN', 'MANAGER', 'STAFF', 'ACCOUNTANT'];

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates the standard set of system roles (OWNER, ADMIN, MANAGER, STAFF,
   * ACCOUNTANT) for a newly created business, and links each to its default
   * permission set. OWNER always receives every permission that exists at
   * seed time — this is computed from the live permission catalog rather
   * than a hard-coded list, so it can never silently fall behind as new
   * permissions are added in later phases.
   *
   * Must be called inside the same transaction as business creation
   * (pass the transactional Prisma client in `tx`).
   */
  async seedDefaultRoles(
    tx: Prisma.TransactionClient,
    businessId: string,
  ): Promise<Record<SystemRole, string>> {
    const allPermissions = await tx.permission.findMany({
      where: { key: { in: ALL_PERMISSION_KEYS } },
    });
    const permissionIdByKey = new Map(allPermissions.map((p) => [p.key, p.id]));

    const roleIdByName = {} as Record<SystemRole, string>;

    for (const systemRole of SYSTEM_ROLE_NAMES) {
      const role = await tx.role.create({
        data: {
          businessId,
          name: systemRole,
          systemRole,
          isSystem: true,
        },
      });
      roleIdByName[systemRole] = role.id;

      const permissionKeys =
        systemRole === 'OWNER'
          ? ALL_PERMISSION_KEYS
          : (DEFAULT_ROLE_PERMISSIONS[systemRole] ?? []);

      const rolePermissionRows = permissionKeys
        .map((key) => permissionIdByKey.get(key))
        .filter((id): id is string => Boolean(id))
        .map((permissionId) => ({ roleId: role.id, permissionId }));

      if (rolePermissionRows.length > 0) {
        await tx.rolePermission.createMany({ data: rolePermissionRows, skipDuplicates: true });
      }
    }

    return roleIdByName;
  }
}
