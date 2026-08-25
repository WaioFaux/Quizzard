"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
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
        title: "Error",
        description: "Failed to load quiz",
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
        throw new Error(data.error || "Failed to publish quiz");
      }

      toast({
        title: "Success",
        description: "Quiz published successfully",
      });

      router.push(`/teacher/classes/${classId}/quizzes/${quizId}`);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to publish quiz",
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
          <h3 className="text-lg font-semibold mb-2">Quiz not found</h3>
          <Button variant="outline" onClick={() => router.push(`/teacher/classes/${classId}`)}>
            Back to Class
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
      <h1 className="text-2xl font-bold mb-1">Publish Quiz</h1>
      <p className="text-muted-foreground mb-6">
        Review and publish your quiz for students
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quiz Summary</CardTitle>
            <CardDescription>
              Review quiz details before publishing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={quiz.status === "PUBLISHED" ? "default" : "secondary"}>
                {quiz.status === "PUBLISHED" ? "Published" : "Draft"}
              </Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">Lecture</span>
              <span className="font-medium">{quiz.lecture.title}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">Total Questions</span>
              <span className="font-medium">{totalCount}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">Approved Questions</span>
              <span className="font-medium">
                {approvedCount} / {totalCount}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-muted-foreground">Student Attempts</span>
              <span className="font-medium">{quiz._count.attempts}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Publishing Checklist</CardTitle>
            <CardDescription>
              Complete all items before publishing
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
                <p className="font-medium">All questions approved</p>
                <p className="text-sm text-muted-foreground">
                  {allApproved
                    ? "All questions have been reviewed and approved"
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
                <p className="font-medium">Review instructions</p>
                <p className="text-sm text-muted-foreground">
                  Quiz settings are configured
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
                  <p className="font-medium">Quiz already published</p>
                  <p className="text-sm text-muted-foreground">
                    Students can take this quiz
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
                  <p className="font-medium">Set deadline (optional)</p>
                  <p className="text-sm text-muted-foreground">
                    Students must start before this date
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {quiz.status !== "PUBLISHED" && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Set Deadline</CardTitle>
              <CardDescription>
                Optionally set a deadline for students to start the quiz
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-4">
                <div className="space-y-2 flex-1">
                  <Label htmlFor="deadline">Deadline</Label>
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
                    Clear
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                If no deadline is set, students can take the quiz at any time. You can always extend the deadline later.
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Ready to Publish?</CardTitle>
            <CardDescription>
              {quiz.status === "PUBLISHED"
                ? "This quiz is live. You can still extend the deadline."
                : "Once published, students will be able to see and take this quiz."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {quiz.status !== "PUBLISHED" && (
              <div className="bg-muted/50 rounded-lg p-4 text-sm">
                <p className="font-medium mb-2">After publishing:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Question content becomes immutable</li>
                  <li>Students can see and start the quiz</li>
                  <li>You can only extend (not shorten) the deadline</li>
                  <li>Question reports from students will appear in Reports</li>
                </ul>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => router.push(`/teacher/classes/${classId}/quizzes/${quizId}`)}
              >
                Back to Quiz
              </Button>
              {quiz.status !== "PUBLISHED" ? (
                <Button
                  onClick={handlePublish}
                  disabled={!canPublish || isPublishing}
                >
                  {isPublishing ? "Publishing..." : "Publish Quiz"}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => router.push(`/teacher/classes/${classId}`)}
                >
                  Done
                </Button>
              )}
            </div>

            {!allApproved && (
              <p className="text-sm text-amber-600">
                All questions must be approved before publishing.{" "}
                <a
                  href={`/teacher/classes/${classId}/quizzes/${quizId}/question-bank`}
                  className="underline"
                >
                  Review questions
                </a>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
