"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface LeaderboardEntry {
  rank: number;
  studentId: string;
  studentName: string;
  score: number;
  quizzesCompleted: number;
  totalQuizzes: number;
}

interface ClassData {
  id: string;
  name: string;
}

export default function ClassFullLeaderboardPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = use(params);
  const router = useRouter();
  const { toast } = useToast();

  const [cls, setClass] = useState<ClassData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoadingClass, setIsLoadingClass] = useState(true);
  const [isLoadingBoard, setIsLoadingBoard] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchClass();
    fetchCurrentUser();
  }, [classId]);

  useEffect(() => {
    if (classId) {
      fetchLeaderboard();
    }
  }, [classId]);

  async function fetchClass() {
    try {
      const res = await fetch(`/api/classes/${classId}`);
      const data = await res.json();
      if (data.data) {
        setClass(data.data);
      }
    } catch {
      toast({ title: "Error", description: "Failed to load class", variant: "destructive" });
    } finally {
      setIsLoadingClass(false);
    }
  }

  async function fetchCurrentUser() {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data?.data?.userId) setCurrentUserId(data.data.userId);
    } catch {}
  }

  async function fetchLeaderboard() {
    setIsLoadingBoard(true);
    try {
      const res = await fetch(`/api/classes/${classId}/leaderboard`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load leaderboard");
      setLeaderboard(data.data || []);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load leaderboard",
        variant: "destructive",
      });
    } finally {
      setIsLoadingBoard(false);
    }
  }

  function getRankBadge(rank: number) {
    if (rank === 1) return <span className="text-2xl">1</span>;
    if (rank === 2) return <span className="text-2xl">2</span>;
    if (rank === 3) return <span className="text-2xl">3</span>;
    return <span className="font-bold text-muted-foreground w-8 text-center">{rank}</span>;
  }

  function getScoreColor(score: number, totalQuizzes: number) {
    // Calculate average score per quiz
    const avgScore = score / totalQuizzes;
    if (avgScore >= 90) return "text-green-600";
    if (avgScore >= 80) return "text-emerald-600";
    if (avgScore >= 70) return "text-lime-600";
    if (avgScore >= 60) return "text-amber-600";
    return "text-red-600";
  }

  if (isLoadingClass) {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-64 mb-6" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-1">
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
          {cls?.name || "Class"}
        </Button>
      </div>
      <h1 className="text-2xl font-bold mb-2">Class Leaderboard</h1>
      <p className="text-muted-foreground mb-6">Total points from all quizzes</p>

      {isLoadingBoard ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : leaderboard.length === 0 ? (
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
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          <p className="text-muted-foreground">No quiz results yet in this class</p>
          <p className="text-sm text-muted-foreground mt-1">Complete quizzes to appear on the leaderboard!</p>
        </Card>
      ) : (
        <div className="max-w-2xl mx-auto">
          {/* Podium */}
          {leaderboard.length >= 3 && (
            <div className="flex items-end justify-center gap-4 mb-8">
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-2xl font-bold mb-2">
                  {leaderboard[1].studentName.charAt(0).toUpperCase()}
                </div>
                <p className="font-medium text-center max-w-[100px] truncate">{leaderboard[1].studentName}</p>
                <p className={`text-xl font-bold ${getScoreColor(leaderboard[1].score, leaderboard[1].totalQuizzes)}`}>
                  {leaderboard[1].score} pts
                </p>
                <p className="text-sm text-muted-foreground">
                  {leaderboard[1].quizzesCompleted}/{leaderboard[1].totalQuizzes} quizzes
                </p>
                <div className="w-20 h-16 bg-gray-300 rounded-t-lg flex items-center justify-center text-lg font-bold">2</div>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 rounded-full bg-amber-100 flex items-center justify-center text-3xl font-bold mb-2 ring-4 ring-amber-400">
                  {leaderboard[0].studentName.charAt(0).toUpperCase()}
                </div>
                <p className="font-semibold text-center max-w-[120px] truncate">{leaderboard[0].studentName}</p>
                <p className={`text-2xl font-bold ${getScoreColor(leaderboard[0].score, leaderboard[0].totalQuizzes)}`}>
                  {leaderboard[0].score} pts
                </p>
                <p className="text-sm text-muted-foreground">
                  {leaderboard[0].quizzesCompleted}/{leaderboard[0].totalQuizzes} quizzes
                </p>
                <div className="w-24 h-20 bg-amber-400 rounded-t-lg flex items-center justify-center text-2xl font-bold">1</div>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center text-2xl font-bold mb-2">
                  {leaderboard[2].studentName.charAt(0).toUpperCase()}
                </div>
                <p className="font-medium text-center max-w-[100px] truncate">{leaderboard[2].studentName}</p>
                <p className={`text-xl font-bold ${getScoreColor(leaderboard[2].score, leaderboard[2].totalQuizzes)}`}>
                  {leaderboard[2].score} pts
                </p>
                <p className="text-sm text-muted-foreground">
                  {leaderboard[2].quizzesCompleted}/{leaderboard[2].totalQuizzes} quizzes
                </p>
                <div className="w-20 h-12 bg-amber-600 rounded-t-lg flex items-center justify-center text-lg font-bold text-white">3</div>
              </div>
            </div>
          )}

          {/* Rankings List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">All Rankings</CardTitle>
              <CardDescription>
                {leaderboard.length} student{leaderboard.length !== 1 ? "s" : ""} with results
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {leaderboard.map((entry) => {
                  const isCurrentUser = entry.studentId === currentUserId;
                  return (
                    <div
                      key={entry.studentId}
                      className={`flex items-center justify-between px-6 py-4 ${isCurrentUser ? "bg-primary/5" : ""}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 text-center">{getRankBadge(entry.rank)}</div>
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                              entry.rank === 1
                                ? "bg-amber-100 text-amber-700"
                                : entry.rank === 2
                                ? "bg-gray-200 text-gray-700"
                                : entry.rank === 3
                                ? "bg-orange-100 text-orange-700"
                                : "bg-muted"
                            }`}
                          >
                            {entry.studentName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium flex items-center gap-2">
                              {entry.studentName}
                              {isCurrentUser && <Badge variant="secondary" className="text-xs">You</Badge>}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {entry.quizzesCompleted}/{entry.totalQuizzes} quizzes completed
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-xl font-bold ${getScoreColor(entry.score, entry.totalQuizzes)}`}>
                          {entry.score} pts
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
