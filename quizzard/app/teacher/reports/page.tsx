"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface QuestionReport {
  id: string;
  description: string;
  status: string;
  reviewNote: string | null;
  createdAt: string;
  studentAnswer: {
    isCorrect: boolean | null;
    answer: Record<string, unknown>;
    questionBankItem: {
      id: string;
      type: string;
      content: Record<string, unknown>;
    };
    attempt: {
      id: string;
      score: number;
      student: {
        id: string;
        name: string;
      };
      quiz: {
        id: string;
        lecture: {
          title: string;
          class: {
            name: string;
          };
        };
      };
    };
  };
}

export default function TeacherReportsPage() {
  const { toast } = useToast();
  const [reports, setReports] = useState<QuestionReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<QuestionReport | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  async function fetchReports() {
    try {
      const res = await fetch("/api/reports");
      const data = await res.json();
      if (data.data) {
        setReports(data.data);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load reports",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResolve(reportId: string) {
    setIsResolving(true);

    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "RESOLVED",
          reviewNote: reviewNote,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to resolve report");
      }

      toast({
        title: "Success",
        description: "Report resolved",
      });

      setSelectedReport(null);
      setReviewNote("");
      fetchReports();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to resolve report",
        variant: "destructive",
      });
    } finally {
      setIsResolving(false);
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "PENDING":
        return <Badge variant="secondary">Pending</Badge>;
      case "RESOLVED":
        return <Badge variant="default">Resolved</Badge>;
      case "DISMISSED":
        return <Badge variant="outline">Dismissed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  function getQuestionBadge(type: string) {
    const colors: Record<string, string> = {
      MCQ: "bg-blue-100 text-blue-700",
      SHORT_ANSWER: "bg-green-100 text-green-700",
      ESSAY: "bg-purple-100 text-purple-700",
      CALCULATION: "bg-orange-100 text-orange-700",
    };
    return (
      <Badge className={colors[type] || "bg-gray-100 text-gray-700"}>
        {type.replace("_", " ")}
      </Badge>
    );
  }

  const pendingReports = reports.filter((r) => r.status === "PENDING");
  const resolvedReports = reports.filter((r) => r.status !== "PENDING");

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Question Reports</h1>
            <p className="text-muted-foreground">
              Review and resolve student-reported questions
            </p>
          </div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Question Reports</h1>
          <p className="text-muted-foreground">
            Review and resolve student-reported questions
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            {pendingReports.length} pending
          </div>
        </div>
      </div>

      {reports.length === 0 ? (
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
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <h3 className="text-lg font-semibold mb-2">No reports yet</h3>
          <p className="text-muted-foreground text-center max-w-sm">
            When students report problems with questions, they will appear here
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {pendingReports.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Pending Reports</h2>
              <div className="space-y-2">
                {pendingReports.map((report) => (
                  <Card key={report.id}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {getStatusBadge(report.status)}
                            {getQuestionBadge(report.studentAnswer.questionBankItem.type)}
                            <span className="text-sm text-muted-foreground">
                              {report.studentAnswer.attempt.quiz.lecture.class.name} /{" "}
                              {report.studentAnswer.attempt.quiz.lecture.title}
                            </span>
                          </div>
                          <div className="mb-2">
                            <p className="font-medium">
                              {String(
                                report.studentAnswer.questionBankItem.content.prompt ||
                                  report.studentAnswer.questionBankItem.content.promptTemplate ||
                                  ""
                              )}
                            </p>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-3 text-sm">
                            <p className="text-muted-foreground mb-1">Student report:</p>
                            <p className="italic">"{report.description}"</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              From {report.studentAnswer.attempt.student.name} •{" "}
                              {new Date(report.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          {report.reviewNote && (
                            <div className="mt-2 text-sm">
                              <p className="text-muted-foreground">Teacher note:</p>
                              <p>{report.reviewNote}</p>
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <Dialog
                            open={selectedReport?.id === report.id}
                            onOpenChange={(open) => {
                              if (open) {
                                setSelectedReport(report);
                                setReviewNote(report.reviewNote || "");
                              } else {
                                setSelectedReport(null);
                                setReviewNote("");
                              }
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                Review
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Review Report</DialogTitle>
                                <DialogDescription>
                                  Review the student report and add your notes
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div>
                                  <h4 className="font-medium mb-2">Question:</h4>
                                  <p className="text-sm bg-muted p-3 rounded">
                                    {String(
                                      report.studentAnswer.questionBankItem.content.prompt ||
                                        report.studentAnswer.questionBankItem.content.promptTemplate ||
                                        ""
                                    )}
                                  </p>
                                </div>
                                <div>
                                  <h4 className="font-medium mb-2">Student Report:</h4>
                                  <p className="text-sm bg-muted p-3 rounded italic">
                                    "{report.description}"
                                  </p>
                                </div>
                                <div>
                                  <h4 className="font-medium mb-2">
                                    Your Notes (optional):
                                  </h4>
                                  <Textarea
                                    placeholder="Add notes about this report..."
                                    rows={3}
                                    value={reviewNote}
                                    onChange={(e) => setReviewNote(e.target.value)}
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedReport(null);
                                    setReviewNote("");
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  onClick={() => handleResolve(report.id)}
                                  disabled={isResolving}
                                >
                                  {isResolving ? "Resolving..." : "Mark as Resolved"}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {resolvedReports.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-muted-foreground">
                Resolved
              </h2>
              <div className="space-y-2">
                {resolvedReports.map((report) => (
                  <Card key={report.id} className="opacity-75">
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {getStatusBadge(report.status)}
                            {getQuestionBadge(report.studentAnswer.questionBankItem.type)}
                          </div>
                          <p className="text-sm">
                            {report.studentAnswer.attempt.student.name} reported:{" "}
                            <span className="text-muted-foreground">
                              "{report.description}"
                            </span>
                          </p>
                          {report.reviewNote && (
                            <p className="text-sm mt-1">
                              <span className="text-muted-foreground">Note:</span>{" "}
                              {report.reviewNote}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(report.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
