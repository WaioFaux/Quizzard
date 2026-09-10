"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface ClassAnalytics {
  classId: string;
  className: string;
  studentCount: number;
  quizCount: number;
  avgScore: number | null;
  completionRate: number;
  pendingReports: number;
}

interface RecentSubmission {
  studentId: string;
  studentName: string;
  quizTitle: string;
  classId: string;
  score: number | null;
  submittedAt: string;
}

interface Overview {
  totalClasses: number;
  totalStudents: number;
  overallAvgScore: number | null;
  totalPendingReports: number;
}

export default function TeacherAnalyticsPage() {
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [classes, setClasses] = useState<ClassAnalytics[]>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<RecentSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  async function fetchAnalytics() {
    try {
      const res = await fetch("/api/analytics/teacher");
      const data = await res.json();
      if (data.data) {
        setOverview(data.data.overview);
        setClasses(data.data.classes);
        setRecentSubmissions(data.data.recentSubmissions);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }

  function getScoreColor(score: number | null) {
    if (score == null) return "text-muted-foreground";
    if (score >= 90) return "text-green-600";
    if (score >= 80) return "text-emerald-600";
    if (score >= 70) return "text-lime-600";
    if (score >= 60) return "text-amber-600";
    return "text-red-600";
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString("vi-VN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Analytics</h1>
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Analytics</h1>

      {/* Overview Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{overview?.totalClasses ?? 0}</div>
            <p className="text-sm text-muted-foreground">Total classes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{overview?.totalStudents ?? 0}</div>
            <p className="text-sm text-muted-foreground">Total students</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className={`text-2xl font-bold ${getScoreColor(overview?.overallAvgScore ?? null)}`}>
              {overview?.overallAvgScore != null
                ? `${Math.round(overview.overallAvgScore)}%`
                : "—"}
            </div>
            <p className="text-sm text-muted-foreground">Overall avg score</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold flex items-center gap-2">
              {overview?.totalPendingReports ?? 0}
              {(overview?.totalPendingReports ?? 0) > 0 && (
                <Badge variant="destructive" className="text-xs">
                  Action needed
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">Pending reports</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Per-Class Cards */}
        <div className="col-span-2 space-y-4">
          <h2 className="text-lg font-semibold">Classes</h2>
          {classes.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground">No classes yet</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {classes.map((cls) => (
                <Card
                  key={cls.classId}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => router.push(`/teacher/classes/${cls.classId}`)}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold">{cls.className}</h3>
                      {cls.pendingReports > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {cls.pendingReports} report{cls.pendingReports !== 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Students</p>
                        <p className="font-semibold">{cls.studentCount}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Quizzes</p>
                        <p className="font-semibold">{cls.quizCount}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Avg Score</p>
                        <p className={`font-semibold ${getScoreColor(cls.avgScore)}`}>
                          {cls.avgScore != null ? `${Math.round(cls.avgScore)}%` : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Completion</p>
                        <p className="font-semibold">{Math.round(cls.completionRate)}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Recent Submissions */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Recent Submissions</h2>
          {recentSubmissions.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground text-sm">No submissions yet</p>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0 divide-y">
                {recentSubmissions.map((sub, i) => (
                  <div key={i} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                          {sub.studentName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{sub.studentName}</p>
                          <p className="text-xs text-muted-foreground">{sub.quizTitle}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${getScoreColor(sub.score)}`}>
                          {sub.score != null ? `${Math.round(sub.score)}%` : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDate(sub.submittedAt)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
