// End-to-end check of the AI lecture planner against a running server.
// Usage: node scripts/e2e-chat.mjs [baseUrl]
import fs from "node:fs";
import path from "node:path";
import { upload } from "@vercel/blob/client";

const BASE = process.argv[2] || "http://localhost:3111";

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
const stamp = Date.now();

const signup = await teacher.api("/api/auth/signup", {
  method: "POST",
  body: {
    email: `teacher${stamp}@quizzard.test`,
    password: "TestPass123!",
    name: "Test Teacher",
    role: "TEACHER",
  },
});
console.log("[signup]", signup.status);

const cls = await teacher.api("/api/classes", {
  method: "POST",
  body: { name: "Chat Verification Class", description: "e2e", classPassword: "join123" },
});
const classId = cls.json?.data?.id;
console.log("[createClass]", cls.status, "classId:", classId);

const pdf = fs.readFileSync(path.join(import.meta.dirname, "test-lecture.pdf"));
const file = new File([pdf], "lecture.pdf", { type: "application/pdf" });
const blob = await upload(`materials/${stamp}-lecture.pdf`, file, {
  access: "public",
  handleUploadUrl: `${BASE}/api/materials/upload`,
  clientPayload: JSON.stringify({ classId }),
  contentType: "application/pdf",
  headers: { cookie: teacher.cookie },
});
console.log("[blobUpload]", blob.url);

const mat = await teacher.api("/api/materials", {
  method: "POST",
  body: { classId, fileName: "lecture.pdf", url: blob.url },
});
const materialId = mat.json?.data?.id;
console.log("[createMaterial]", mat.status, "status:", mat.json?.data?.status, "id:", materialId);
console.log("[extractedText length]", (mat.json?.data?.extractedText ?? "").length);

if (mat.json?.data?.status !== "PROCESSED") {
  console.log("MATERIAL NOT PROCESSED - aborting chat test");
  process.exit(1);
}

// ---- lecture planner ----
const t0 = Date.now();
const start = await teacher.api(`/api/materials/${materialId}/chat`, {
  method: "POST",
  body: { action: "start", materialId, classId },
});
console.log(
  `[chat.start] ${start.status} in ${Date.now() - t0}ms`,
  JSON.stringify(start.json).slice(0, 700)
);

const proposals = start.json?.data?.proposals ?? [];
if (!proposals.length) {
  console.log("NO PROPOSALS - aborting");
  process.exit(1);
}

// follow-up message (stateless: the client sends the proposals back)
const msg = await teacher.api(`/api/materials/${materialId}/chat`, {
  method: "POST",
  body: {
    action: "message",
    materialId,
    message: "Please keep it to three lectures.",
    proposals,
  },
});
console.log(`[chat.message] ${msg.status}`, JSON.stringify(msg.json).slice(0, 400));

const currentProposals = msg.json?.data?.proposals?.length ? msg.json.data.proposals : proposals;

const t1 = Date.now();
const confirm = await teacher.api(`/api/materials/${materialId}/chat`, {
  method: "POST",
  body: { action: "confirm", materialId, proposals: currentProposals },
});
console.log(`[chat.confirm] ${confirm.status} in ${Date.now() - t1}ms`, JSON.stringify(confirm.json).slice(0, 700));

const lectures = await teacher.api(`/api/lectures?classId=${classId}`);
console.log("[lectures]", lectures.status, JSON.stringify(lectures.json).slice(0, 600));

console.log("DONE");
