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
          title: "Error",
          description: "Failed to load lectures",
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
        throw new Error(data.error || "Failed to create quiz");
      }

      const data = await res.json();

      toast({
        title: "Success",
        description: "Quiz created. Configure it, generate the question bank, then publish.",
      });

      router.push(`/teacher/classes/${classId}/quizzes/${data.data.id}`);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create quiz",
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
          {className || "Classes"}
        </Button>
      </div>
      <h1 className="text-2xl font-bold mb-1">Create Quiz</h1>
      <p className="text-muted-foreground mb-6">
        A quiz is tied to one lecture. Set the rules here, then generate the
        question bank and publish.
      </p>

      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Quiz Setup</CardTitle>
            <CardDescription>
              The lecture you pick will get one draft quiz. You can change the
              settings any time before publishing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lectures.length === 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  This class has no lectures yet. Add a lecture first, then create
                  its quiz.
                </p>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/teacher/classes/${classId}`)}
                >
                  Back to Class
                </Button>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="lecture">Lecture</Label>
                  <Select
                    value={selectedLectureId}
                    onValueChange={setSelectedLectureId}
                  >
                    <SelectTrigger id="lecture">
                      <SelectValue placeholder="Select a lecture" />
                    </SelectTrigger>
                    <SelectContent>
                      {lectures.map((lecture) => (
                        <SelectItem
                          key={lecture.id}
                          value={lecture.id}
                          disabled={!!lecture.quiz}
                        >
                          {lecture.order}. {lecture.title}
                          {lecture.quiz ? " (already has a quiz)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {existingQuizId && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                    <p className="font-medium">This lecture already has a quiz.</p>
                    <Button
                      variant="link"
                      className="h-auto p-0"
                      onClick={() =>
                        router.push(
                          `/teacher/classes/${classId}/quizzes/${existingQuizId}`
                        )
                      }
                    >
                      Open the existing quiz
                    </Button>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="instructions">AI Instructions</Label>
                  <Textarea
                    id="instructions"
                    rows={6}
                    placeholder="Describe what topics, difficulty level, and question types you want..."
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Instructions for the AI when generating questions. Be specific
                    about topics to cover, difficulty level, and preferred question
                    types.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="questions">Questions per Attempt</Label>
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
                      The question bank will be 5x this size.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timelimit">Time Limit (minutes)</Label>
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
                  <Label htmlFor="deadline">Deadline (optional)</Label>
                  <Input
                    id="deadline"
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Last moment a student may start an attempt. You can also set it
                    when publishing.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={isSubmitting || !!existingQuizId}>
                    {isSubmitting ? "Creating..." : "Create Quiz"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push(`/teacher/classes/${classId}`)}
                  >
                    Cancel
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
