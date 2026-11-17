// End-to-end check of the question bank generator against a running server.
// Usage: node scripts/e2e-qb-chat.mjs [baseUrl]
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

await teacher.api("/api/auth/signup", {
  method: "POST",
  body: {
    email: `qbteacher${stamp}@quizzard.test`,
    password: "TestPass123!",
    name: "QB Teacher",
    role: "TEACHER",
  },
});

const cls = await teacher.api("/api/classes", {
  method: "POST",
  body: { name: "QB Verification Class", description: "e2e", classPassword: "join123" },
});
const classId = cls.json?.data?.id;

const pdf = fs.readFileSync(path.join(import.meta.dirname, "test-lecture.pdf"));
const file = new File([pdf], "lecture.pdf", { type: "application/pdf" });
const blob = await upload(`materials/${stamp}-lecture.pdf`, file, {
  access: "public",
  handleUploadUrl: `${BASE}/api/materials/upload`,
  clientPayload: JSON.stringify({ classId }),
  contentType: "application/pdf",
  headers: { cookie: teacher.cookie },
});

const mat = await teacher.api("/api/materials", {
  method: "POST",
  body: { classId, fileName: "lecture.pdf", url: blob.url },
});
const materialId = mat.json?.data?.id;
console.log("[material]", mat.json?.data?.status);

const lecture = await teacher.api("/api/lectures", {
  method: "POST",
  body: { classId, title: "Quantum Mechanics", materialId },
});
const lectureId = lecture.json?.data?.id;

const quiz = await teacher.api("/api/quizzes", {
  method: "POST",
  body: { lectureId, instructions: "Wave functions and quantised energy levels", questionsPerAttempt: 2, timeLimitMinutes: 30 },
});
const quizId = quiz.json?.data?.id;
console.log("[quiz]", quiz.status, quizId);

const start = await teacher.api(`/api/quizzes/${quizId}/chat`, {
  method: "POST",
  body: { action: "start", quizId },
});
console.log("[qb.start]", start.status, JSON.stringify(start.json).slice(0, 300));

const plan = {
  MCQ: { enabled: true, count: 1, distribution: { easy: 1, medium: 0, hard: 0 } },
  SHORT_ANSWER: { enabled: false, count: 0, distribution: { easy: 0, medium: 0, hard: 0 } },
  CALCULATION: { enabled: false, count: 0, distribution: { easy: 0, medium: 0, hard: 0 } },
};

const save = await teacher.api(`/api/quizzes/${quizId}/chat`, {
  method: "POST",
  body: { action: "savePlan", quizId, plan },
});
console.log("[qb.savePlan]", save.status, JSON.stringify(save.json).slice(0, 200));

const t0 = Date.now();
const gen = await teacher.api(`/api/quizzes/${quizId}/chat`, {
  method: "POST",
  body: { action: "generate", quizId, plan },
});
console.log(`[qb.generate] ${gen.status} in ${Date.now() - t0}ms`, JSON.stringify(gen.json).slice(0, 500));

const bank = await teacher.api(`/api/quizzes/${quizId}/question-bank`);
console.log("[questionBank]", bank.status, JSON.stringify(bank.json).slice(0, 500));

console.log("DONE");
