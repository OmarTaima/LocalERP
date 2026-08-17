import type { NextFunction, Request, Response } from "express";

export function rbac(...required: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const missing = required.filter((permission) => !req.permissions.includes(permission));
    if (missing.length > 0) {
      res.status(403).json({ error: `missing permission: ${missing.join(", ")}` });
      return;
    }
    next();
  };
}