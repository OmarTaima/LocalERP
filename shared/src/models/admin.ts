import type { ID, PlanTier, Timestamps } from "./common";
import type { CompanySettings } from "./auth";

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