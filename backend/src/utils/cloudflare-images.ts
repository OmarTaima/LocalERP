import { env } from "../config/env";
import { AppError } from "./errors";

const CLOUDFLARE_IMAGES_API = "https://api.cloudflare.com/client/v4";
const DIRECT_UPLOAD_TTL_MS = 10 * 60 * 1000;

export type DirectUploadResult = {
  uploadURL: string;
  publicUrl: string;
};

type CloudflareResponse<T> = {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  result: T;
};

function requireConfig(): void {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_IMAGES_TOKEN) {
    throw new AppError(503, "Image uploads are not configured on this server");
  }
}

function cloudflareErrorMessage(body: CloudflareResponse<unknown>): string {
  const messages = body.errors.map((error) => error.message).filter(Boolean);
  return messages.length > 0 ? messages.join("; ") : "unknown Cloudflare Images error";
}

export async function createDirectUpload(
  name: string,
  type: string,
  options: { folder?: string } = {},
): Promise<DirectUploadResult> {
  requireConfig();
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const token = env.CLOUDFLARE_IMAGES_TOKEN;
  const metadata = JSON.stringify({
    name,
    type,
    source: "erp",
    ...(options.folder ? { folder: options.folder } : {}),
  });

  const form = new FormData();
  form.append("expiry", new Date(Date.now() + DIRECT_UPLOAD_TTL_MS).toISOString());
  form.append("metadata", metadata);

  const uploadRes = await fetch(
    `${CLOUDFLARE_IMAGES_API}/accounts/${accountId}/images/v2/direct_upload`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: form,
    },
  );
  const uploadBody = (await uploadRes.json()) as CloudflareResponse<{ uploadURL: string; id: string }>;
  if (!uploadRes.ok || !uploadBody.success) {
    throw new AppError(503, `Cloudflare Images direct upload failed: ${cloudflareErrorMessage(uploadBody)}`);
  }
  const { uploadURL, id } = uploadBody.result;

  const imageRes = await fetch(`${CLOUDFLARE_IMAGES_API}/accounts/${accountId}/images/v1/${id}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const imageBody = (await imageRes.json()) as CloudflareResponse<{ variants: string[] }>;
  if (!imageRes.ok || !imageBody.success) {
    throw new AppError(503, `Cloudflare Images fetch failed: ${cloudflareErrorMessage(imageBody)}`);
  }
  const variants = imageBody.result.variants ?? [];
  const publicUrl = variants.find((variant) => variant.endsWith("/public")) ?? variants[0];
  if (!publicUrl) {
    throw new AppError(503, "Cloudflare Images returned no delivery variants");
  }
  return { uploadURL, publicUrl };
}

function parseImageId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const hostname = parsed.hostname.toLowerCase();
  if (hostname !== "imagedelivery.net" && !hostname.endsWith(".imagedelivery.net")) {
    return null;
  }
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length < 3 || segments[segments.length - 1] !== "public") {
    return null;
  }
  return segments[segments.length - 2];
}

export async function deleteImage(url: string): Promise<void> {
  const imageId = parseImageId(url);
  if (!imageId || !env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_IMAGES_TOKEN) {
    return;
  }
  try {
    const res = await fetch(
      `${CLOUDFLARE_IMAGES_API}/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/images/v1/${imageId}`,
      {
        method: "DELETE",
        headers: { authorization: `Bearer ${env.CLOUDFLARE_IMAGES_TOKEN}` },
      },
    );
    if (res.status === 404) {
      return;
    }
  } catch {
    // fire-and-forget cleanup: never fail the request because a delete failed
  }
}