"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

interface Attempt {
  id: string;
  quizId: string;
  score: number | null;
  status: string;
  createdAt: string;
  quiz: {
    id: string;
    status: string;
    deadline: string | null;
    lecture: {
      id: string;
      title: string;
      order: number;
      class: {
        id: string;
        name: string;
      };
    };
  };
}

interface Stats {
  classesEnrolled: number;
  quizzesCompleted: number;
  overallAverage: number | null;
}

export default function StudentProgressPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [enrollments, setEnrollments] = useState<unknown[]>([]);
  const [attemptedQuizIds, setAttemptedQuizIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProgress();
  }, []);

  async function fetchProgress() {
    try {
      const res = await fetch("/api/student/progress");
      const data = await res.json();
      if (data.data) {
        setStats(data.data.stats);
        setAttempts(data.data.attempts);
        setEnrollments(data.data.enrollments);
        setAttemptedQuizIds(data.data.attemptedQuizIds);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }

  function getScoreColor(score: number) {
    if (score >= 90) return "text-green-600";
    if (score >= 80) return "text-emerald-600";
    if (score >= 70) return "text-lime-600";
    if (score >= 60) return "text-amber-600";
    return "text-red-600";
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("vi-VN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
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
    return `Due ${date.toLocaleDateString("vi-VN", { day: "numeric", month: "short" })}`;
  }

  // Available quizzes = published quizzes in enrolled classes the student hasn't attempted
  const attemptedSet = new Set(attemptedQuizIds);
  const availableQuizzes: Array<{
    classId: string;
    className: string;
    lectureTitle: string;
    lectureOrder: number;
    quizId: string;
    deadline: string | null;
  }> = [];

  for (const enrollment of enrollments as Array<{
    class: { id: string; name: string };
    lectures: Array<{
      id: string;
      title: string;
      order: number;
      quiz: { id: string; status: string; deadline: string | null } | null;
    }>;
  }>) {
    for (const lecture of enrollment.lectures) {
      if (lecture.quiz && lecture.quiz.status === "PUBLISHED" && !attemptedSet.has(lecture.quiz.id)) {
        availableQuizzes.push({
          classId: enrollment.class.id,
          className: enrollment.class.name,
          lectureTitle: lecture.title,
          lectureOrder: lecture.order,
          quizId: lecture.quiz.id,
          deadline: lecture.quiz.deadline,
        });
      }
    }
  }

  // Sort by deadline (most urgent first)
  availableQuizzes.sort((a, b) => {
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-1">My Progress</h1>
      <p className="text-muted-foreground mb-6">Track your learning across all classes</p>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.classesEnrolled ?? 0}</div>
            <p className="text-sm text-muted-foreground">Classes enrolled</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.quizzesCompleted ?? 0}</div>
            <p className="text-sm text-muted-foreground">Quizzes completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className={`text-2xl font-bold ${stats?.overallAverage != null ? getScoreColor(stats.overallAverage) : ""}`}>
              {stats?.overallAverage != null ? `${Math.round(stats.overallAverage)}%` : "—"}
            </div>
            <p className="text-sm text-muted-foreground">Overall average score</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="completed" className="space-y-4">
        <TabsList>
          <TabsTrigger value="completed">
            Completed ({attempts.filter((a) => a.status === "SUBMITTED").length})
          </TabsTrigger>
          <TabsTrigger value="available">
            Available ({availableQuizzes.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="completed">
          {attempts.filter((a) => a.status === "SUBMITTED").length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-12">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-muted-foreground mb-3"
              >
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              <p className="text-muted-foreground">No completed quizzes yet</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {attempts
                .filter((a) => a.status === "SUBMITTED")
                .map((attempt) => (
                  <Card key={attempt.id}>
                    <CardContent className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted text-sm font-bold">
                          {attempt.quiz.lecture.order}
                        </div>
                        <div>
                          <p className="font-medium">{attempt.quiz.lecture.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {attempt.quiz.lecture.class.name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground hidden sm:block">
                          {formatDate(attempt.createdAt)}
                        </span>
                        <div className="text-right">
                          <p className={`text-xl font-bold ${attempt.score != null ? getScoreColor(attempt.score) : "text-muted-foreground"}`}>
                            {attempt.score != null ? `${Math.round(attempt.score)}%` : "—"}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            router.push(
                              `/student/classes/${attempt.quiz.lecture.class.id}/quiz/${attempt.quizId}/results?attemptId=${attempt.id}`
                            )
                          }
                        >
                          View
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="available">
          {availableQuizzes.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-12">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-muted-foreground mb-3"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <p className="text-muted-foreground">No quizzes available</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {availableQuizzes.map((q) => {
                const isOverdue = q.deadline && new Date(q.deadline) < new Date();
                return (
                  <Card key={q.quizId}>
                    <CardContent className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted text-sm font-bold">
                          {q.lectureOrder}
                        </div>
                        <div>
                          <p className="font-medium">{q.lectureTitle}</p>
                          <p className="text-sm text-muted-foreground">{q.className}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <Badge variant={isOverdue ? "destructive" : "secondary"}>
                            {formatDeadline(q.deadline)}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => router.push(`/student/classes/${q.classId}/quiz/${q.quizId}`)}
                        >
                          Start Quiz
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
