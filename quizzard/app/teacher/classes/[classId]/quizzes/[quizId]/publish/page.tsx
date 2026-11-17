"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface Question {
  id: string;
  status: string;
}

interface QuizData {
  id: string;
  status: string;
  deadline: string | null;
  lecture: {
    id: string;
    title: string;
    class: {
      id: string;
      name: string;
    };
  };
  _count: {
    questionBank: number;
    attempts: number;
  };
}

export default function PublishQuizPage({
  params,
}: {
  params: Promise<{ classId: string; quizId: string }>;
}) {
  const { classId, quizId } = use(params);
  const router = useRouter();
  const { toast } = useToast();

  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [deadline, setDeadline] = useState("");

  useEffect(() => {
    fetchData();
  }, [quizId]);

  async function fetchData() {
    try {
      const [quizRes, questionsRes] = await Promise.all([
        fetch(`/api/quizzes/${quizId}`),
        fetch(`/api/quizzes/${quizId}/question-bank`),
      ]);

      const quizData = await quizRes.json();
      const questionsData = await questionsRes.json();

      if (quizData.data) {
        setQuiz(quizData.data);
        if (quizData.data.deadline) {
          const date = new Date(quizData.data.deadline);
          setDeadline(date.toISOString().slice(0, 16));
        }
      }
      if (questionsData.data) {
        setQuestions(questionsData.data);
      }
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể tải bài kiểm tra",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePublish() {
    setIsPublishing(true);

    try {
      const res = await fetch(`/api/quizzes/${quizId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deadline: deadline ? new Date(deadline).toISOString() : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Không thể xuất bản bài kiểm tra");
      }

      toast({
        title: "Thành công",
        description: "Đã xuất bản bài kiểm tra thành công",
      });

      router.push(`/teacher/classes/${classId}/quizzes/${quizId}`);
    } catch (error) {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể xuất bản bài kiểm tra",
        variant: "destructive",
      });
    } finally {
      setIsPublishing(false);
    }
  }

  const approvedCount = questions.filter((q) => q.status === "APPROVED").length;
  const totalCount = questions.length;
  const allApproved = totalCount > 0 && approvedCount === totalCount;
  const canPublish = allApproved && quiz?.status !== "PUBLISHED";

  if (isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="p-6">
        <Card className="flex flex-col items-center justify-center py-12">
          <h3 className="text-lg font-semibold mb-2">Không tìm thấy bài kiểm tra</h3>
          <Button variant="outline" onClick={() => router.push(`/teacher/classes/${classId}`)}>
            Quay lại lớp
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/teacher/classes/${classId}/quizzes/${quizId}`)}
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
          {quiz.lecture.title}
        </Button>
      </div>
      <h1 className="text-2xl font-bold mb-1">Xuất bản bài kiểm tra</h1>
      <p className="text-muted-foreground mb-6">
        Xem xét và xuất bản bài kiểm tra cho học sinh
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tóm tắt bài kiểm tra</CardTitle>
            <CardDescription>
              Xem lại chi tiết bài kiểm tra trước khi xuất bản
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">Trạng thái</span>
              <Badge variant={quiz.status === "PUBLISHED" ? "default" : "secondary"}>
                {quiz.status === "PUBLISHED" ? "Đã xuất bản" : "Nháp"}
              </Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">Buổi giảng</span>
              <span className="font-medium">{quiz.lecture.title}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">Tổng số câu hỏi</span>
              <span className="font-medium">{totalCount}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">Câu hỏi đã duyệt</span>
              <span className="font-medium">
                {approvedCount} / {totalCount}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-muted-foreground">Lượt làm bài của học sinh</span>
              <span className="font-medium">{quiz._count.attempts}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Danh sách kiểm tra trước khi xuất bản</CardTitle>
            <CardDescription>
              Hoàn tất tất cả các mục trước khi xuất bản
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              {allApproved ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-green-500 mt-0.5"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-amber-500 mt-0.5"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              )}
              <div>
                <p className="font-medium">Đã duyệt tất cả câu hỏi</p>
                <p className="text-sm text-muted-foreground">
                  {allApproved
                    ? "Tất cả câu hỏi đã được xem xét và phê duyệt"
                    : `${approvedCount} of ${totalCount} questions approved`}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-green-500 mt-0.5"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <div>
                <p className="font-medium">Xem lại hướng dẫn</p>
                <p className="text-sm text-muted-foreground">
                  Cài đặt bài kiểm tra đã được thiết lập
                </p>
              </div>
            </div>

            {quiz.status === "PUBLISHED" ? (
              <div className="flex items-start gap-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-blue-500 mt-0.5"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <div>
                  <p className="font-medium">Bài kiểm tra đã được xuất bản</p>
                  <p className="text-sm text-muted-foreground">
                    Học sinh có thể làm bài kiểm tra này
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-muted-foreground mt-0.5"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <div>
                  <p className="font-medium">Đặt hạn chót (không bắt buộc)</p>
                  <p className="text-sm text-muted-foreground">
                    Học sinh phải bắt đầu trước ngày này
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {quiz.status !== "PUBLISHED" && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Đặt hạn chót</CardTitle>
              <CardDescription>
                Tùy chọn đặt hạn chót để học sinh bắt đầu bài kiểm tra
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-4">
                <div className="space-y-2 flex-1">
                  <Label htmlFor="deadline">Hạn chót</Label>
                  <Input
                    id="deadline"
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                  />
                </div>
                {deadline && (
                  <Button
                    variant="outline"
                    onClick={() => setDeadline("")}
                  >
                    Xóa
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Nếu không đặt hạn chót, học sinh có thể làm bài bất cứ lúc nào. Bạn luôn có thể gia hạn sau.
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Sẵn sàng xuất bản?</CardTitle>
            <CardDescription>
              {quiz.status === "PUBLISHED"
                ? "Bài kiểm tra đang hoạt động. Bạn vẫn có thể gia hạn."
                : "Sau khi xuất bản, học sinh sẽ có thể xem và làm bài kiểm tra này."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {quiz.status !== "PUBLISHED" && (
              <div className="bg-muted/50 rounded-lg p-4 text-sm">
                <p className="font-medium mb-2">Sau khi xuất bản:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Nội dung câu hỏi sẽ được cố định</li>
                  <li>Học sinh có thể nhìn thấy và bắt đầu bài kiểm tra</li>
                  <li>Bạn chỉ có thể kéo dài (không rút ngắn) hạn chót</li>
                  <li>Các báo cáo từ học sinh sẽ xuất hiện trong mục Báo cáo</li>
                </ul>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => router.push(`/teacher/classes/${classId}/quizzes/${quizId}`)}
              >
                Quay lại bài kiểm tra
              </Button>
              {quiz.status !== "PUBLISHED" ? (
                <Button
                  onClick={handlePublish}
                  disabled={!canPublish || isPublishing}
                >
                  {isPublishing ? "Đang xuất bản..." : "Xuất bản bài kiểm tra"}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => router.push(`/teacher/classes/${classId}`)}
                >
                  Xong
                </Button>
              )}
            </div>

            {!allApproved && (
              <p className="text-sm text-amber-600">
                Tất cả câu hỏi phải được duyệt trước khi xuất bản.{" "}
                <a
                  href={`/teacher/classes/${classId}/quizzes/${quizId}/question-bank`}
                  className="underline"
                >
                  Xem lại câu hỏi
                </a>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
