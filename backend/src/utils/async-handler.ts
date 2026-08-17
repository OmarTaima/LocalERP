import type { NextFunction, Request, RequestHandler, Response } from "express";

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export function asyncHandler(fn: Handler): RequestHandler {
  return (req, res, next) => {
    void fn(req, res, next).catch(next);
  };
}