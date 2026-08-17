import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

declare module "express-serve-static-core" {
  interface Request {
    superadminId: string;
  }
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "missing bearer token" });
    return;
  }
  try {
    const token = header.slice(7);
    const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    if (decoded.scope !== "superadmin" || decoded.companyId !== undefined) {
      res.status(403).json({ error: "superadmin access required" });
      return;
    }
    if (!decoded.sub) {
      res.status(401).json({ error: "invalid token payload" });
      return;
    }
    req.superadminId = decoded.sub;
    next();
  } catch {
    res.status(401).json({ error: "invalid or expired token" });
  }
}