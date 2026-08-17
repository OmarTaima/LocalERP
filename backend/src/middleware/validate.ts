import type { RequestHandler } from "express";
import type Joi from "joi";

export function validate(schema: Joi.ObjectSchema, source: "body" | "query" = "body"): RequestHandler {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      convert: true,
      stripUnknown: true,
    });
    if (error) {
      res.status(400).json({ error: error.details.map((detail) => detail.message).join("; ") });
      return;
    }
    req[source] = value;
    next();
  };
}