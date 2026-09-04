"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface QuizData {
  id: string;
  status: string;
  instructions: string;
  questionsPerAttempt: number;
  timeLimitMinutes: number;
  deadline: string | null;
  lecture: {
    id: string;
    title: string;
    class: {
      id: string;
      name: string;
    };
  };
}

export default function QuizIntroPage({
  params,
}: {
  params: Promise<{ classId: string; quizId: string }>;
}) {
  const { classId, quizId } = use(params);
  const router = useRouter();
  const { toast } = useToast();

  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [existingAttemptId, setExistingAttemptId] = useState<string | null>(null);

  useEffect(() => {
    fetchQuiz();
  }, [quizId]);

  async function fetchQuiz() {
    try {
      // Fetch quiz details using student-accessible endpoint
      const res = await fetch(`/api/quizzes/${quizId}/info`);

      if (!res.ok) {
        // Try to check for existing attempts
        const studentRes = await fetch(`/api/attempts?quizId=${quizId}`);
        const data = await studentRes.json();
        if (data.data?.length > 0) {
          setExistingAttemptId(data.data[0].id);
        }
      } else {
        const data = await res.json();
        if (data.data) {
          setQuiz(data.data);
        }
      }
    } catch (error) {
      console.error("Failed to fetch quiz:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStartQuiz() {
    setIsStarting(true);

    try {
      const res = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to start quiz");
      }

      router.push(
        `/student/classes/${classId}/quiz/${quizId}/attempt?attemptId=${data.data.id}`
      );
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start quiz",
        variant: "destructive",
      });
    } finally {
      setIsStarting(false);
    }
  }

  function formatDeadline(deadline: string | null) {
    if (!deadline) return "No deadline";
    const date = new Date(deadline);
    return date.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function isDeadlinePassed(deadline: string | null) {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="max-w-2xl space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-12 w-32" />
        </div>
      </div>
    );
  }

  if (!quiz && !existingAttemptId) {
    return (
      <div className="p-6">
        <Card className="flex flex-col items-center justify-center py-12">
          <h3 className="text-lg font-semibold mb-2">Quiz not available</h3>
          <p className="text-muted-foreground mb-4">
            This quiz may not be published yet
          </p>
          <Button variant="outline" onClick={() => router.push(`/student/classes/${classId}`)}>
            Back to Class
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
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
          {quiz?.lecture.class.name || "Class"}
        </Button>
      </div>

      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <Badge variant="secondary" className="w-fit mx-auto mb-4">
              {quiz?.lecture?.title || "Quiz"}
            </Badge>
            <CardTitle className="text-3xl mb-2">
              {quiz?.lecture?.title || "Quiz"}
            </CardTitle>
            <CardDescription className="text-base">
              {quiz?.lecture?.class?.name || "Class"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {quiz && (
              <>
                <div className="grid grid-cols-3 gap-4 py-4 border-y">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{quiz.questionsPerAttempt}</p>
                    <p className="text-sm text-muted-foreground">Questions</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{quiz.timeLimitMinutes}</p>
                    <p className="text-sm text-muted-foreground">Minutes</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">
                      {isDeadlinePassed(quiz.deadline) ? (
                        <span className="text-red-500">Expired</span>
                      ) : (
                        "Available"
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">Status</p>
                  </div>
                </div>

                {quiz.deadline && (
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Deadline</p>
                    <p className="font-medium">{formatDeadline(quiz.deadline)}</p>
                  </div>
                )}

                {quiz.instructions && (
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm font-medium mb-2">Instructions:</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {quiz.instructions}
                    </p>
                  </div>
                )}

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-amber-800 mb-2">
                    Before you start:
                  </p>
                  <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                    <li>Make sure you have a stable internet connection</li>
                    <li>You have {quiz.timeLimitMinutes} minutes to complete the quiz</li>
                    <li>The quiz will auto-submit when time is up</li>
                    <li>Your answers are saved automatically</li>
                  </ul>
                </div>
              </>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => router.push(`/student/classes/${classId}`)}
              >
                Back to Class
              </Button>
              {existingAttemptId ? (
                <Button
                  className="flex-1"
                  onClick={() =>
                    router.push(
                      `/student/classes/${classId}/quiz/${quizId}/results?attemptId=${existingAttemptId}`
                    )
                  }
                >
                  View Results
                </Button>
              ) : quiz && !isDeadlinePassed(quiz.deadline) ? (
                <Button
                  className="flex-1"
                  onClick={handleStartQuiz}
                  disabled={isStarting}
                >
                  {isStarting ? "Starting..." : "Start Quiz"}
                </Button>
              ) : (
                <Button className="flex-1" disabled>
                  Deadline Passed
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
