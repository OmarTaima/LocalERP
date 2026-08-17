import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { AuthTokens, CurrentUser, PlanTier, User } from "@erp/shared";
import { env } from "../config/env";
import { ALL_PERMISSIONS, PLAN_LIMITS, ROLE_PRESETS } from "../constants/permissions";
import { publish } from "../events/bus";
import { RoleModel, SessionModel, TenantModel, TwoFactorModel, UserModel, type UserDoc } from "../models";
import { AppError } from "../utils/errors";
import { decryptSecret, encryptSecret, sha256 } from "../utils/crypto";
import { generateBase32Secret, generateRecoveryCodes, verifyTotp } from "../utils/totp";
import { writeAudit } from "./audit.service";

const SALT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function issueAccessToken(user: UserDoc, role: { name: string; permissions: string[] }): string {
  return jwt.sign(
    {
      sub: user._id.toString(),
      tenantId: user.tenantId.toString(),
      permissions: role.permissions,
      role: role.name,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] },
  );
}

function generateRefreshToken(): string {
  return randomBytes(48).toString("hex");
}

export type SignupInput = {
  companyName: string;
  name: string;
  email: string;
  password: string;
  plan: PlanTier;
};

export async function signup(input: SignupInput): Promise<AuthTokens> {
  const existingEmail = await UserModel.findOne({ email: input.email.toLowerCase() });
  if (existingEmail) {
    throw new AppError(409, "email already registered");
  }

  const session = await mongoose.startSession();
  try {
    const [tenant] = await TenantModel.create(
      [
        {
          name: input.companyName,
          slug: await uniqueSlug(input.companyName),
          plan: input.plan,
          isActive: true,
          settings: { currency: "USD", taxRate: 0, timezone: "UTC" },
          limits: PLAN_LIMITS[input.plan],
        },
      ],
      { session },
    );

    const [adminRole] = await RoleModel.create(
      [
        {
          tenantId: tenant._id,
          name: "admin",
          permissions: [...ALL_PERMISSIONS],
          isSystem: true,
        },
      ],
      { session },
    );

    const [user] = await UserModel.create(
      [
        {
          tenantId: tenant._id,
          email: input.email.toLowerCase(),
          passwordHash: await bcrypt.hash(input.password, SALT_ROUNDS),
          name: input.name,
          roleId: adminRole._id,
          isActive: true,
        },
      ],
      { session },
    );

    await seedPresetRoles(tenant._id.toString(), { session });

    return await createSessionPair(user, adminRole, input.email, "signup");
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw err;
  } finally {
    await session.endSession();
  }
}

async function uniqueSlug(companyName: string): Promise<string> {
  const base = slugify(companyName) || "company";
  let candidate = base;
  for (let attempt = 0; attempt < 5; attempt++) {
    const exists = await TenantModel.exists({ slug: candidate });
    if (!exists) return candidate;
    candidate = `${base}-${randomBytes(2).toString("hex")}`;
  }
  throw new AppError(409, "could not generate a unique company slug");
}

type SessionOptions = { session?: mongoose.ClientSession };

async function seedPresetRoles(tenantId: string, options: SessionOptions = {}): Promise<void> {
  const presetNames = Object.keys(ROLE_PRESETS).filter((name) => name !== "admin");
  const existing = await RoleModel.countDocuments({ tenantId, name: { $in: presetNames } }, options);
  if (existing > 0) return;
  const docs = Object.entries(ROLE_PRESETS)
    .filter(([name]) => name !== "admin")
    .map(([name, permissions]) => ({ tenantId, name, permissions, isSystem: true }));
  await RoleModel.insertMany(docs, options);
}

async function createSessionPair(
  user: UserDoc,
  role: { name: string; permissions: string[] },
  actorEmail: string,
  context: "login" | "signup" | "refresh",
): Promise<AuthTokens> {
  const refreshToken = generateRefreshToken();
  await SessionModel.create({
    tenantId: user.tenantId,
    userId: user._id,
    tokenHash: sha256(refreshToken),
    device: "",
    ip: "",
    expiresAt: new Date(Date.now() + env.REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000),
  });
  const accessToken = issueAccessToken(user, role);
  await UserModel.updateOne({ _id: user._id }, { lastLoginAt: new Date() });
  publish({ type: "user.login", payload: { userId: user._id.toString(), email: actorEmail, context } });
  return { accessToken, refreshToken };
}

export type LoginInput = {
  email: string;
  password: string;
  totpCode?: string;
};

