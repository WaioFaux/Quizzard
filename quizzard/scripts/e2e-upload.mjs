import fs from "node:fs";
import path from "node:path";
import { upload } from "@vercel/blob/client";

const BASE = process.argv[2] || "https://quizzard-one.vercel.app";

function makeSession() {
  let cookie = "";
  return {
    get cookie() {
      return cookie;
    },
    capture(res) {
      for (const c of res.headers.getSetCookie?.() ?? []) {
        const pair = c.split(";")[0];
        if (pair.startsWith("quizzard_session=")) cookie = pair;
      }
    },
    async api(path, options = {}) {
      const res = await fetch(`${BASE}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(cookie ? { cookie } : {}),
          ...(options.headers ?? {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      this.capture(res);
      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        json = text.slice(0, 300);
      }
      return { status: res.status, json };
    },
  };
}

const teacher = makeSession();
const student = makeSession();

function log(label, r) {
  const body = typeof r.json === "string" ? r.json : JSON.stringify(r.json);
  console.log(`[${label}] ${r.status} ${body.slice(0, 400)}`);
  return r.json;
}

// ---- teacher ----
log(
  "signupTeacher",
  await teacher.api("/api/auth/signup", {
    method: "POST",
    body: {
      email: `teacher${Date.now()}@quizzard.test`,
      password: "TestPass123!",
      name: "Test Teacher",
      role: "TEACHER",
    },
  })
);

const cls = log(
  "createClass",
  await teacher.api("/api/classes", {
    method: "POST",
    body: {
      name: "Verification Class",
      description: "E2E",
      classPassword: "join123",
    },
  })
);
const classId = cls?.data?.id;
const classCode = cls?.data?.classCode;
console.log("classId:", classId, "classCode:", classCode);
console.log("password fields leaked:", JSON.stringify(cls?.data).match(/classPassword\w*/g));

// ---- upload a REAL pdf with the real blob client ----
const pdf = fs.readFileSync(
  path.join(import.meta.dirname, "test-lecture.pdf")
);
console.log("pdf bytes:", pdf.length);

const file = new File([pdf], "lecture.pdf", { type: "application/pdf" });
const blob = await upload(`materials/${Date.now()}-lecture.pdf`, file, {
  access: "public",
  handleUploadUrl: `${BASE}/api/materials/upload`,
  clientPayload: JSON.stringify({ classId }),
  contentType: "application/pdf",
  headers: { cookie: teacher.cookie },
});
console.log("[blobUpload] url:", blob.url);

// ---- register the material (server downloads + parses inline) ----
const mat = log(
  "createMaterial",
  await teacher.api("/api/materials", {
    method: "POST",
    body: { classId, fileName: "lecture.pdf", url: blob.url },
  })
);
console.log("material status:", mat?.data?.status);
console.log("material filePath:", mat?.data?.filePath);
console.log("extractedText length:", (mat?.data?.extractedText ?? "").length);

// ---- blob is publicly reachable ----
const blobFetch = await fetch(blob.url);
console.log("[blobPublicFetch]", blobFetch.status, blobFetch.headers.get("content-type"));

// ---- student joins via the correct route ----
log(
  "signupStudent",
  await student.api("/api/auth/signup", {
    method: "POST",
    body: {
      email: `student${Date.now()}@quizzard.test`,
      password: "TestPass123!",
      name: "Test Student",
      role: "STUDENT",
    },
  })
);
log(
  "joinClass",
  await student.api(`/api/classes/${classCode}/join`, {
    method: "POST",
    body: { classCode, classPassword: "join123" },
  })
);
log("studentClasses", await student.api("/api/classes"));

// ---- avatar upload (through the server) ----
const png = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000100ffff03000006000557bfabd40000000049454e44ae426082",
  "hex"
);
const fd = new FormData();
fd.append("avatar", new Blob([png], { type: "image/png" }), "avatar.png");
const avRes = await fetch(`${BASE}/api/users/avatar`, {
  method: "POST",
  body: fd,
  headers: { cookie: teacher.cookie },
});
const avJson = await avRes.json();
console.log("[avatar]", avRes.status, JSON.stringify(avJson).slice(0, 250));
const avatarUrl = avJson?.data?.avatarUrl;
if (avatarUrl) {
  const avFetch = await fetch(avatarUrl);
  console.log("[avatarPublicFetch]", avFetch.status);
}

// ---- delete material (removes the blob) ----
if (mat?.data?.id) {
  const delRes = await fetch(`${BASE}/api/materials/${mat.data.id}`, {
    method: "DELETE",
    headers: { cookie: teacher.cookie },
  });
  console.log("[deleteMaterial]", delRes.status);
  const afterDelete = await fetch(blob.url);
  console.log("[blobAfterDelete]", afterDelete.status);
}

console.log("DONE");

