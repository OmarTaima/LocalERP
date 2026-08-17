import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env";

const CLOUDINARY_URL_MARKER = "/image/upload/";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

function isConfigured(): boolean {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

function parsePublicId(url: string): string | null {
  if (!url.includes("res.cloudinary.com")) {
    return null;
  }
  const markerIndex = url.indexOf(CLOUDINARY_URL_MARKER);
  if (markerIndex === -1) {
    return null;
  }
  const publicId = url
    .slice(markerIndex + CLOUDINARY_URL_MARKER.length)
    .replace(/^v\d+\//, "")
    .replace(/\.[a-zA-Z0-9]+$/, "");
  return publicId.length > 0 ? publicId : null;
}

export async function deleteImage(url: string): Promise<void> {
  if (!isConfigured()) {
    return;
  }
  const publicId = parsePublicId(url);
  if (!publicId) {
    return;
  }
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch {
    // fire-and-forget cleanup: never fail the request because a delete failed
  }
}