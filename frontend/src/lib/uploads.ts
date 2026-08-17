const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [1_000, 2_000];
const UPLOAD_TIMEOUT_MS = 120_000;
const CLOUDINARY_UPLOAD_URL = (cloudName: string) =>
  `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomSuffix(): string {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return Math.random().toString(16).slice(2, 10);
}

/**
 * The preset uses unique filename: false and overwrite: false, so two uploads
 * with the same filename collide. Rename every file with a random suffix to
 * keep names unique while preserving the original extension.
 */
function renamedFile(file: File): File {
  const extIndex = file.name.lastIndexOf(".");
  const ext = extIndex >= 0 ? file.name.slice(extIndex) : "";
  const basename = extIndex >= 0 ? file.name.slice(0, extIndex) : file.name;
  return new File([file], `${basename}-${randomSuffix()}${ext}`, { type: file.type });
}

function postFile(
  cloudName: string,
  uploadPreset: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", CLOUDINARY_UPLOAD_URL(cloudName));
    xhr.timeout = UPLOAD_TIMEOUT_MS;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as { secure_url?: string };
          if (data.secure_url) resolve(data.secure_url);
          else reject(new Error("upload response missing secure_url"));
        } catch {
          reject(new Error("invalid upload response"));
        }
      } else {
        reject(new Error(`upload responded with status ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("network error during upload"));
    xhr.ontimeout = () => reject(new Error("upload timed out"));

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    xhr.send(formData);
  });
}

/**
 * Uploads a file to Cloudinary via the unsigned upload preset.
 * The browser POSTs the file directly to Cloudinary's auto/upload endpoint as
 * multipart/form-data (field name "file", browser-set boundary) with only the
 * unsigned upload preset — no api_key, timestamp, signature, public_id, or
 * folder. Because the preset uses unique filename: false and overwrite: false,
 * the file is renamed with a random 8-hex-char suffix to avoid collisions.
 * Resolves with Cloudinary's secure_url. Retries up to 3 attempts with 1s/2s
 * backoff. `folder` is accepted for caller compatibility but not sent: the
 * preset controls placement.
 */
export async function uploadDirect(
  file: File,
  folder: string,
  onProgress?: (percent: number) => void,
): Promise<string> {
  void folder;
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) {
    throw new Error(
      "Cloudinary is not configured (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME/NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET)",
    );
  }
  const renamed = renamedFile(file);
  let lastDetail = "unknown error";
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await postFile(cloudName, uploadPreset, renamed, onProgress);
    } catch (err) {
      lastDetail = err instanceof Error ? err.message : "unknown error";
      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]);
      }
    }
  }
  throw new Error(`Upload failed after ${MAX_ATTEMPTS} attempts: ${lastDetail}`);
}