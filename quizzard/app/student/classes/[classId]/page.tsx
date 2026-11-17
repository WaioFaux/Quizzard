"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface Lecture {
  id: string;
  title: string;
  order: number;
  quiz: {
    id: string;
    status: string;
    deadline: string | null;
    timeLimitMinutes: number;
    questionsPerAttempt: number;
  } | null;
}

interface Attempt {
  id: string;
  quizId: string;
  status: string;
  score: number | null;
  createdAt: string;
}

interface ClassData {
  id: string;
  name: string;
  description: string | null;
  classCode: string;
  teacher: {
    id: string;
    name: string;
  };
  lectures: Lecture[];
  _count: {
    enrollments: number;
  };
}

export default function StudentClassOverviewPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = use(params);
  const router = useRouter();
  const { toast } = useToast();

  const [cls, setClass] = useState<ClassData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [attempts, setAttempts] = useState<Record<string, Attempt>>({});

  useEffect(() => {
    fetchClass();
    fetchAttempts();
  }, [classId]);

  async function fetchClass() {
    try {
      const res = await fetch(`/api/classes/${classId}`);
      const data = await res.json();
      if (data.data) {
        setClass(data.data);
      }
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể tải thông tin lớp",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchAttempts() {
    try {
      const res = await fetch("/api/attempts");
      const data = await res.json();
      if (data.data && Array.isArray(data.data)) {
        // Build a map of quizId -> attempt for quick lookup
        const attemptMap: Record<string, Attempt> = {};
        for (const attempt of data.data) {
          // Only keep the most recent attempt per quiz
          if (!attemptMap[attempt.quizId] || 
              new Date(attempt.createdAt) > new Date(attemptMap[attempt.quizId].createdAt)) {
            attemptMap[attempt.quizId] = attempt;
          }
        }
        setAttempts(attemptMap);
      }
    } catch (error) {
      console.error("Failed to fetch attempts:", error);
    }
  }

  function getQuizStatus(quiz: Lecture["quiz"]) {
    if (!quiz) return null;

    const attempt = attempts[quiz.id];
    if (attempt) {
      return { label: "Đã hoàn thành", variant: "default" as const };
    }

    if (quiz.status === "PUBLISHED") {
      if (quiz.deadline && new Date(quiz.deadline) < new Date()) {
        return { label: "Đã quá hạn", variant: "destructive" as const };
      }
      return { label: "Đang mở", variant: "default" as const };
    }
    return { label: "Sắp mở", variant: "secondary" as const };
  }

  function formatDeadline(deadline: string | null) {
    if (!deadline) return "Không hạn chót";
    const date = new Date(deadline);
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff < 0) return "Đã quá hạn";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Hạn chót hôm nay";
    if (days === 1) return "Hạn chót ngày mai";
    if (days < 7) return `Hạn chót sau ${days} ngày`;

    return `Hạn chót ${date.toLocaleDateString("vi-VN")}`;
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
          <div className="h-64 bg-muted rounded mt-6"></div>
        </div>
      </div>
    );
  }

  if (!cls) {
    return (
      <div className="p-6">
        <Card className="flex flex-col items-center justify-center py-12">
          <h3 className="text-lg font-semibold mb-2">Không tìm thấy lớp</h3>
          <Button variant="outline" onClick={() => router.push("/student/classes")}>
            Quay lại danh sách lớp
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-1">
        <Button variant="ghost" size="sm" onClick={() => router.push("/student/classes")}>
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
          Lớp của tôi
        </Button>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{cls.name}</h1>
          <p className="text-muted-foreground mt-1">
            Giáo viên: {cls.teacher.name}
          </p>
          {cls.description && (
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              {cls.description}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/student/classes/${classId}/full-leaderboard`)}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-2"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            Bảng xếp hạng lớp
          </Button>
          <Button variant="outline" onClick={() => router.push(`/student/classes/${classId}/leaderboard`)}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-2"
            >
              <path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12" />
              <path d="M12 2v8" />
              <path d="M12 18v4" />
              <path d="M4.04 11.071a3 3 0 0 1 0-1.142" />
              <path d="M19.96 11.071a3 3 0 0 0 0-1.142" />
              <path d="M12 10v4" />
            </svg>
            Theo từng bài
          </Button>
        </div>
        <Button variant="outline" onClick={() => router.push("/student/classes/join")}>
          Rời lớp
        </Button>
      </div>

      <div className="space-y-4">
        {cls.lectures.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">Chưa có bài kiểm tra nào</p>
            <p className="text-sm text-muted-foreground mt-1">
              Hãy quay lại sau để xem các bài kiểm tra từ giáo viên của bạn
            </p>
          </Card>
        ) : (
          cls.lectures.map((lecture) => {
            const quiz = lecture.quiz;
            const status = getQuizStatus(quiz);
            const attempt = quiz ? attempts[quiz.id] : null;
            const isCompleted = !!attempt;
            const isAvailable = quiz?.status === "PUBLISHED" && !isCompleted;

            return (
              <Card key={lecture.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted text-lg font-bold">
                      {lecture.order}
                    </div>
                    <div>
                      <p className="font-medium">{lecture.title}</p>
                      {quiz && (
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <span>{quiz.questionsPerAttempt} câu hỏi</span>
                          <span className="text-muted-foreground/50">|</span>
                          <span>{quiz.timeLimitMinutes} phút</span>
                          <span className="text-muted-foreground/50">|</span>
                          <span>{formatDeadline(quiz.deadline)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {status && (
                      <Badge variant={status.variant}>{status.label}</Badge>
                    )}
                    {isCompleted && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          router.push(`/student/classes/${classId}/quiz/${quiz?.id}/results?attemptId=${attempt.id}`)
                        }
                      >
                        Xem kết quả
                      </Button>
                    )}
                    {isAvailable && (
                      <Button
                        size="sm"
                        onClick={() => router.push(`/student/classes/${classId}/quiz/${quiz.id}`)}
                      >
                        Bắt đầu làm bài
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
