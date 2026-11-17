// Round-trips a file through the Vercel Blob store and reports whether the
// downloaded bytes still match the original. Used to check that the CDN does
// not alter the payload (compression, line-ending normalisation, ...).
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { put } from "@vercel/blob";

function loadEnv(file) {
  const raw = fs.readFileSync(file, "utf8");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const env = loadEnv(path.join(__dirname, "..", ".env"));
const file = process.argv[2] ?? path.join(__dirname, "test-lecture.pdf");
const original = fs.readFileSync(file);

const blob = await put(`roundtrip/${Date.now()}-${path.basename(file)}`, original, {
  access: "public",
  addRandomSuffix: true,
  contentType: "application/pdf",
  token: env.BLOB_READ_WRITE_TOKEN,
});

const res = await fetch(blob.url);
const downloaded = Buffer.from(await res.arrayBuffer());

const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
console.log("url        :", blob.url);
console.log("original   :", original.length, sha(original));
console.log("downloaded :", downloaded.length, sha(downloaded));
console.log(
  "identical  :",
  original.length === downloaded.length && sha(original) === sha(downloadloaded ?? downloaded)
);
console.log("headers    :", JSON.stringify(Object.fromEntries(res.headers), null, 2));
