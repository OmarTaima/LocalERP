import type { NextFunction, Request, Response } from "express";

declare module "express-serve-static-core" {
  interface Request {
    tenantId: string;
    userId: string;
    permissions: string[];
    role: string;
  }
}

export function tenant(req: Request, res: Response, next: NextFunction): void {
  const payload = req.auth;
  if (!payload) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  req.tenantId = payload.tenantId;
  req.userId = payload.sub;
  req.permissions = payload.permissions;
  req.role = payload.role;
  next();
}

export function requireTenantParam(param: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.params[param] !== req.tenantId) {
      res.status(403).json({ error: "tenant mismatch" });
      return;
    }
    next();
  };
}