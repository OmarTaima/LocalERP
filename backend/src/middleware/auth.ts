import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export type JwtPayload = {
  sub: string;
  tenantId: string;
  permissions: string[];
  role: string;
};

declare module "express-serve-static-core" {
  interface Request {
    auth?: JwtPayload;
  }
}

export const AUTH_HEADER = "authorization";

export function auth(req: Request, res: Response, next: NextFunction): void {
  const header = req.header(AUTH_HEADER);
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "missing bearer token" });
    return;
  }
  try {
    const token = header.slice(7);
    const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    if (!decoded.sub || !decoded.tenantId) {
      res.status(401).json({ error: "invalid token payload" });
      return;
    }
    req.auth = {
      sub: decoded.sub,
      tenantId: decoded.tenantId,
      permissions: Array.isArray(decoded.permissions) ? decoded.permissions : [],
      role: typeof decoded.role === "string" ? decoded.role : "",
    };
    next();
  } catch {
    res.status(401).json({ error: "invalid or expired token" });
  }
}