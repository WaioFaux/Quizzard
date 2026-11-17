"use client";

import { useState, useEffect, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface QuestionSnapshot {
  questionBankItemId: string;
  type: string;
  content: Record<string, unknown>;
}

interface StudentAnswer {
  id: string;
  questionBankItemId: string;
  answer: Record<string, unknown>;
  correctAnswerSnapshot: Record<string, unknown> | null;
  isCorrect: boolean | null;
  pointsAwarded: number;
}

interface Attempt {
  id: string;
  status: string;
  score: number;
  startedAt: string;
  submittedAt: string | null;
  questionSnapshot: QuestionSnapshot[];
  answers: StudentAnswer[];
  quiz: {
    id: string;
    questionsPerAttempt: number;
    timeLimitMinutes: number;
    lecture: {
      title: string;
      class: {
        id: string;
        name: string;
      };
    };
  };
}

export default function QuizResultsPage({
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
  const [selectedAnswer, setSelectedAnswer] = useState<StudentAnswer | null>(null);
  const [reportDescription, setReportDescription] = useState("");
  const [isReporting, setIsReporting] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);

  useEffect(() => {
    if (attemptId) {
      fetchAttempt();
    } else {
      setIsLoading(false);
    }
  }, [attemptId]);

  async function fetchAttempt() {
    if (!attemptId) return;

    try {
      const res = await fetch(`/api/attempts/${attemptId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Không thể tải kết quả");
      }

      setAttempt(data.data);
    } catch (error) {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể tải kết quả",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleReport() {
    if (!selectedAnswer || reportDescription.length < 10) return;

    setIsReporting(true);

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentAnswerId: selectedAnswer.id,
          description: reportDescription,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Không thể gửi báo cáo");
      }

      toast({
        title: "Thành công",
        description: "Đã gửi báo cáo. Giáo viên sẽ xem xét.",
      });

      setShowReportDialog(false);
      setSelectedAnswer(null);
      setReportDescription("");
    } catch (error) {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể gửi báo cáo",
        variant: "destructive",
      });
    } finally {
      setIsReporting(false);
    }
  }

  function getScoreColor(score: number) {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-amber-600";
    return "text-red-600";
  }

  function getScoreLabel(score: number) {
    if (score >= 90) return "Xuất sắc!";
    if (score >= 80) return "Làm tốt lắm!";
    if (score >= 70) return "Tốt lắm!";
    if (score >= 60) return "Tiếp tục luyện tập!";
    return "Cần cải thiện thêm";
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="p-6">
        <Card className="max-w-md mx-auto">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <h3 className="text-lg font-semibold mb-2">Không tìm thấy kết quả</h3>
            <p className="text-muted-foreground mb-4">
              Không thể tải kết quả bài kiểm tra này
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
  const correctCount = attempt.answers.filter((a) => a.isCorrect).length;
  const totalCount = questions.length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/student/classes/${classId}`)}
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
            className="mr-1"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          {attempt.quiz.lecture.class.name}
        </Button>
      </div>

      {/* Score Summary */}
      <Card className="mb-6">
        <CardHeader className="text-center pb-2">
          <CardDescription>{attempt.quiz.lecture.title}</CardDescription>
          <CardTitle className="text-2xl">Kết quả bài kiểm tra</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <div className="flex items-center justify-center gap-12 py-6">
            <div>
              <p className={`text-5xl font-bold ${getScoreColor(attempt.score)}`}>
                {Math.round(attempt.score)}%
              </p>
              <p className="text-sm text-muted-foreground mt-1">Điểm</p>
            </div>
            <div className="h-16 w-px bg-border"></div>
            <div>
              <p className="text-5xl font-bold">
                {correctCount}<span className="text-2xl text-muted-foreground">/{totalCount}</span>
              </p>
              <p className="text-sm text-muted-foreground mt-1">Đúng</p>
            </div>
          </div>
          <p className={`text-lg font-medium ${getScoreColor(attempt.score)}`}>
            {getScoreLabel(attempt.score)}
          </p>
          {attempt.submittedAt && (
            <p className="text-sm text-muted-foreground mt-2">
              Nộp lúc {new Date(attempt.submittedAt).toLocaleString("vi-VN")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Question Breakdown */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Chi tiết từng câu hỏi</h2>
        {questions.map((question, idx) => {
          const answer = attempt.answers.find(
            (a) => a.questionBankItemId === question.questionBankItemId
          );
          const isCorrect = answer?.isCorrect ?? false;

          return (
            <Card key={question.questionBankItemId}>
              <CardContent className="py-4">
                <div className="flex items-start gap-4">
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      isCorrect
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {isCorrect ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm text-muted-foreground">
                        Câu {idx + 1}
                      </span>
                      <Badge
                        variant="secondary"
                        className={
                          question.type === "MCQ"
                            ? "bg-blue-100 text-blue-700"
                            : question.type === "SHORT_ANSWER"
                            ? "bg-green-100 text-green-700"
                            : "bg-orange-100 text-orange-700"
                        }
                      >
                        {question.type.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="font-medium mb-2">
                      {String(question.content.prompt || question.content.promptTemplate || "")}
                    </p>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        <span className="text-muted-foreground w-20">Câu trả lời của bạn:</span>
                        <span className={isCorrect ? "text-green-600" : "text-red-600"}>
                          {answer?.answer?.selectedOptionIndex !== undefined
                            ? String(
                                (question.content.options as string[])?.[answer.answer.selectedOptionIndex as number] ||
                                  "Chưa trả lời"
                              )
                            : answer?.answer?.text ||
                              (answer?.answer?.value !== undefined
                                ? String(answer.answer.value)
                                : "Chưa trả lời")}
                        </span>
                      </div>
                      {!isCorrect && answer?.correctAnswerSnapshot && (
                        <div className="flex items-start gap-2">
                          <span className="text-muted-foreground w-20">
                            Đáp án đúng:
                          </span>
                          <span className="text-green-600 font-medium">
                            {answer.correctAnswerSnapshot.correctIndex !== undefined
                              ? String(
                                  (question.content.options as string[])?.[
                                    answer.correctAnswerSnapshot.correctIndex as number
                                  ]
                                )
                              : answer.correctAnswerSnapshot.correctAnswer ||
                                (answer.correctAnswerSnapshot.correctValue !== undefined
                                  ? String(answer.correctAnswerSnapshot.correctValue)
                                  : "")}
                          </span>
                        </div>
                      )}
                      {question.content.explanation && (
                        <div className="flex items-start gap-2 bg-muted/50 p-2 rounded">
                          <span className="text-muted-foreground w-20">
                            Giải thích:
                          </span>
                          <span className="text-muted-foreground">
                            {String(question.content.explanation)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedAnswer(answer || null);
                      setShowReportDialog(true);
                    }}
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
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="12" y1="18" x2="12" y2="12" />
                      <line x1="12" y1="9" x2="12.01" y2="9" />
                    </svg>
                    Báo cáo
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-4 mt-8">
        <Button variant="outline" onClick={() => router.push(`/student/classes/${classId}`)}>
          Quay lại lớp
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            router.push(`/student/leaderboard?quizId=${quizId}&classId=${classId}`)
          }
        >
          Xem bảng xếp hạng
        </Button>
      </div>

      {/* Report Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Báo cáo vấn đề</DialogTitle>
            <DialogDescription>
              Báo cáo vấn đề với câu hỏi này cho giáo viên của bạn
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <p className="text-sm font-medium mb-1">Câu hỏi:</p>
              <p className="text-sm bg-muted p-3 rounded">
                {selectedAnswer &&
                  String(
                    questions.find(
                      (q) => q.questionBankItemId === selectedAnswer.questionBankItemId
                    )?.content.prompt ||
                      questions.find(
                        (q) =>
                          q.questionBankItemId === selectedAnswer.questionBankItemId
                      )?.content.promptTemplate ||
                      ""
                  )}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Vấn đề là gì?</label>
              <Textarea
                placeholder="Mô tả vấn đề với câu hỏi này (tối thiểu 10 ký tự)..."
                rows={4}
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {reportDescription.length}/10 ký tự tối thiểu
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowReportDialog(false);
                setReportDescription("");
              }}
            >
              Hủy
            </Button>
            <Button
              onClick={handleReport}
              disabled={reportDescription.length < 10 || isReporting}
            >
              {isReporting ? "Đang gửi..." : "Gửi báo cáo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
