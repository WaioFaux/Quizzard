/**
 * Blob pathname helpers that are safe to import from both server and client
 * code (no server-only dependencies).
 */

/**
 * Builds a blob pathname from a user supplied file name.
 * Keeps the extension, replaces everything else with a safe slug and
 * prefixes the result so files stay grouped inside the store.
 */
export function buildBlobPathname(prefix: string, fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  const rawExt = dotIndex > -1 ? fileName.slice(dotIndex + 1).toLowerCase() : "";
  const ext = /^[a-z0-9]{1,8}$/.test(rawExt) ? rawExt : "bin";

  const rawBase = dotIndex > -1 ? fileName.slice(0, dotIndex) : fileName;
  const slug = rawBase
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  const unique = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;

  return `${prefix}/${unique}${slug ? `-${slug}` : ""}.${ext}`;
}
