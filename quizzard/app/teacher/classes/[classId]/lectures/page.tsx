"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface Lecture {
  id: string;
  title: string;
  order: number;
  sourceRef: unknown;
  material: {
    id: string;
    fileName: string;
  } | null;
  quiz: {
    id: string;
    status: string;
    deadline: string | null;
    questionsPerAttempt: number;
    timeLimitMinutes: number;
    _count: {
      questionBank: number;
      attempts: number;
    };
  } | null;
}

interface ClassInfo {
  id: string;
  name: string;
  teacherId: string;
}

export default function LecturesPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = use(params);
  const router = useRouter();
  const { toast } = useToast();

  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLectures();
  }, [classId]);

  async function fetchLectures() {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/lectures?classId=${classId}`);
      const data = await res.json();

      if (data.data) {
        setLectures(data.data);

        // Get class info from first lecture
        if (data.data.length > 0) {
          setClassInfo({
            id: classId,
            name: data.data[0].class?.name || "Class",
            teacherId: "",
          });
        }
      }
    } catch (error) {
      console.error("[LecturesPage] Error fetching lectures:", error);
      toast({
        title: "Lỗi",
        description: "Không thể tải danh sách buổi giảng",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteLecture(lectureId: string) {
    if (!confirm("Bạn có chắc muốn xóa buổi giảng này? Bài kiểm tra và các lượt làm bài liên quan cũng sẽ bị xóa.")) {
      return;
    }

    try {
      const res = await fetch(`/api/lectures/${lectureId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Không thể xóa buổi giảng");
      }

      toast({
        title: "Thành công",
        description: "Xóa buổi giảng thành công",
      });

      fetchLectures();
    } catch (error) {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể xóa buổi giảng",
        variant: "destructive",
      });
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "DRAFT":
        return <Badge variant="secondary">Nháp</Badge>;
      case "PUBLISHED":
        return <Badge variant="default">Đã xuất bản</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.push("/teacher/classes")}>
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
            Lớp
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="text-muted-foreground">Buổi giảng</span>
        </div>

        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/teacher/classes")}>
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
          Lớp
        </Button>
        <span className="text-muted-foreground">/</span>
        <span className="text-muted-foreground">Buổi giảng</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">Buổi giảng</h1>
        <p className="text-muted-foreground mt-1">
          Quản lý các buổi giảng và bài kiểm tra liên quan của môn học
        </p>
      </div>

      {lectures.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground mb-4"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <h3 className="text-lg font-semibold mb-2">Chưa có buổi giảng nào</h3>
          <p className="text-muted-foreground mb-4 text-center max-w-sm">
            Tạo buổi giảng từ tài liệu bằng tính năng Trò chuyện AI, hoặc thêm thủ công từ trang lớp của bạn.
          </p>
          <Button variant="outline" onClick={() => router.push(`/teacher/classes/${classId}`)}>
            Đến trang quản lý lớp
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {lectures.map((lecture) => (
            <Card
              key={lecture.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push(`/teacher/classes/${classId}/quizzes/${lecture.quiz?.id || 'new'}?lectureId=${lecture.id}`)}
            >
              <CardContent className="flex items-center justify-between py-4 px-6">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-muted text-lg font-bold text-muted-foreground">
                    {lecture.order}
                  </div>
                  <div>
                    <p className="font-semibold text-lg">{lecture.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                      {lecture.material && (
                        <span className="flex items-center gap-1">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                          {lecture.material.fileName}
                        </span>
                      )}
                      {lecture.quiz && (
                        <>
                          <span>•</span>
                          <span>{lecture.quiz._count.questionBank} câu hỏi</span>
                          <span>•</span>
                          <span>{lecture.quiz._count.attempts} lượt làm bài</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {lecture.quiz && (
                    <>
                      {getStatusBadge(lecture.quiz.status)}
                      <div className="text-right text-sm">
                        <p className="text-muted-foreground">
                          {lecture.quiz.questionsPerAttempt} câu • {lecture.quiz.timeLimitMinutes} phút
                        </p>
                      </div>
                    </>
                  )}
                  {!lecture.quiz && (
                    <>
                      <Badge variant="outline" className="text-muted-foreground">
                        Chưa có bài kiểm tra
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(
                            `/teacher/classes/${classId}/quizzes/new?lectureId=${lecture.id}`
                          );
                        }}
                      >
                        Tạo bài kiểm tra
                      </Button>
                    </>
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteLecture(lecture.id);
                    }}
                    className="text-muted-foreground hover:text-destructive ml-2"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </Button>

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
                    className="text-muted-foreground"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
