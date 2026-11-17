// Verifies the Vercel Blob client-upload path against a deployed instance:
//   1. request a client token from /api/materials/upload
//   2. PUT the PDF straight to the blob store with that token
//   3. POST /api/materials so the server downloads + parses the PDF
const { upload } = await import("@vercel/blob/client");

const BASE = process.argv[2] || "https://quizzard-one.vercel.app";
const PDF = process.argv[3] || "test-lecture.pdf";

let cookie = "";
async function api(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const pair = c.split(";")[0];
    if (pair.startsWith("quizzard_session=")) cookie = pair;
  }
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text.slice(0, 300); }
  return { status: res.status, json };
}

let failures = 0;
function log(label, r, expected = [200, 201]) {
  const body = typeof r.json === "string" ? r.json : JSON.stringify(r.json);
  const ok = expected.includes(r.status);
  if (!ok) failures++;
  console.log(`[${ok ? "OK  " : "FAIL"}] ${label} ${r.status} ${body.slice(0, 300)}`);
  return r.json;
}

log("signupTeacher", await api("/api/auth/signup", {
  method: "POST",
  body: {
    email: `blob${Date.now()}@quizzard.test`,
    password: "TestPass123!",
    name: "Blob Teacher",
    role: "TEACHER",
  },
}));

const cls = log("createClass", await api("/api/classes", {
  method: "POST",
  body: { name: "Blob Class", classPassword: "join123" },
}));
const classId = cls?.data?.id;

const fs = await import("node:fs/promises");
const bytes = await fs.readFile(PDF);
const file = new File([bytes], PDF, { type: "application/pdf" });
console.log("pdf size:", bytes.length, "bytes");

const pathname = `materials/${Date.now()}-${PDF}`;
const blob = await upload(pathname, file, {
  access: "public",
  handleUploadUrl: `${BASE}/api/materials/upload`,
  clientPayload: JSON.stringify({ classId }),
  contentType: "application/pdf",
  headers: { cookie },
});
console.log("[OK  ] blob upload", blob.url);

const mat = log("createMaterial", await api("/api/materials", {
  method: "POST",
  body: { classId, fileName: PDF, url: blob.url },
}));
console.log("material status:", mat?.data?.status);
console.log("extracted text length:", (mat?.data?.extractedText ?? "").length);
console.log("stored filePath:", mat?.data?.filePath);

// the blob must be publicly readable
const head = await fetch(blob.url, { method: "GET" });
console.log(`[${head.ok ? "OK  " : "FAIL"}] blob GET ${head.status}`);
if (!head.ok) failures++;

console.log(failures === 0 ? "ALL CHECKS PASSED" : `FAILURES: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