export async function login(input: LoginInput): Promise<AuthTokens> {
  const user = await UserModel.findOne({ email: input.email.toLowerCase() });
  if (!user || !user.isActive) {
    throw new AppError(401, "invalid credentials");
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError(423, "account temporarily locked");
  }

  const passwordOk = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordOk) {
    const attempts = user.failedLoginAttempts + 1;
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      await UserModel.updateOne(
        { _id: user._id },
        { failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + LOCK_DURATION_MS) },
      );
      publish({ type: "user.locked", payload: { userId: user._id.toString() } });
      throw new AppError(423, "account locked after repeated failures");
    }
    await UserModel.updateOne({ _id: user._id }, { failedLoginAttempts: attempts });
    throw new AppError(401, "invalid credentials");
  }

  await UserModel.updateOne({ _id: user._id }, { failedLoginAttempts: 0, lockedUntil: null });

  const twoFactor = await TwoFactorModel.findOne({ userId: user._id, enabled: true });
  if (twoFactor) {
    const secret = decryptSecret(twoFactor.secretEncrypted);
    const codeOk = input.totpCode ? verifyTotp(secret, input.totpCode) : false;
    const recoveryOk = input.totpCode ? twoFactor.recoveryCodes.includes(sha256(input.totpCode)) : false;
    if (!codeOk && !recoveryOk) {
      throw new AppError(401, "totp code required or incorrect");
    }
    if (recoveryOk && input.totpCode) {
      await TwoFactorModel.updateOne(
        { _id: twoFactor._id },
        { $pull: { recoveryCodes: sha256(input.totpCode) } },
      );
    }
  }

  const role = await RoleModel.findById(user.roleId);
  if (!role) {
    throw new AppError(403, "user role not found");
  }

  await writeAudit({
    tenantId: user.tenantId.toString(),
    userId: user._id.toString(),
    action: "login",
    entity: "User",
    entityId: user._id.toString(),
  });

  return await createSessionPair(user, role, input.email, "login");
}

export async function refresh(refreshToken: string): Promise<AuthTokens> {
  const session = await SessionModel.findOne({
    tokenHash: sha256(refreshToken),
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!session) {
    throw new AppError(401, "invalid refresh token");
  }
  const user = await UserModel.findById(session.userId);
  const role = user ? await RoleModel.findById(user.roleId) : null;
  if (!user || !user.isActive || !role) {
    throw new AppError(401, "session owner no longer valid");
  }
  const newToken = generateRefreshToken();
  await SessionModel.updateOne(
    { _id: session._id },
    { tokenHash: sha256(newToken), expiresAt: new Date(Date.now() + env.REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000) },
  );
  return { accessToken: issueAccessToken(user, role), refreshToken: newToken };
}

export async function logout(refreshToken: string): Promise<void> {
  await SessionModel.updateOne({ tokenHash: sha256(refreshToken) }, { revokedAt: new Date() });
}

export async function setupTwoFactor(userId: string): Promise<{ secret: string; recoveryCodes: string[] }> {
  const secret = generateBase32Secret();
  const recoveryCodes = generateRecoveryCodes();
  const existing = await TwoFactorModel.findOne({ userId });
  if (existing) {
    await TwoFactorModel.updateOne(
      { _id: existing._id },
      {
        secretEncrypted: encryptSecret(secret),
        recoveryCodes: recoveryCodes.map(sha256),
        enabled: false,
        verifiedAt: null,
      },
    );
  } else {
    await TwoFactorModel.create({
      tenantId: (await UserModel.findById(userId))!.tenantId,
      userId,
      secretEncrypted: encryptSecret(secret),
      recoveryCodes: recoveryCodes.map(sha256),
      enabled: false,
    });
  }
  return { secret, recoveryCodes };
}

export async function verifyTwoFactor(userId: string, code: string): Promise<void> {
  const record = await TwoFactorModel.findOne({ userId });
  if (!record) {
    throw new AppError(404, "2fa not set up");
  }
  if (!verifyTotp(decryptSecret(record.secretEncrypted), code)) {
    throw new AppError(400, "invalid totp code");
  }
  await TwoFactorModel.updateOne({ _id: record._id }, { enabled: true, verifiedAt: new Date() });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new AppError(404, "user not found");
  }
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new AppError(400, "current password is incorrect");
  }
  await UserModel.updateOne(
    { _id: user._id },
    { passwordHash: await bcrypt.hash(newPassword, SALT_ROUNDS), mustChangePassword: false },
  );
}

export async function uploadAvatar(userId: string, imageDataUrl: string): Promise<{ avatarUrl: string }> {
  const match = /^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(imageDataUrl);
  if (!match) {
    throw new AppError(400, "avatar must be a base64 png, jpeg or webp image");
  }
  const [, extension, base64] = match;
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0 || buffer.length > 1_500_000) {
    throw new AppError(400, "avatar must be between 1 byte and 1.5 MB");
  }
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new AppError(404, "user not found");
  }
  const avatarDir = path.join(env.UPLOAD_DIR, "avatars");
  await fs.mkdir(avatarDir, { recursive: true });
  const fileName = `${userId}.${extension}`;
  await fs.writeFile(path.join(avatarDir, fileName), buffer);
  if (user.avatarUrl) {
    const previous = path.join(avatarDir, path.basename(user.avatarUrl));
    await fs.rm(previous, { force: true }).catch(() => undefined);
  }
  user.avatarUrl = `/uploads/avatars/${fileName}`;
  await user.save();
  return { avatarUrl: user.avatarUrl };
}

export async function currentUser(userId: string): Promise<CurrentUser> {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new AppError(404, "user not found");
  }
  const role = await RoleModel.findById(user.roleId);
  if (!role) {
    throw new AppError(403, "user role not found");
  }
  return {
    ...serializeUser(user),
    permissions: role.permissions,
    roleName: role.name,
  };
}

export function serializeUser(user: UserDoc): User {
  return {
    id: user._id.toString(),
    tenantId: user.tenantId.toString(),
    email: user.email,
    name: user.name,
    roleId: user.roleId.toString(),
    avatarUrl: user.avatarUrl ?? null,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}