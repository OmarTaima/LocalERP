import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { SuperAdminModel } from "../models";

const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL ?? "superadmin@localerp.com";
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD ?? "SuperAdmin!ChangeMe2026";

export async function seed(reset: boolean): Promise<void> {
  await mongoose.connect(env.MONGO_URI);
  if (reset) {
    await mongoose.connection.dropDatabase();
    console.log("[seed] database dropped");
  }
  const email = SUPERADMIN_EMAIL.toLowerCase();
  const existing = await SuperAdminModel.findOne({ email });
  if (existing) {
    console.log(`[seed] superadmin ${email} already present — skipped`);
  } else {
    await SuperAdminModel.create({
      email,
      name: "Platform Super Admin",
      passwordHash: await bcrypt.hash(SUPERADMIN_PASSWORD, 12),
    });
    console.log(`[seed] superadmin created: ${email} / ${SUPERADMIN_PASSWORD}`);
  }
  await mongoose.disconnect();
}

seed(process.argv.includes("--reset")).catch((err: unknown) => {
  console.error("[seed] failed", err);
  process.exit(1);
});