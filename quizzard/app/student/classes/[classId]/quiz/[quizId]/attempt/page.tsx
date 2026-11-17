"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface QuestionSnapshot {
  questionBankItemId: string;
  type: string;
  content: Record<string, unknown>;
  shuffledOptionOrder?: number[];
}

interface Attempt {
  id: string;
  status: string;
  startedAt: string;
  timeLimitMinutes: number;
  questionSnapshot: QuestionSnapshot[];
  quiz: {
    id: string;
    timeLimitMinutes: number;
    deadline: string | null;
    lecture: {
      title: string;
      class: {
        name: string;
      };
    };
  };
}

interface Answer {
  type: string;
  selectedOptionIndex?: number;
  text?: string;
  value?: number;
}

export default function QuizAttemptPage({
  params,
}: {
  params: Promise<{ classId: string; quizId: string }>;
}) {
  const { classId, quizId } = use(params);
  const searchParams = useSearchParams();
  const attemptId = searchParams.get("attemptId");
  const router = useRouter();
  const { toast } = useToast();

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    if (attemptId) {
      fetchAttempt();
    } else {
      setIsLoading(false);
    }
  }, [attemptId]);

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!attempt || !attemptId || !hasUnsavedChanges) return;

    const saveInterval = setInterval(() => {
      saveAnswers();
    }, 30000);

    return () => clearInterval(saveInterval);
  }, [attempt, attemptId, answers, hasUnsavedChanges]);

  // Countdown timer
  useEffect(() => {
    if (!attempt || !timeLeft) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [attempt, timeLeft]);

  async function fetchAttempt() {
    if (!attemptId) return;

    try {
      const res = await fetch(`/api/attempts/${attemptId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Không thể tải lượt làm bài");
      }

      setAttempt(data.data);

      // Initialize time left
      if (data.data.startedAt && data.data.timeLimitMinutes) {
        const startedAt = new Date(data.data.startedAt);
        const endTime = new Date(startedAt.getTime() + data.data.timeLimitMinutes * 60000);
        const now = new Date();
        const remaining = Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000));
        setTimeLeft(remaining);
      }
    } catch (error) {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể tải lượt làm bài",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function saveAnswers() {
    if (!attemptId || Object.keys(answers).length === 0) return;

    try {
      const formattedAnswers = Object.entries(answers).map(([questionId, answer]) => ({
        questionBankItemId: questionId,
        answer,
      }));

      await fetch(`/api/attempts/${attemptId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: formattedAnswers }),
      });

      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Failed to save answers:", error);
    }
  }

  async function handleSubmit(isAutoSubmit = false) {
    if (!attemptId) return;
    setIsSubmitting(true);

    try {
      const formattedAnswers = Object.entries(answers).map(([questionId, answer]) => ({
        questionBankItemId: questionId,
        answer,
      }));

      const res = await fetch(`/api/attempts/${attemptId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: formattedAnswers }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Không thể nộp bài kiểm tra");
      }

      toast({
        title: isAutoSubmit ? "Hết thời gian!" : "Đã nộp bài kiểm tra",
        description: `Điểm của bạn: ${Math.round(data.data.score)}%`,
      });

      router.push(
        `/student/classes/${classId}/quiz/${quizId}/results?attemptId=${attemptId}`
      );
    } catch (error) {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể nộp bài kiểm tra",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  }

  function handleAnswerChange(questionId: string, answer: Answer) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: answer,
    }));
    setHasUnsavedChanges(true);
  }

  function formatTime(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  function getQuestionBadge(type: string) {
    const colors: Record<string, string> = {
      MCQ: "bg-blue-100 text-blue-700",
      SHORT_ANSWER: "bg-green-100 text-green-700",
      CALCULATION: "bg-orange-100 text-orange-700",
    };
    return (
      <Badge className={colors[type] || "bg-gray-100 text-gray-700"}>
        {type.replace("_", " ")}
      </Badge>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-full mb-6" />
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-12 w-32 ml-auto" />
        </div>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="p-6">
        <Card className="max-w-md mx-auto">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <h3 className="text-lg font-semibold mb-2">Không tìm thấy bài kiểm tra</h3>
            <p className="text-muted-foreground mb-4">
              Không thể tải lượt làm bài này
            </p>
            <Button variant="outline" onClick={() => router.push(`/student/classes/${classId}`)}>
              Quay lại lớp
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const questions = attempt.questionSnapshot || [];
  const currentQ = questions[currentQuestion];
  const answeredCount = Object.keys(answers).length;
  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="font-semibold">{attempt.quiz.lecture.title}</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {answeredCount} / {questions.length} đã trả lời
            </span>
            {timeLeft !== null && (
              <div
                className={`font-mono font-bold px-3 py-1 rounded ${
                  timeLeft < 60
                    ? "bg-red-100 text-red-700"
                    : timeLeft < 300
                    ? "bg-amber-100 text-amber-700"
                    : "bg-green-100 text-green-700"
                }`}
              >
                {formatTime(timeLeft)}
              </div>
            )}
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4 pb-3">
          <Progress value={progress} className="h-1" />
        </div>
      </header>

      {/* Question Content */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {currentQ && (
          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">
                  Câu {currentQuestion + 1} / {questions.length}
                </span>
                {getQuestionBadge(currentQ.type)}
              </div>
              {answers[currentQ.questionBankItemId] && (
                <Badge variant="default" className="bg-green-600">
                  Đã trả lời
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-lg font-medium">
                {String(currentQ.content.prompt || currentQ.content.promptTemplate || "")}
              </p>

              {currentQ.type === "MCQ" && (
                <div className="space-y-3">
                  {(currentQ.content.options as string[])?.map((option, idx) => (
                    <label
                      key={idx}
                      className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                        answers[currentQ.questionBankItemId]?.selectedOptionIndex === idx
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question-${currentQ.questionBankItemId}`}
                        checked={
                          answers[currentQ.questionBankItemId]?.selectedOptionIndex === idx
                        }
                        onChange={() =>
                          handleAnswerChange(currentQ.questionBankItemId, {
                            type: "MCQ",
                            selectedOptionIndex: idx,
                          })
                        }
                        className="h-4 w-4"
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              )}

              {currentQ.type === "SHORT_ANSWER" && (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Nhập câu trả lời của bạn..."
                    value={answers[currentQ.questionBankItemId]?.text || ""}
                    onChange={(e) =>
                      handleAnswerChange(currentQ.questionBankItemId, {
                        type: "SHORT_ANSWER",
                        text: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 rounded-lg border bg-background"
                  />
                </div>
              )}

              {currentQ.type === "CALCULATION" && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Nhập kết quả tính toán của bạn:
                  </p>
                  <input
                    type="number"
                    step="any"
                    placeholder="Nhập đáp án số..."
                    value={answers[currentQ.questionBankItemId]?.value || ""}
                    onChange={(e) =>
                      handleAnswerChange(currentQ.questionBankItemId, {
                        type: "CALCULATION",
                        value: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-4 py-3 rounded-lg border bg-background"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="outline"
            onClick={() => setCurrentQuestion((prev) => Math.max(0, prev - 1))}
            disabled={currentQuestion === 0}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-2"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Trước
          </Button>

          <div className="flex gap-1">
            {questions.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentQuestion(idx)}
                className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                  idx === currentQuestion
                    ? "bg-primary text-primary-foreground"
                    : answers[questions[idx]?.questionBankItemId]
                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>

          {currentQuestion < questions.length - 1 ? (
            <Button
              onClick={() => setCurrentQuestion((prev) => prev + 1)}
            >
              Tiếp theo
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="ml-2"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Button>
          ) : (
            <Button
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Đang nộp..." : "Nộp bài"}
            </Button>
          )}
        </div>

        {/* Submit Section */}
        {currentQuestion === questions.length - 1 && (
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <p className="text-center text-sm text-muted-foreground mb-4">
              {answeredCount === questions.length
                ? "Đã trả lời tất cả câu hỏi. Sẵn sàng nộp bài!"
                : `Bạn còn ${questions.length - answeredCount} câu hỏi chưa trả lời.`}
            </p>
            <div className="flex justify-center gap-4">
              <Button
                variant="outline"
                onClick={saveAnswers}
                disabled={!hasUnsavedChanges}
              >
                {hasUnsavedChanges ? "Lưu tiến độ" : "Đã lưu tiến độ"}
              </Button>
              <Button
                onClick={() => handleSubmit(false)}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Đang nộp..." : "Nộp bài"}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
