import "dotenv/config";
import Joi from "joi";

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "test", "production").default("development"),
  PORT: Joi.number().integer().positive().default(4000),
  MONGO_URI: Joi.string().default("mongodb://localhost:27017/erp"),
  REDIS_URL: Joi.string().default("redis://localhost:6379"),
  JWT_SECRET: Joi.string().min(16).default("dev-secret-change-me-please-32chars!"),
  JWT_EXPIRES_IN: Joi.string().default("1h"),
  REFRESH_EXPIRES_IN_DAYS: Joi.number().integer().positive().default(30),
  CORS_ORIGIN: Joi.string().default("*"),
  UPLOAD_DIR: Joi.string().default("uploads"),
  R2_ACCOUNT_ID: Joi.string().allow("").default(""),
  R2_ACCESS_KEY_ID: Joi.string().allow("").default(""),
  R2_SECRET_ACCESS_KEY: Joi.string().allow("").default(""),
  R2_BUCKET: Joi.string().allow("").default(""),
  R2_PUBLIC_BASE_URL: Joi.string().allow("").default(""),
});

const { value, error } = envSchema.validate(process.env, { allowUnknown: true, stripUnknown: true });
if (error) {
  throw new Error(`invalid environment configuration: ${error.message}`);
}

type Env = {
  NODE_ENV: "development" | "test" | "production";
  PORT: number;
  MONGO_URI: string;
  REDIS_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  REFRESH_EXPIRES_IN_DAYS: number;
  CORS_ORIGIN: string;
  UPLOAD_DIR: string;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET: string;
  R2_PUBLIC_BASE_URL: string;
};

export const env = value as Env;