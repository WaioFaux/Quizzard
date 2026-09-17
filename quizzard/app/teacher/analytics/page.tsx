"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

interface ClassLeaderboardEntry {
  rank: number;
  studentId: string;
  studentName: string;
  totalScore: number;
  quizzesCompleted: number;
  totalQuizzes: number;
}

interface QuizLeaderboardEntry {
  rank: number;
  studentId: string;
  studentName: string;
  score: number;
}

interface ClassWithLeaderboard {
  classId: string;
  className: string;
  totalQuizzes: number;
  totalParticipants: number;
  leaderboard: ClassLeaderboardEntry[];
}

interface QuizWithLeaderboard {
  quizId: string;
  quizTitle: string;
  classId: string;
  className: string;
  lectureOrder: number;
  totalParticipants: number;
  leaderboard: QuizLeaderboardEntry[];
}

export default function TeacherAnalyticsPage() {
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [classes, setClasses] = useState<ClassAnalytics[]>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<RecentSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Leaderboard data
  const [classLeaderboards, setClassLeaderboards] = useState<ClassWithLeaderboard[]>([]);
  const [quizLeaderboards, setQuizLeaderboards] = useState<QuizWithLeaderboard[]>([]);
  const [isLoadingLeaderboards, setIsLoadingLeaderboards] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [selectedQuizLeaderboardClass, setSelectedQuizLeaderboardClass] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
    fetchLeaderboards();
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

  async function fetchLeaderboards() {
    setIsLoadingLeaderboards(true);
    try {
      const res = await fetch("/api/analytics/teacher/leaderboards");
      const data = await res.json();
      if (data.data) {
        setClassLeaderboards(data.data.classLeaderboards || []);
        setQuizLeaderboards(data.data.quizLeaderboards || []);
        if (data.data.classLeaderboards?.length > 0) {
          setSelectedClassId(data.data.classLeaderboards[0].classId);
          // Also set the first class as default for leaderboards
          setSelectedQuizLeaderboardClass(data.data.classLeaderboards[0].classId);
        }
        // Don't set selectedQuizId by default - show class leaderboard first
      }
    } catch {
      // silently fail
    } finally {
      setIsLoadingLeaderboards(false);
    }
  }

  function getScoreColor(score: number | null, max: number = 100) {
    if (score == null) return "text-muted-foreground";
    const percentage = (score / max) * 100;
    if (percentage >= 90) return "text-green-600";
    if (percentage >= 80) return "text-emerald-600";
    if (percentage >= 70) return "text-lime-600";
    if (percentage >= 60) return "text-amber-600";
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

  function getRankBadge(rank: number) {
    if (rank === 1) return <span className="text-2xl">🥇</span>;
    if (rank === 2) return <span className="text-2xl">🥈</span>;
    if (rank === 3) return <span className="text-2xl">🥉</span>;
    return <span className="font-bold text-muted-foreground w-8 text-center">{rank}</span>;
  }

  function getStudentAvatarColor(rank: number) {
    if (rank === 1) return "bg-amber-100 text-amber-700";
    if (rank === 2) return "bg-gray-200 text-gray-700";
    if (rank === 3) return "bg-orange-100 text-orange-700";
    return "bg-muted";
  }

  const selectedClassLeaderboard = classLeaderboards.find(c => c.classId === selectedClassId);
  const selectedQuizLeaderboard = quizLeaderboards.find(q => q.quizId === selectedQuizId);

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

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="leaderboards">Leaderboards</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
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
        </TabsContent>

        {/* Leaderboards Tab */}
        <TabsContent value="leaderboards">
          {isLoadingLeaderboards ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-96 w-full" />
            </div>
          ) : quizLeaderboards.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-12">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-muted-foreground mb-4"
              >
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              <p className="text-muted-foreground">No leaderboards available</p>
              <p className="text-sm text-muted-foreground mt-1">Publish quizzes and have students complete them to see leaderboards</p>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Class and View Selectors on one line */}
              <div className="flex gap-6 items-center w-full">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <label className="text-sm font-medium text-muted-foreground shrink-0">Class:</label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectedQuizLeaderboardClass || ""}
                    onChange={(e) => {
                      setSelectedQuizLeaderboardClass(e.target.value);
                      setSelectedQuizId("");
                    }}
                  >
                    <option value="" disabled>Choose a class...</option>
                    {classLeaderboards.map((cls) => {
                      const quizzesInClass = quizLeaderboards.filter(q => q.classId === cls.classId);
                      return (
                        <option key={cls.classId} value={cls.classId}>
                          {cls.className} ({quizzesInClass.length} quiz{quizzesInClass.length !== 1 ? "zes" : ""})
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <label className="text-sm font-medium text-muted-foreground shrink-0">View:</label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectedQuizId || "all"}
                    onChange={(e) => {
                      if (e.target.value === "all") {
                        setSelectedQuizId("");
                      } else {
                        setSelectedQuizId(e.target.value);
                      }
                    }}
                  >
                    <option value="all">All Quizzes (Class Leaderboard)</option>
                    {selectedQuizLeaderboardClass && quizLeaderboards
                      .filter(quiz => quiz.classId === selectedQuizLeaderboardClass)
                      .map((quiz) => (
                        <option key={quiz.quizId} value={quiz.quizId}>
                          Lecture {quiz.lectureOrder}: {quiz.quizTitle} ({quiz.totalParticipants} participant{quiz.totalParticipants !== 1 ? "s" : ""})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Class Leaderboard (All Quizzes) */}
              {selectedQuizLeaderboardClass && !selectedQuizId && (
                <ClassLeaderboardView
                  classLeaderboard={classLeaderboards.find(c => c.classId === selectedQuizLeaderboardClass)}
                  onViewFullLeaderboard={() => router.push(`/teacher/classes/${selectedQuizLeaderboardClass}/full-leaderboard`)}
                  getRankBadge={getRankBadge}
                  getScoreColor={getScoreColor}
                  getStudentAvatarColor={getStudentAvatarColor}
                />
              )}

              {/* Selected Quiz Leaderboard */}
              {selectedQuizLeaderboard && (
                <div>
                  <div className="mb-4">
                    <h2 className="text-xl font-semibold">
                      {selectedQuizLeaderboard.className} — Lecture {selectedQuizLeaderboard.lectureOrder}: {selectedQuizLeaderboard.quizTitle}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedQuizLeaderboard.totalParticipants} student{selectedQuizLeaderboard.totalParticipants !== 1 ? "s" : ""} completed this quiz
                    </p>
                  </div>

                  {selectedQuizLeaderboard.leaderboard.length === 0 ? (
                    <Card className="flex flex-col items-center justify-center py-12">
                      <p className="text-muted-foreground">No results for this quiz yet</p>
                    </Card>
                  ) : (
                    <div className="max-w-2xl">
                      {/* Podium for top 3 */}
                      {selectedQuizLeaderboard.leaderboard.length >= 3 && (
                        <div className="flex items-end justify-center gap-4 mb-8">
                          <div className="flex flex-col items-center">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold mb-2 ${getStudentAvatarColor(2)}`}>
                              {selectedQuizLeaderboard.leaderboard[1].studentName.charAt(0).toUpperCase()}
                            </div>
                            <p className="font-medium text-center max-w-[100px] truncate">
                              {selectedQuizLeaderboard.leaderboard[1].studentName}
                            </p>
                            <p className={`text-lg font-bold ${getScoreColor(selectedQuizLeaderboard.leaderboard[1].score)}`}>
                              {selectedQuizLeaderboard.leaderboard[1].score} pts
                            </p>
                            <div className="w-16 h-14 bg-gray-300 rounded-t-lg flex items-center justify-center text-lg font-bold mt-2">2</div>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold mb-2 ring-4 ring-amber-400 ${getStudentAvatarColor(1)}`}>
                              {selectedQuizLeaderboard.leaderboard[0].studentName.charAt(0).toUpperCase()}
                            </div>
                            <p className="font-semibold text-center max-w-[120px] truncate">
                              {selectedQuizLeaderboard.leaderboard[0].studentName}
                            </p>
                            <p className={`text-xl font-bold ${getScoreColor(selectedQuizLeaderboard.leaderboard[0].score)}`}>
                              {selectedQuizLeaderboard.leaderboard[0].score} pts
                            </p>
                            <div className="w-20 h-18 bg-amber-400 rounded-t-lg flex items-center justify-center text-xl font-bold mt-2">1</div>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold mb-2 ${getStudentAvatarColor(3)}`}>
                              {selectedQuizLeaderboard.leaderboard[2].studentName.charAt(0).toUpperCase()}
                            </div>
                            <p className="font-medium text-center max-w-[100px] truncate">
                              {selectedQuizLeaderboard.leaderboard[2].studentName}
                            </p>
                            <p className={`text-lg font-bold ${getScoreColor(selectedQuizLeaderboard.leaderboard[2].score)}`}>
                              {selectedQuizLeaderboard.leaderboard[2].score} pts
                            </p>
                            <div className="w-16 h-10 bg-amber-600 rounded-t-lg flex items-center justify-center text-lg font-bold text-white mt-2">3</div>
                          </div>
                        </div>
                      )}

                      {/* Rankings List */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">All Rankings</CardTitle>
                          <CardDescription>
                            {selectedQuizLeaderboard.leaderboard.length} student{selectedQuizLeaderboard.leaderboard.length !== 1 ? "s" : ""} completed this quiz
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="divide-y">
                            {selectedQuizLeaderboard.leaderboard.map((entry) => (
                              <div
                                key={entry.studentId}
                                className="flex items-center justify-between px-6 py-4"
                              >
                                <div className="flex items-center gap-4">
                                  <div className="w-12 text-center">{getRankBadge(entry.rank)}</div>
                                  <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${getStudentAvatarColor(entry.rank)}`}>
                                      {entry.studentName.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                      <p className="font-medium">{entry.studentName}</p>
                                    </div>
                                  </div>
                                </div>
                                <p className={`text-xl font-bold ${getScoreColor(entry.score)}`}>
                                  {entry.score} pts
                                </p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Class Leaderboard View Component
interface ClassLeaderboardViewProps {
  classLeaderboard: ClassWithLeaderboard | undefined;
  onViewFullLeaderboard: () => void;
  getRankBadge: (rank: number) => React.ReactNode;
  getScoreColor: (score: number | null, max?: number) => string;
  getStudentAvatarColor: (rank: number) => string;
}

function ClassLeaderboardView({
  classLeaderboard,
  onViewFullLeaderboard,
  getRankBadge,
  getScoreColor,
  getStudentAvatarColor,
}: ClassLeaderboardViewProps) {
  if (!classLeaderboard) {
    return (
      <Card className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">No data available</p>
      </Card>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">{classLeaderboard.className}</h2>
          <p className="text-sm text-muted-foreground">
            {classLeaderboard.totalParticipants} students • {classLeaderboard.totalQuizzes} quizzes
          </p>
        </div>
        <button
          onClick={onViewFullLeaderboard}
          className="text-sm text-primary hover:underline"
        >
          View full leaderboard →
        </button>
      </div>

      {classLeaderboard.leaderboard.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">No quiz results in this class yet</p>
        </Card>
      ) : (
        <div className="max-w-2xl">
          {/* Podium for top 3 */}
          {classLeaderboard.leaderboard.length >= 3 && (
            <div className="flex items-end justify-center gap-4 mb-8">
              <div className="flex flex-col items-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold mb-2 ${getStudentAvatarColor(2)}`}>
                  {classLeaderboard.leaderboard[1].studentName.charAt(0).toUpperCase()}
                </div>
                <p className="font-medium text-center max-w-[100px] truncate">
                  {classLeaderboard.leaderboard[1].studentName}
                </p>
                <p className={`text-lg font-bold ${getScoreColor(classLeaderboard.leaderboard[1].totalScore)}`}>
                  {classLeaderboard.leaderboard[1].totalScore} pts
                </p>
                <p className="text-xs text-muted-foreground">
                  {classLeaderboard.leaderboard[1].quizzesCompleted}/{classLeaderboard.leaderboard[1].totalQuizzes} quizzes
                </p>
                <div className="w-16 h-14 bg-gray-300 rounded-t-lg flex items-center justify-center text-lg font-bold mt-2">2</div>
              </div>
              <div className="flex flex-col items-center">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold mb-2 ring-4 ring-amber-400 ${getStudentAvatarColor(1)}`}>
                  {classLeaderboard.leaderboard[0].studentName.charAt(0).toUpperCase()}
                </div>
                <p className="font-semibold text-center max-w-[120px] truncate">
                  {classLeaderboard.leaderboard[0].studentName}
                </p>
                <p className={`text-xl font-bold ${getScoreColor(classLeaderboard.leaderboard[0].totalScore)}`}>
                  {classLeaderboard.leaderboard[0].totalScore} pts
                </p>
                <p className="text-xs text-muted-foreground">
                  {classLeaderboard.leaderboard[0].quizzesCompleted}/{classLeaderboard.leaderboard[0].totalQuizzes} quizzes
                </p>
                <div className="w-20 h-18 bg-amber-400 rounded-t-lg flex items-center justify-center text-xl font-bold mt-2">1</div>
              </div>
              <div className="flex flex-col items-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold mb-2 ${getStudentAvatarColor(3)}`}>
                  {classLeaderboard.leaderboard[2].studentName.charAt(0).toUpperCase()}
                </div>
                <p className="font-medium text-center max-w-[100px] truncate">
                  {classLeaderboard.leaderboard[2].studentName}
                </p>
                <p className={`text-lg font-bold ${getScoreColor(classLeaderboard.leaderboard[2].totalScore)}`}>
                  {classLeaderboard.leaderboard[2].totalScore} pts
                </p>
                <p className="text-xs text-muted-foreground">
                  {classLeaderboard.leaderboard[2].quizzesCompleted}/{classLeaderboard.leaderboard[2].totalQuizzes} quizzes
                </p>
                <div className="w-16 h-10 bg-amber-600 rounded-t-lg flex items-center justify-center text-lg font-bold text-white mt-2">3</div>
              </div>
            </div>
          )}

          {/* Rankings List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">All Rankings</CardTitle>
              <CardDescription>
                {classLeaderboard.leaderboard.length} student{classLeaderboard.leaderboard.length !== 1 ? "s" : ""} with results
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {classLeaderboard.leaderboard.map((entry) => (
                  <div
                    key={entry.studentId}
                    className="flex items-center justify-between px-6 py-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 text-center">{getRankBadge(entry.rank)}</div>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${getStudentAvatarColor(entry.rank)}`}>
                          {entry.studentName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{entry.studentName}</p>
                          <p className="text-xs text-muted-foreground">
                            {entry.quizzesCompleted}/{entry.totalQuizzes} quizzes completed
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-bold ${getScoreColor(entry.totalScore)}`}>
                        {entry.totalScore} pts
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
