import mongoose from "mongoose";
import { env } from "../config/env";
import { ROLE_PRESETS } from "../constants/permissions";
import { RoleModel, CompanyModel } from "../models";

export async function seedRoles(): Promise<void> {
  await mongoose.connect(env.MONGO_URI);
  const company = await CompanyModel.findOne({ slug: process.argv[2] ?? "demo" });
  if (!company) {
    console.error("[seed] company not found. usage: npm run seed -- <company-slug>");
    process.exit(1);
  }
  let created = 0;
  for (const [name, permissions] of Object.entries(ROLE_PRESETS)) {
    const exists = await RoleModel.exists({ companyId: company._id, name });
    if (!exists) {
      await RoleModel.create({ companyId: company._id, name, permissions, isSystem: true });
      created++;
    }
  }
  console.log(`[seed] company ${company.slug}: ${created} roles created, others already present`);
  await mongoose.disconnect();
}

seedRoles().catch((err: unknown) => {
  console.error("[seed] failed", err);
  process.exit(1);
});