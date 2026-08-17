import type { ID, PlanTier, Timestamps } from "./common";
import type { CompanySettings, User } from "./auth";

export type SuperAdmin = Timestamps & {
  id: ID;
  email: string;
  name: string;
};

export type CreateCompanyInput = {
  name: string;
  slug: string;
  plan: PlanTier;
  settings?: CompanySettings;
};

export type CreateCompanyUserInput = {
  name: string;
  email: string;
  password: string;
  roleId?: ID;
};

export type AdminCreateUserInput = {
  name: string;
  email: string;
  password: string;
  companyId: ID;
  roleId?: ID;
};

export type AdminUpdateUserInput = {
  name?: string;
  roleId?: ID;
  companyId?: ID;
  isActive?: boolean;
};

export type AdminUserListItem = User & {
  companyName: string;
  roleName: string;
};

export type AdminUserList = {
  items: AdminUserListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminUpdateRoleInput = {
  name?: string;
  permissions?: string[];
};