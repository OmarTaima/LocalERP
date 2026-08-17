import type { ID, PlanTier, Timestamps } from "./common";

export type TenantSettings = {
  currency: string;
  taxRate: number;
  timezone: string;
};

export type TenantLimits = {
  maxUsers: number;
  maxProducts: number;
  features: string[];
};

export type Tenant = Timestamps & {
  id: ID;
  name: string;
  slug: string;
  plan: PlanTier;
  isActive: boolean;
  settings: TenantSettings;
  limits: TenantLimits;
};

export type UserStatus = "active" | "inactive";

export type User = Timestamps & {
  id: ID;
  tenantId: ID;
  email: string;
  name: string;
  roleId: ID;
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
};

export type Role = Timestamps & {
  id: ID;
  tenantId: ID;
  name: string;
  permissions: string[];
  isSystem: boolean;
};

export type Session = Timestamps & {
  id: ID;
  tenantId: ID;
  userId: ID;
  tokenHash: string;
  device: string;
  ip: string;
  expiresAt: string;
  revokedAt: string | null;
};

export type ApiKey = Timestamps & {
  id: ID;
  tenantId: ID;
  name: string;
  keyHash: string;
  permissions: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export type TwoFactor = Timestamps & {
  id: ID;
  tenantId: ID;
  userId: ID;
  secretEncrypted: string;
  recoveryCodes: string[];
  enabled: boolean;
  verifiedAt: string | null;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type CurrentUser = User & {
  permissions: string[];
  roleName: string;
};