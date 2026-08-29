import { SetMetadata } from '@nestjs/common';
import { PermissionKey } from '../constants/permissions.constant';

export const PERMISSIONS_KEY = 'permissions';

// Declares which permission(s) a route requires. Checked by PermissionsGuard.
// A user needs ALL listed permissions to pass (AND semantics).
// Usage: @Permissions(PERMISSIONS.PRODUCT_CREATE)
export const Permissions = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
