"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface QuizData {
  id: string;
  instructions: string;
  questionsPerAttempt: number;
  timeLimitMinutes: number;
  deadline: string | null;
  status: string;
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

interface PreviewQuestion {
  type: string;
  prompt?: string;
  promptTemplate?: string;
  options?: string[];
}

export default function QuizConfigPage({
  params,
}: {
  params: Promise<{ classId: string; quizId: string }>;
}) {
  const { classId, quizId } = use(params);
  const router = useRouter();
  const { toast } = useToast();

  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [previewQuestions, setPreviewQuestions] = useState<PreviewQuestion[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const [formData, setFormData] = useState({
    instructions: "",
    questionsPerAttempt: 10,
    timeLimitMinutes: 30,
  });

  useEffect(() => {
    fetchQuiz();
  }, [quizId]);

  async function fetchQuiz() {
    try {
      const res = await fetch(`/api/quizzes/${quizId}`);
      const data = await res.json();
      if (data.data) {
        setQuiz(data.data);
        setFormData({
          instructions: data.data.instructions || "",
          questionsPerAttempt: data.data.questionsPerAttempt || 10,
          timeLimitMinutes: data.data.timeLimitMinutes || 30,
        });
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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/quizzes/${quizId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save quiz");
      }

      toast({
        title: "Success",
        description: "Quiz settings saved",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save quiz",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePreview() {
    setIsGeneratingPreview(true);
    setShowPreview(true);

    try {
      const res = await fetch(`/api/quizzes/${quizId}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructions: formData.instructions }),
      });

      const data = await res.json();
      if (data.data?.questions) {
        setPreviewQuestions(data.data.questions);
      } else {
        setPreviewQuestions([]);
        toast({
          title: "Preview",
          description: "Preview not available yet. Configure and save first.",
        });
      }
    } catch (error) {
      setPreviewQuestions([]);
    } finally {
      setIsGeneratingPreview(false);
    }
  }

  function getQuestionBadge(type: string) {
    const colors: Record<string, string> = {
      MCQ: "bg-blue-100 text-blue-700",
      SHORT_ANSWER: "bg-green-100 text-green-700",
      CALCULATION: "bg-orange-100 text-orange-700",
    };
    return colors[type] || "bg-gray-100 text-gray-700";
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-8 w-64 mb-4" />
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-32" />
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
          {quiz.lecture.class.name}
        </Button>
      </div>
      <h1 className="text-2xl font-bold mb-1">{quiz.lecture.title}</h1>
      <p className="text-muted-foreground mb-6">Quiz Configuration</p>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quiz Settings</CardTitle>
              <CardDescription>
                Configure how students will take this quiz
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="instructions">AI Instructions</Label>
                  <Textarea
                    id="instructions"
                    placeholder="Describe what topics, difficulty level, and question types you want..."
                    rows={6}
                    value={formData.instructions}
                    onChange={(e) =>
                      setFormData({ ...formData, instructions: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Instructions for the AI when generating questions. Be specific about topics to cover,
                    difficulty level, and preferred question types.
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
                      value={formData.questionsPerAttempt}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          questionsPerAttempt: parseInt(e.target.value) || 1,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timelimit">Time Limit (minutes)</Label>
                    <Input
                      id="timelimit"
                      type="number"
                      min={1}
                      max={300}
                      value={formData.timeLimitMinutes}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          timeLimitMinutes: parseInt(e.target.value) || 1,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Saving..." : "Save Settings"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePreview}
                    disabled={isGeneratingPreview}
                  >
                    {isGeneratingPreview ? "Generating..." : "Preview Sample Questions"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {showPreview && (
            <Card>
              <CardHeader>
                <CardTitle>Sample Questions Preview</CardTitle>
                <CardDescription>
                  3-5 example questions generated from your instructions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {previewQuestions.length > 0 ? (
                  <div className="space-y-4">
                    {previewQuestions.map((q, idx) => (
                      <div key={idx} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <Badge className={getQuestionBadge(q.type)}>
                            {q.type.replace("_", " ")}
                          </Badge>
                        </div>
                        <p className="font-medium">
                          {String(q.prompt || q.promptTemplate || "")}
                        </p>
                        {q.type === "MCQ" && Array.isArray(q.options) && (
                          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                            {q.options.map((opt: string, i: number) => (
                              <li key={i}>• {opt}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    No preview available. Make sure to save your settings first.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quiz Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant={quiz.status === "PUBLISHED" ? "default" : "secondary"}>
                  {quiz.status === "PUBLISHED" ? "Published" : "Draft"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Questions in Bank</span>
                <span className="font-medium">{quiz._count.questionBank}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Attempts</span>
                <span className="font-medium">{quiz._count.attempts}</span>
              </div>
              {quiz.deadline && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Deadline</span>
                  <span className="font-medium">
                    {new Date(quiz.deadline).toLocaleDateString()}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => router.push(`/teacher/classes/${classId}/quizzes/${quizId}/question-bank`)}
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
                  className="mr-2"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                Question Bank ({quiz._count.questionBank})
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => router.push(`/teacher/classes/${classId}/quizzes/${quizId}/publish`)}
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
                  className="mr-2"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                Publish Quiz
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
