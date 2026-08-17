import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { directUploadSchema } from "@erp/shared";
import { env } from "../config/env";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/async-handler";
import { createDirectUpload } from "../utils/cloudflare-images";

function requireAnyAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "missing bearer token" });
    return;
  }
  try {
    const decoded = jwt.verify(header.slice(7), env.JWT_SECRET) as jwt.JwtPayload;
    if (decoded.scope === "superadmin" && decoded.sub && decoded.companyId === undefined) {
      req.superadminId = decoded.sub;
      next();
      return;
    }
    if (decoded.sub && decoded.companyId) {
      req.auth = {
        sub: decoded.sub,
        companyId: decoded.companyId,
        permissions: Array.isArray(decoded.permissions) ? decoded.permissions : [],
        role: typeof decoded.role === "string" ? decoded.role : "",
      };
      next();
      return;
    }
    res.status(401).json({ error: "invalid token payload" });
  } catch {
    res.status(401).json({ error: "invalid or expired token" });
  }
}

export const uploadRouter = Router();

uploadRouter.post(
  "/direct",
  requireAnyAuth,
  validate(directUploadSchema),
  asyncHandler(async (req, res) => {
    const { uploadURL, publicUrl } = await createDirectUpload(req.body.name, req.body.type, {
      folder: req.body.folder,
    });
    res.json({ uploadURL, publicUrl });
  }),
);