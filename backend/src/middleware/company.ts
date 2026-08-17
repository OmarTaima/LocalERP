import type { NextFunction, Request, Response } from "express";

declare module "express-serve-static-core" {
  interface Request {
    companyId: string;
    userId: string;
    permissions: string[];
    role: string;
  }
}

export function company(req: Request, res: Response, next: NextFunction): void {
  const payload = req.auth;
  if (!payload) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  req.companyId = payload.companyId;
  req.userId = payload.sub;
  req.permissions = payload.permissions;
  req.role = payload.role;
  next();
}

export function requireCompanyParam(param: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.params[param] !== req.companyId) {
      res.status(403).json({ error: "company mismatch" });
      return;
    }
    next();
  };
}