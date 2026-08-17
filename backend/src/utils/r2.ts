import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { env } from "../config/env";
import { AppError } from "./errors";

const PRESIGN_TTL_SECONDS = 15 * 60;

export type DirectUploadResult = {
  uploadURL: string;
  publicUrl: string;
};

function isConfigured(): boolean {
  return Boolean(
    env.R2_ACCOUNT_ID &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_BUCKET &&
      env.R2_PUBLIC_BASE_URL,
  );
}

function requireConfig(): void {
  if (!isConfigured()) {
    throw new AppError(503, "Image uploads are not configured on this server");
  }
}

function s3Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });
}

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "file";
}

function bucketPublicBaseUrl(): string {
  return env.R2_PUBLIC_BASE_URL.replace(/\/+$/, "");
}

export async function presignUpload(
  name: string,
  type: string,
  options: { folder?: string } = {},
): Promise<DirectUploadResult> {
  requireConfig();
  const key = [options.folder, `${randomUUID()}-${slugify(name)}`].filter(Boolean).join("/");
  const uploadURL = await getSignedUrl(
    s3Client(),
    new PutObjectCommand({ Bucket: env.R2_BUCKET, Key: key, ContentType: type }),
    { expiresIn: PRESIGN_TTL_SECONDS },
  );
  const publicUrl = `${bucketPublicBaseUrl()}/${key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
  return { uploadURL, publicUrl };
}

function parseKey(publicUrl: string): string | null {
  const baseUrl = bucketPublicBaseUrl();
  if (!publicUrl.startsWith(`${baseUrl}/`)) {
    return null;
  }
  try {
    const key = publicUrl
      .slice(baseUrl.length + 1)
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");
    return key.length > 0 ? key : null;
  } catch {
    return null;
  }
}

export async function deleteImage(url: string): Promise<void> {
  if (!isConfigured()) {
    return;
  }
  const key = parseKey(url);
  if (!key) {
    return;
  }
  try {
    await s3Client().send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
  } catch {
    // fire-and-forget cleanup: never fail the request because a delete failed
  }
}