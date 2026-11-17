"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  submittedAt: string | null;
}

export default function StudentLeaderboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quizId = searchParams.get("quizId");
  const classId = searchParams.get("classId");
  const { toast } = useToast();

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaderboard();
    // Get current user info from session
    fetch("/api/auth/me")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.data?.userId) {
          setCurrentUserId(data.data.userId);
        }
      })
      .catch(() => {});
  }, [quizId]);

  async function fetchLeaderboard() {
    if (!quizId) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/quizzes/${quizId}/leaderboard`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Không thể tải bảng xếp hạng");
      }

      setLeaderboard(data.data || []);
    } catch (error) {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể tải bảng xếp hạng",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  function getRankBadge(rank: number) {
    if (rank === 1) {
      return <span className="text-2xl">🥇</span>;
    }
    if (rank === 2) {
      return <span className="text-2xl">🥈</span>;
    }
    if (rank === 3) {
      return <span className="text-2xl">🥉</span>;
    }
    return <span className="font-bold text-muted-foreground w-8 text-center">{rank}</span>;
  }

  function getScoreColor(score: number) {
    if (score >= 90) return "text-green-600";
    if (score >= 80) return "text-emerald-600";
    if (score >= 70) return "text-lime-600";
    if (score >= 60) return "text-amber-600";
    return "text-red-600";
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Bảng xếp hạng</h1>
          <p className="text-muted-foreground">Xem thứ hạng của bạn so với các học sinh khác</p>
        </div>
        {classId && (
          <Button variant="outline" onClick={() => router.push(`/student/classes/${classId}`)}>
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
              className="mr-2"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Quay lại lớp
          </Button>
        )}
      </div>

      {!quizId ? (
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
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          <h3 className="text-lg font-semibold mb-2">Chưa chọn bài kiểm tra</h3>
          <p className="text-muted-foreground text-center max-w-sm">
            Chọn một bài kiểm tra trong lớp để xem bảng xếp hạng
          </p>
        </Card>
      ) : leaderboard.length === 0 ? (
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
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          <h3 className="text-lg font-semibold mb-2">Chưa có kết quả</h3>
          <p className="text-muted-foreground text-center max-w-sm">
            Hãy là người đầu tiên hoàn thành bài kiểm tra và đứng đầu bảng xếp hạng!
          </p>
          {classId && (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push(`/student/classes/${classId}`)}
            >
              Làm bài
            </Button>
          )}
        </Card>
      ) : (
        <div className="max-w-2xl mx-auto">
          {/* Top 3 Podium */}
          {leaderboard.length >= 3 && (
            <div className="flex items-end justify-center gap-4 mb-8">
              {/* Second Place */}
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-2xl font-bold mb-2">
                  {leaderboard[1].studentName.charAt(0).toUpperCase()}
                </div>
                <p className="font-medium text-center max-w-[100px] truncate">
                  {leaderboard[1].studentName}
                </p>
                <p className={`text-xl font-bold ${getScoreColor(leaderboard[1].score)}`}>
                  {leaderboard[1].score} điểm
                </p>
                <div className="w-20 h-16 bg-gray-300 rounded-t-lg flex items-center justify-center text-2xl">
                  🥈
                </div>
              </div>

              {/* First Place */}
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 rounded-full bg-amber-100 flex items-center justify-center text-3xl font-bold mb-2 ring-4 ring-amber-400">
                  {leaderboard[0].studentName.charAt(0).toUpperCase()}
                </div>
                <p className="font-semibold text-center max-w-[120px] truncate">
                  {leaderboard[0].studentName}
                </p>
                <p className={`text-2xl font-bold ${getScoreColor(leaderboard[0].score)}`}>
                  {leaderboard[0].score} điểm
                </p>
                <div className="w-24 h-20 bg-amber-400 rounded-t-lg flex items-center justify-center text-3xl">
                  🥇
                </div>
              </div>

              {/* Third Place */}
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center text-2xl font-bold mb-2">
                  {leaderboard[2].studentName.charAt(0).toUpperCase()}
                </div>
                <p className="font-medium text-center max-w-[100px] truncate">
                  {leaderboard[2].studentName}
                </p>
                <p className={`text-xl font-bold ${getScoreColor(leaderboard[2].score)}`}>
                  {leaderboard[2].score} điểm
                </p>
                <div className="w-20 h-12 bg-amber-600 rounded-t-lg flex items-center justify-center text-2xl">
                  🥉
                </div>
              </div>
            </div>
          )}

          {/* Full Rankings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Bảng xếp hạng đầy đủ</CardTitle>
              <CardDescription>
                {leaderboard.length} học sinh đã hoàn thành bài kiểm tra này
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {leaderboard.map((entry) => {
                  const isCurrentUser = entry.studentId === currentUserId;
                  return (
                    <div
                      key={entry.studentId}
                      className={`flex items-center justify-between px-6 py-4 ${
                        isCurrentUser ? "bg-primary/5" : ""
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 text-center">
                          {getRankBadge(entry.rank)}
                        </div>
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
                              {isCurrentUser && (
                                <Badge variant="secondary" className="text-xs">
                                  Bạn
                                </Badge>
                              )}
                            </p>
                            {entry.submittedAt && (
                              <p className="text-xs text-muted-foreground">
                                {new Date(entry.submittedAt).toLocaleString("vi-VN")}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-xl font-bold ${getScoreColor(entry.score)}`}>
                          {entry.score} điểm
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
