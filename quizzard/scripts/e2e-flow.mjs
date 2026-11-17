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
let failures = 0;

function log(label, r, expected = [200, 201]) {
  const body = typeof r.json === "string" ? r.json : JSON.stringify(r.json);
  const ok = expected.includes(r.status);
  if (!ok) failures++;
  console.log(`[${ok ? "OK  " : "FAIL"}] ${label} ${r.status} ${body.slice(0, 260)}`);
  return r.json;
}

// ---------------- teacher ----------------
log(
  "signupTeacher",
  await teacher.api("/api/auth/signup", {
    method: "POST",
    body: {
      email: `t${Date.now()}@quizzard.test`,
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
    body: { name: "AI Class", classPassword: "join123" },
  })
);
const classId = cls?.data?.id;
const classCode = cls?.data?.classCode;

const lecture = log(
  "createLecture",
  await teacher.api("/api/lectures", {
    method: "POST",
    body: { classId, title: "Lecture 1: Quantum Mechanics" },
  })
);

const quiz = log(
  "createQuiz",
  await teacher.api("/api/quizzes", {
    method: "POST",
    body: {
      lectureId: lecture?.data?.id,
      instructions: "Answer the questions about quantum mechanics.",
      questionsPerAttempt: 3,
      timeLimitMinutes: 10,
    },
  })
);
const quizId = quiz?.data?.id;

console.log("...calling AI generation");
const gen = log(
  "generate",
  await teacher.api(`/api/quizzes/${quizId}/question-bank/generate`, {
    method: "POST",
    body: { count: 3 },
  })
);
console.log("generated:", gen?.data?.count, "usedFallback:", gen?.data?.usedFallback);
if (gen?.data?.questions?.length) {
  console.log("sample:", JSON.stringify(gen.data.questions[0]).slice(0, 400));
}

// ---------------- approve every generated question ----------------
const bank = log(
  "listQuestionBank",
  await teacher.api(`/api/quizzes/${quizId}/question-bank`)
);
const items = Array.isArray(bank?.data) ? bank.data : [];
console.log("bank items:", items.length);
for (const item of items) {
  if (item.status === "APPROVED") continue;
  log(
    `approve ${item.id}`,
    await teacher.api(`/api/quizzes/${quizId}/question-bank/${item.id}/status`, {
      method: "PUT",
      body: { status: "APPROVED" },
    })
  );
}

const pub = log(
  "publish",
  await teacher.api(`/api/quizzes/${quizId}/publish`, { method: "POST" })
);
console.log("quiz status:", pub?.data?.status);

// ---------------- student ----------------
log(
  "signupStudent",
  await student.api("/api/auth/signup", {
    method: "POST",
    body: {
      email: `s${Date.now()}@quizzard.test`,
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

const start = log(
  "startAttempt",
  await student.api("/api/attempts", { method: "POST", body: { quizId } })
);
const attemptId = start?.data?.id;
const snapshot = start?.data?.questionSnapshot ?? [];

if (attemptId && snapshot.length) {
  console.log("questions in attempt:", snapshot.length);

  const answers = snapshot.map((q) => {
    if (q.type === "MCQ") {
      return {
        questionBankItemId: q.questionBankItemId,
        answer: { type: "MCQ", selectedOptionIndex: 0 },
      };
    }
    if (q.type === "SHORT_ANSWER") {
      return {
        questionBankItemId: q.questionBankItemId,
        answer: { type: "SHORT_ANSWER", text: "test answer" },
      };
    }
    return {
      questionBankItemId: q.questionBankItemId,
      answer: { type: "CALCULATION", value: 1 },
    };
  });

  const sub = log(
    "submitAttempt",
    await student.api(`/api/attempts/${attemptId}/submit`, {
      method: "POST",
      body: { answers },
    })
  );
  console.log("result:", JSON.stringify(sub?.data).slice(0, 300));
} else {
  failures++;
  console.log("[FAIL] no attempt id or empty snapshot");
}

log("leaderboard", await teacher.api(`/api/quizzes/${quizId}/leaderboard`));

console.log(failures === 0 ? "ALL CHECKS PASSED" : `FAILURES: ${failures}`);
console.log("DONE");
process.exit(failures === 0 ? 0 : 1);

