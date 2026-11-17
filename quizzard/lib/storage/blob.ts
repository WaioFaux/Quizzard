import { del, head, put } from "@vercel/blob";

export { buildBlobPathname } from "./blob-paths";

/** Max size for a course material PDF: 50 MB */
export const MAX_MATERIAL_BYTES = 50 * 1024 * 1024;

/** Max size for an avatar image: 2 MB */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export const MATERIAL_CONTENT_TYPES = ["application/pdf"];

export function getBlobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN || undefined;
}

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/** Uploads a buffer to the blob store and returns the public URL. */
export async function uploadBuffer(
  pathname: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  const blob = await put(pathname, body, {
    access: "public",
    addRandomSuffix: true,
    contentType,
    token: getBlobToken(),
  });
  return blob.url;
}

/** Deletes a blob by URL. Never throws - a missing blob is not an error. */
export async function deleteBlob(url: string | null | undefined): Promise<void> {
  if (!url || !url.includes("blob.vercel-storage.com")) {
    return;
  }
  try {
    await del(url, { token: getBlobToken() });
  } catch {
    // Blob may already be gone - deleting the DB record is what matters.
  }
}

export interface BlobFileInfo {
  url: string;
  size: number;
  contentType: string;
}

/** Reads metadata (size, content type) for an existing blob. */
export async function getBlobInfo(url: string): Promise<BlobFileInfo> {
  const info = await head(url, { token: getBlobToken() });
  return {
    url: info.url,
    size: info.size,
    contentType: info.contentType ?? "application/octet-stream",
  };
}

/**
 * Downloads a blob into memory.
 * Public blobs are served straight from the CDN, so this needs no token.
 */
export async function downloadBlob(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file (HTTP ${response.status})`);
  }
  return Buffer.from(await response.arrayBuffer());
}
