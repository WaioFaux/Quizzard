"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface ClassData {
  id: string;
  name: string;
  description: string | null;
  classCode: string;
  teacher: {
    id: string;
    name: string;
  };
  lectures: Array<{
    id: string;
    title: string;
    order: number;
    quiz: {
      id: string;
      status: string;
      deadline: string | null;
      timeLimitMinutes: number;
    } | null;
  }>;
  _count: {
    enrollments: number;
  };
}

export default function StudentClassesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchClasses();
  }, []);

  async function fetchClasses() {
    try {
      const res = await fetch("/api/classes/enrollments");
      const data = await res.json();
      if (data.data) {
        setClasses(data.data);
      }
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể tải danh sách lớp",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  function getQuizStatus(quiz: ClassData["lectures"][0]["quiz"]) {
    if (!quiz) return null;
    if (quiz.status === "PUBLISHED") {
      if (quiz.deadline && new Date(quiz.deadline) < new Date()) {
        return { label: "Đã quá hạn", variant: "destructive" as const };
      }
      return { label: "Đang mở", variant: "default" as const };
    }
    return { label: "Sắp mở", variant: "secondary" as const };
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Lớp của tôi</h1>
            <p className="text-muted-foreground">Các lớp bạn đang tham gia</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-1/2 mt-2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-muted rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Lớp của tôi</h1>
          <p className="text-muted-foreground">Các lớp bạn đang tham gia</p>
        </div>
        <Button onClick={() => router.push("/student/classes/join")}>
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
            <path d="M12 5v14M5 12h14" />
          </svg>
          Tham gia lớp
        </Button>
      </div>

      {classes.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground mb-4"
          >
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
          </svg>
          <h3 className="text-lg font-semibold mb-2">Chưa có lớp nào</h3>
          <p className="text-muted-foreground mb-4 text-center max-w-sm">
            Tham gia lớp bằng mã lớp do giáo viên cung cấp
          </p>
          <Button onClick={() => router.push("/student/classes/join")}>
            Tham gia lớp
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => {
            const availableQuizzes = cls.lectures.filter(
              (l) => l.quiz?.status === "PUBLISHED"
            );
            return (
              <Card
                key={cls.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push(`/student/classes/${cls.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{cls.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {cls.teacher.name}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {cls._count.enrollments} học sinh
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {cls.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {cls.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {cls.lectures.length} bài giảng
                    </span>
                    {availableQuizzes.length > 0 && (
                      <Badge variant="default" className="text-xs">
                        {availableQuizzes.length} bài kiểm tra đang mở
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
