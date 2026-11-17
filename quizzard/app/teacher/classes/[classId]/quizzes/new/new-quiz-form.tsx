"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface LectureOption {
  id: string;
  title: string;
  order: number;
  quiz: { id: string } | null;
}

export function NewQuizForm({
  classId,
  lectureId,
}: {
  classId: string;
  lectureId: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [className, setClassName] = useState<string>("");
  const [lectures, setLectures] = useState<LectureOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedLectureId, setSelectedLectureId] = useState<string>(lectureId ?? "");
  const [instructions, setInstructions] = useState("");
  const [questionsPerAttempt, setQuestionsPerAttempt] = useState(10);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(30);
  const [deadline, setDeadline] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [classRes, lecturesRes] = await Promise.all([
          fetch(`/api/classes/${classId}`),
          fetch(`/api/lectures?classId=${classId}`),
        ]);

        const classData = await classRes.json();
        const lecturesData = await lecturesRes.json();

        if (cancelled) return;

        const allLectures: LectureOption[] = lecturesData.data ?? [];
        setLectures(allLectures);

        if (classData.data?.name) {
          setClassName(classData.data.name);
        }

        // Default to the requested lecture, otherwise the first one without a quiz.
        setSelectedLectureId((current) => {
          if (current) return current;
          const withoutQuiz = allLectures.find((l) => !l.quiz);
          return (withoutQuiz ?? allLectures[0])?.id ?? "";
        });
      } catch {
        toast({
          title: "Lỗi",
          description: "Không thể tải danh sách buổi giảng",
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [classId, toast]);

  const selectedLecture = useMemo(
    () => lectures.find((l) => l.id === selectedLectureId) ?? null,
    [lectures, selectedLectureId]
  );

  const existingQuizId = selectedLecture?.quiz?.id ?? null;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLectureId) return;

    setIsSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        lectureId: selectedLectureId,
        instructions,
        questionsPerAttempt,
        timeLimitMinutes,
      };

      if (deadline) {
        payload.deadline = new Date(deadline).toISOString();
      }

      const res = await fetch("/api/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Không thể tạo bài kiểm tra");
      }

      const data = await res.json();

      toast({
        title: "Thành công",
        description: "Đã tạo bài kiểm tra. Hãy cấu hình, tạo ngân hàng câu hỏi rồi xuất bản.",
      });

      router.push(`/teacher/classes/${classId}/quizzes/${data.data.id}`);
    } catch (error) {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể tạo bài kiểm tra",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/teacher/classes/${classId}`)}
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
          {className || "Lớp"}
        </Button>
      </div>
      <h1 className="text-2xl font-bold mb-1">Tạo bài kiểm tra</h1>
      <p className="text-muted-foreground mb-6">
        Mỗi bài kiểm tra gắn với một buổi giảng. Hãy thiết lập quy tắc tại đây,
        sau đó tạo ngân hàng câu hỏi và xuất bản.
      </p>

      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Thiết lập bài kiểm tra</CardTitle>
            <CardDescription>
              Buổi giảng bạn chọn sẽ có một bài kiểm tra nháp. Bạn có thể thay đổi
              cài đặt bất kỳ lúc nào trước khi xuất bản.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lectures.length === 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Lớp này chưa có buổi giảng nào. Hãy thêm buổi giảng trước,
                  rồi tạo bài kiểm tra cho buổi đó.
                </p>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/teacher/classes/${classId}`)}
                >
                  Quay lại lớp
                </Button>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="lecture">Buổi giảng</Label>
                  <Select
                    value={selectedLectureId}
                    onValueChange={setSelectedLectureId}
                  >
                    <SelectTrigger id="lecture">
                      <SelectValue placeholder="Chọn một buổi giảng" />
                    </SelectTrigger>
                    <SelectContent>
                      {lectures.map((lecture) => (
                        <SelectItem
                          key={lecture.id}
                          value={lecture.id}
                          disabled={!!lecture.quiz}
                        >
                          {lecture.order}. {lecture.title}
                          {lecture.quiz ? " (đã có bài kiểm tra)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {existingQuizId && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                    <p className="font-medium">Buổi giảng này đã có bài kiểm tra.</p>
                    <Button
                      variant="link"
                      className="h-auto p-0"
                      onClick={() =>
                        router.push(
                          `/teacher/classes/${classId}/quizzes/${existingQuizId}`
                        )
                      }
                    >
                      Mở bài kiểm tra hiện có
                    </Button>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="instructions">Hướng dẫn cho AI</Label>
                  <Textarea
                    id="instructions"
                    rows={6}
                    placeholder="Mô tả các chủ đề, độ khó và dạng câu hỏi mà bạn muốn..."
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Hướng dẫn cho AI khi tạo câu hỏi. Hãy nêu rõ chủ đề cần đề cập,
                    độ khó và dạng câu hỏi ưu tiên.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="questions">Số câu hỏi mỗi lượt làm bài</Label>
                    <Input
                      id="questions"
                      type="number"
                      min={1}
                      max={100}
                      value={questionsPerAttempt}
                      onChange={(e) =>
                        setQuestionsPerAttempt(parseInt(e.target.value) || 1)
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Ngân hàng câu hỏi sẽ gấp 5 lần số lượng này.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timelimit">Thời gian làm bài (phút)</Label>
                    <Input
                      id="timelimit"
                      type="number"
                      min={1}
                      max={300}
                      value={timeLimitMinutes}
                      onChange={(e) =>
                        setTimeLimitMinutes(parseInt(e.target.value) || 1)
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deadline">Hạn chót (không bắt buộc)</Label>
                  <Input
                    id="deadline"
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Thời điểm cuối cùng học sinh có thể bắt đầu làm bài. Bạn cũng có thể
                    đặt khi xuất bản.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={isSubmitting || !!existingQuizId}>
                    {isSubmitting ? "Đang tạo..." : "Tạo bài kiểm tra"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push(`/teacher/classes/${classId}`)}
                  >
                    Hủy
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
