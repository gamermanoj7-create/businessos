// Shape attached to `request.user` by JwtStrategy once a JWT is validated.
// Deliberately minimal — does NOT carry business/role/permission info,
// because a single user may belong to multiple businesses. Per-business
// context is resolved separately and per-request by TenantGuard, since
// trusting a business ID embedded in a long-lived access token would let
// permission/role changes made *after* the token was issued go unnoticed.
export interface AuthenticatedUser {
  id: string;
  email: string;
}

// Attached to `request.tenant` by TenantGuard after it verifies (against
// the database, not the client) that the current user is an ACTIVE member
// of the business identified by the `X-Business-Id` header.
export interface TenantContext {
  businessId: string;
  membershipId: string;
  roleId: string;
  roleName: string;
  permissions: string[];
}
