import mongoose from "mongoose";
import { RoleModel, UserModel } from "./src/models";
import { env } from "./src/config/env";

async function main() {
  await mongoose.connect(env.MONGO_URI);
  const roles = await RoleModel.find({}).lean();
  for (const r of roles) {
    console.log(r.name + ": " + r.permissions.join(", "));
  }
  console.log("---");
  const users = await UserModel.find({}).select("email roleId -_id").lean();
  for (const u of users) {
    const role = roles.find((r) => r._id.equals(u.roleId));
    console.log(u.email + " -> " + (role ? role.name : "NO ROLE"));
  }
  await mongoose.disconnect();
  process.exit(0);
}
main().catch((e) => { console.error("ERR:", e); process.exit(1); });
