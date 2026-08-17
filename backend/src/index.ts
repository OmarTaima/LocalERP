import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { adminRouter } from "./routes/admin.routes";
import { authRouter } from "./routes/auth.routes";
import { userRouter } from "./routes/user.routes";
import { roleRouter } from "./routes/role.routes";
import { companyRouter } from "./routes/company.routes";
import { auditRouter } from "./routes/audit.routes";
import { notificationRouter } from "./routes/notification.routes";
import { catalogRouter } from "./routes/catalog.routes";
import { inventoryRouter } from "./routes/inventory.routes";
import { salesRouter } from "./routes/sales.routes";
import { financeRouter } from "./routes/finance.routes";
import { purchasingRouter } from "./routes/purchasing.routes";
import { manufacturingRouter } from "./routes/manufacturing.routes";
import { hrRouter } from "./routes/hr.routes";
import { systemRouter } from "./routes/system.routes";

export const app = express();

app.use(cors({ origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN }));
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(env.UPLOAD_DIR));

app.get("/api/v1/health", (_req, res) => {
  res.json({ status: "ok", service: "erp-backend" });
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/roles", roleRouter);
app.use("/api/v1/company", companyRouter);
app.use("/api/v1/audit-logs", auditRouter);
app.use("/api/v1/notifications", notificationRouter);
app.use("/api/v1", catalogRouter);
app.use("/api/v1", inventoryRouter);
app.use("/api/v1", salesRouter);
app.use("/api/v1", financeRouter);
app.use("/api/v1", purchasingRouter);
app.use("/api/v1", manufacturingRouter);
app.use("/api/v1", hrRouter);
app.use("/api/v1", systemRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export async function connectDb(): Promise<void> {
  await mongoose.connect(env.MONGO_URI);
  console.log(`[db] connected: ${env.MONGO_URI}`);
}

export function listen(): void {
  app.listen(env.PORT, () => {
    console.log(`[http] listening on :${env.PORT}`);
  });
}

if (process.env.NODE_ENV !== "test") {
  connectDb()
    .then(listen)
    .catch((err: unknown) => {
      console.error("[fatal] failed to start", err);
      process.exit(1);
    });
}