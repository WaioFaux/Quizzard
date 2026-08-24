-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Class" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "classCode" TEXT NOT NULL,
    "classPassword" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "teacherId" TEXT NOT NULL,
    CONSTRAINT "Class_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "classId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    CONSTRAINT "Enrollment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "extractedText" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "classId" TEXT NOT NULL,
    CONSTRAINT "Material_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Lecture" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "sourceRef" JSONB,
    "order" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "classId" TEXT NOT NULL,
    "materialId" TEXT,
    CONSTRAINT "Lecture_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Lecture_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instructions" TEXT NOT NULL,
    "questionsPerAttempt" INTEGER NOT NULL,
    "timeLimitMinutes" INTEGER NOT NULL,
    "deadline" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lectureId" TEXT NOT NULL,
    CONSTRAINT "Quiz_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionBankItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "source" TEXT NOT NULL DEFAULT 'AI_GENERATED',
    "reviewNote" TEXT,
    "generationInstruction" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "quizId" TEXT NOT NULL,
    CONSTRAINT "QuestionBankItem_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionSnapshot" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "score" REAL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" DATETIME,
    "quizId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    CONSTRAINT "StudentAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "answer" JSONB NOT NULL,
    "correctAnswerSnapshot" JSONB,
    "isCorrect" BOOLEAN,
    "pointsAwarded" REAL,
    "attemptId" TEXT NOT NULL,
    "questionBankItemId" TEXT NOT NULL,
    CONSTRAINT "StudentAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "StudentAttempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentAnswer_questionBankItemId_fkey" FOREIGN KEY ("questionBankItemId") REFERENCES "QuestionBankItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "teacherNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "studentAnswerId" TEXT NOT NULL,
    CONSTRAINT "QuestionReport_studentAnswerId_fkey" FOREIGN KEY ("studentAnswerId") REFERENCES "StudentAnswer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Class_classCode_key" ON "Class"("classCode");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_classId_studentId_key" ON "Enrollment"("classId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Lecture_classId_order_key" ON "Lecture"("classId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Quiz_lectureId_key" ON "Quiz"("lectureId");

-- CreateIndex
CREATE INDEX "Quiz_status_idx" ON "Quiz"("status");

-- CreateIndex
CREATE INDEX "Quiz_deadline_idx" ON "Quiz"("deadline");

-- CreateIndex
CREATE INDEX "QuestionBankItem_quizId_idx" ON "QuestionBankItem"("quizId");

-- CreateIndex
CREATE INDEX "QuestionBankItem_status_idx" ON "QuestionBankItem"("status");

-- CreateIndex
CREATE INDEX "StudentAttempt_quizId_idx" ON "StudentAttempt"("quizId");

-- CreateIndex
CREATE INDEX "StudentAttempt_studentId_idx" ON "StudentAttempt"("studentId");

-- CreateIndex
CREATE INDEX "StudentAttempt_status_idx" ON "StudentAttempt"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAttempt_quizId_studentId_key" ON "StudentAttempt"("quizId", "studentId");

-- CreateIndex
CREATE INDEX "StudentAnswer_attemptId_idx" ON "StudentAnswer"("attemptId");

-- CreateIndex
CREATE INDEX "StudentAnswer_questionBankItemId_idx" ON "StudentAnswer"("questionBankItemId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAnswer_attemptId_questionBankItemId_key" ON "StudentAnswer"("attemptId", "questionBankItemId");

-- CreateIndex
CREATE INDEX "QuestionReport_studentAnswerId_idx" ON "QuestionReport"("studentAnswerId");

-- CreateIndex
CREATE INDEX "QuestionReport_status_idx" ON "QuestionReport"("status");
