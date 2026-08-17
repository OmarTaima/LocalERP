import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { env } from "../config/env";
import { AppError } from "./errors";

const IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp);base64,(.+)$/;
const MAX_IMAGE_BYTES = 1_500_000;

export function validateImageBase64(value: string, label = "image"): { extension: string; buffer: Buffer } {
  const match = IMAGE_DATA_URL.exec(value);
  if (!match) {
    throw new AppError(400, `${label} must be a base64 png, jpeg or webp image`);
  }
  const [, extension, base64] = match;
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
    throw new AppError(400, `${label} must be between 1 byte and 1.5 MB`);
  }
  return { extension, buffer };
}

export async function saveBase64Image(base64: string, prefix: string, label = "image"): Promise<string> {
  const { extension, buffer } = validateImageBase64(base64, label);
  const dir = path.join(env.UPLOAD_DIR, prefix);
  await fs.mkdir(dir, { recursive: true });
  const fileName = `${prefix}-${randomBytes(8).toString("hex")}.${extension}`;
  await fs.writeFile(path.join(dir, fileName), buffer);
  return `/uploads/${prefix}/${fileName}`;
}

export async function removeUploadedFile(publicPath: string, prefix: string): Promise<void> {
  const file = path.join(env.UPLOAD_DIR, prefix, path.basename(publicPath));
  await fs.rm(file, { force: true }).catch(() => undefined);
}