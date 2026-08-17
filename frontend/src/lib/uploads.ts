import { api } from "./api";

type DirectUpload = { uploadURL: string; publicUrl: string };

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [1_000, 2_000];
const UPLOAD_TIMEOUT_MS = 120_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestUploadUrl(file: File, folder: string): Promise<DirectUpload> {
  return api<DirectUpload>("/upload/direct", {
    method: "POST",
    body: { name: file.name, type: file.type, folder },
  });
}

function postFile(
  uploadUrl: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadUrl);
    xhr.timeout = UPLOAD_TIMEOUT_MS;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`upload responded with status ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("network error during upload"));
    xhr.ontimeout = () => reject(new Error("upload timed out"));
    xhr.send(form);
  });
}

/**
 * Uploads a file straight to Cloudflare Images.
 * Requests an upload URL via POST /upload/direct, then POSTs the file as
 * multipart/form-data (field "file") to the returned upload URL. Retries up to
 * 3 attempts with exponential backoff and resolves with the final public URL.
 */
export async function uploadDirect(
  file: File,
  folder: string,
  onProgress?: (percent: number) => void,
): Promise<string> {
  let lastDetail = "unknown error";
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const { uploadURL, publicUrl } = await requestUploadUrl(file, folder);
      await postFile(uploadURL, file, onProgress);
      return publicUrl;
    } catch (err) {
      lastDetail = err instanceof Error ? err.message : "unknown error";
      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]);
      }
    }
  }
  throw new Error(`Upload failed after ${MAX_ATTEMPTS} attempts: ${lastDetail}`);
}