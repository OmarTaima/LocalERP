import mongoose from "mongoose";
import { env } from "../config/env";

export async function seed(): Promise<void> {
  await mongoose.connect(env.MONGO_URI);
  console.log("[seed] connected — demo tenant provisioning lands in Phase 1");
  await mongoose.disconnect();
}

seed().catch((err: unknown) => {
  console.error("[seed] failed", err);
  process.exit(1);
});
