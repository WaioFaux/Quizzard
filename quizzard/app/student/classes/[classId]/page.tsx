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
  const [attempts, setAttempts] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchClass();
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
        title: "Error",
        description: "Failed to load class",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  function getQuizStatus(quiz: Lecture["quiz"]) {
    if (!quiz) return null;

    const attemptId = attempts[quiz.id];
    if (attemptId) {
      return { label: "Completed", variant: "default" as const };
    }

    if (quiz.status === "PUBLISHED") {
      if (quiz.deadline && new Date(quiz.deadline) < new Date()) {
        return { label: "Missed", variant: "destructive" as const };
      }
      return { label: "Available", variant: "default" as const };
    }
    return { label: "Coming Soon", variant: "secondary" as const };
  }

  function formatDeadline(deadline: string | null) {
    if (!deadline) return "No deadline";
    const date = new Date(deadline);
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff < 0) return "Deadline passed";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Due today";
    if (days === 1) return "Due tomorrow";
    if (days < 7) return `Due in ${days} days`;

    return `Due ${date.toLocaleDateString()}`;
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
          <h3 className="text-lg font-semibold mb-2">Class not found</h3>
          <Button variant="outline" onClick={() => router.push("/student/classes")}>
            Back to Classes
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
          My Classes
        </Button>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{cls.name}</h1>
          <p className="text-muted-foreground mt-1">
            Teacher: {cls.teacher.name}
          </p>
          {cls.description && (
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              {cls.description}
            </p>
          )}
        </div>
        <Button variant="outline" onClick={() => router.push("/student/classes/join")}>
          Leave Class
        </Button>
      </div>

      <div className="space-y-4">
        {cls.lectures.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">No quizzes available yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Check back later for quizzes from your teacher
            </p>
          </Card>
        ) : (
          cls.lectures.map((lecture) => {
            const quiz = lecture.quiz;
            const status = getQuizStatus(quiz);
            const canStart = quiz?.status === "PUBLISHED" && !attempts[quiz.id];

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
                          <span>{quiz.questionsPerAttempt} questions</span>
                          <span className="text-muted-foreground/50">|</span>
                          <span>{quiz.timeLimitMinutes} minutes</span>
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
                    {canStart && (
                      <Button
                        size="sm"
                        onClick={() => router.push(`/student/classes/${classId}/quiz/${quiz.id}`)}
                      >
                        Start Quiz
                      </Button>
                    )}
                    {attempts[quiz?.id || ""] && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          router.push(`/student/classes/${classId}/quiz/${quiz?.id}/results`)
                        }
                      >
                        View Results
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
