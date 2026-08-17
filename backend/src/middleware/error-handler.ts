import type { ErrorRequestHandler, RequestHandler } from "express";
import mongoose from "mongoose";
import { AppError } from "../utils/errors";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof mongoose.Error.ValidationError) {
    res.status(400).json({ error: err.message });
    return;
  }
  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({ error: "invalid identifier" });
    return;
  }
  if (err instanceof mongoose.mongo.MongoServerError && err.code === 11000) {
    res.status(409).json({ error: "duplicate value for a unique field" });
    return;
  }
  console.error("[error]", err);
  res.status(500).json({ error: "internal server error" });
};

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "route not found" });
};