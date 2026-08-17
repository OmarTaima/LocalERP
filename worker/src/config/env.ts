import "dotenv/config";
import Joi from "joi";

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "test", "production").default("development"),
  REDIS_URL: Joi.string().default("redis://localhost:6379"),
  CRON_API_URL: Joi.string().default("http://localhost:4000"),
  CRON_API_TOKEN: Joi.string().default(""),
  CRON_TENANT_IDS: Joi.string().default(""),
});

const { value, error } = envSchema.validate(process.env, { allowUnknown: true, stripUnknown: true });
if (error) {
  throw new Error(`invalid environment configuration: ${error.message}`);
}

type Env = {
  NODE_ENV: "development" | "test" | "production";
  REDIS_URL: string;
  CRON_API_URL: string;
  CRON_API_TOKEN: string;
  CRON_TENANT_IDS: string;
};

export const env = value as Env;