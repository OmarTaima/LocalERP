import { Router } from "express";
import {
  changePasswordSchema,
  loginSchema,
  refreshSchema,
  totpSetupSchema,
  totpVerifySchema,
} from "@erp/shared";
import { auth } from "../middleware/auth";
import { company } from "../middleware/company";
import { rbac } from "../middleware/rbac";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/async-handler";
import {
  changePassword,
  currentUser,
  login,
  logout,
  refresh,
  setupTwoFactor,
  uploadAvatar,
  verifyTwoFactor,
} from "../services/auth.service";
import { AppError } from "../utils/errors";

export const authRouter = Router();

authRouter.post("/login", validate(loginSchema), asyncHandler(async (req, res) => {
  const tokens = await login(req.body);
  res.json(tokens);
}));

authRouter.post("/refresh", validate(refreshSchema), asyncHandler(async (req, res) => {
  const tokens = await refresh(req.body.refreshToken);
  res.json(tokens);
}));

authRouter.post("/logout", auth, validate(refreshSchema), asyncHandler(async (req, res) => {
  await logout(req.body.refreshToken);
  res.json({ ok: true });
}));

authRouter.get("/me", auth, company, asyncHandler(async (req, res) => {
  res.json(await currentUser(req.userId));
}));

authRouter.patch("/password", auth, company, rbac("profile:write"), validate(changePasswordSchema), asyncHandler(async (req, res) => {
  await changePassword(req.userId, req.body.currentPassword, req.body.newPassword);
  res.json({ ok: true });
}));

authRouter.post("/avatar", auth, company, rbac("profile:write"), asyncHandler(async (req, res) => {
  if (typeof req.body.image !== "string") {
    throw new AppError(400, "image is required");
  }
  res.json(await uploadAvatar(req.userId, req.body.image));
}));

authRouter.post("/2fa/setup", auth, company, rbac("profile:write"), validate(totpSetupSchema), asyncHandler(async (req, res) => {
  const user = await currentUser(req.userId);
  if (req.body.password === undefined) {
    throw new AppError(400, "password is required");
  }
  const { secret, recoveryCodes } = await setupTwoFactor(req.userId);
  res.json({ secret, recoveryCodes, otpauthUrl: `otpauth://totp/ERP:${user.email}?secret=${secret}&issuer=ERP` });
}));

authRouter.post("/2fa/verify", auth, company, rbac("profile:write"), validate(totpVerifySchema), asyncHandler(async (req, res) => {
  await verifyTwoFactor(req.userId, req.body.code);
  res.json({ enabled: true });
}));