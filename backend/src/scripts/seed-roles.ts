import mongoose from "mongoose";
import { env } from "../config/env";
import { ROLE_PRESETS } from "../constants/permissions";
import { RoleModel, TenantModel } from "../models";

export async function seedRoles(): Promise<void> {
  await mongoose.connect(env.MONGO_URI);
  const tenant = await TenantModel.findOne({ slug: process.argv[2] ?? "demo" });
  if (!tenant) {
    console.error("[seed] tenant not found. usage: npm run seed -- <tenant-slug>");
    process.exit(1);
  }
  let created = 0;
  for (const [name, permissions] of Object.entries(ROLE_PRESETS)) {
    const exists = await RoleModel.exists({ tenantId: tenant._id, name });
    if (!exists) {
      await RoleModel.create({ tenantId: tenant._id, name, permissions, isSystem: true });
      created++;
    }
  }
  console.log(`[seed] tenant ${tenant.slug}: ${created} roles created, others already present`);
  await mongoose.disconnect();
}

seedRoles().catch((err: unknown) => {
  console.error("[seed] failed", err);
  process.exit(1);
});