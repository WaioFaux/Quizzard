"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { QuestionType } from "@prisma/client";
import { QBChatPanel } from "@/components/qb-chat-panel";

interface Question {
  id: string;
  type: string;
  content: Record<string, unknown>;
  status: string;
  source: string;
  createdAt: string;
}

interface Quiz {
  id: string;
  status: string;
  instructions: string;
  questionsPerAttempt: number;
  lecture: {
    id: string;
    title: string;
    class: {
      id: string;
      name: string;
    };
  };
}

export default function QuestionBankPage({
  params,
}: {
  params: Promise<{ classId: string; quizId: string }>;
}) {
  const { classId, quizId } = use(params);
  const router = useRouter();
  const { toast } = useToast();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  // Chat panel state
  const [isChatOpen, setIsChatOpen] = useState(false);

  const [questionForm, setQuestionForm] = useState({
    type: "MCQ" as QuestionType,
    prompt: "",
    options: ["", "", "", ""],
    correctOptionIndex: 0,
    correctAnswer: "",
    rubric: "",
    promptTemplate: "",
    variables: "",
    answerFormula: "",
    explanation: "",
  });

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
      }
      if (questionsData.data) {
        setQuestions(questionsData.data);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleOpenChat() {
    setIsChatOpen(true);
  }

  function handleQuestionsCreated() {
    fetchData();
    setIsChatOpen(false);
  }

  async function handleAddQuestion(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let content: Record<string, unknown> = {};

      if (questionForm.type === "MCQ") {
        content = {
          type: "MCQ",
          prompt: questionForm.prompt,
          options: questionForm.options.filter((o) => o.trim()),
          correctOptionIndex: questionForm.correctOptionIndex,
          explanation: questionForm.explanation || undefined,
        };
      } else if (questionForm.type === "SHORT_ANSWER") {
        content = {
          type: "SHORT_ANSWER",
          prompt: questionForm.prompt,
          correctAnswer: questionForm.correctAnswer,
          explanation: questionForm.explanation || undefined,
        };
      } else if (questionForm.type === "CALCULATION") {
        const vars = questionForm.variables.split("\n").map((line) => {
          const [name, min, max, decimals] = line.split(",").map((s) => s.trim());
          return {
            name,
            min: parseFloat(min) || 0,
            max: parseFloat(max) || 100,
            decimals: decimals ? parseInt(decimals) : undefined,
          };
        });

        content = {
          type: "CALCULATION",
          promptTemplate: questionForm.promptTemplate,
          variables: vars,
          answerFormula: questionForm.answerFormula,
          explanation: questionForm.explanation || undefined,
        };
      }

      const res = await fetch(`/api/quizzes/${quizId}/question-bank`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: questionForm.type,
          content,
          status: "APPROVED",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add question");
      }

      toast({
        title: "Success",
        description: "Question added",
      });

      setIsAddingQuestion(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add question",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!editingQuestion) return;

    setIsSubmitting(true);

    try {
      const res = await fetch(
        `/api/quizzes/${quizId}/question-bank/${editingQuestion.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: editingQuestion.content,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update question");
      }

      toast({
        title: "Success",
        description: "Question updated",
      });

      setEditingQuestion(null);
      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update question",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateStatus(questionId: string, newStatus: string) {
    try {
      const res = await fetch(
        `/api/quizzes/${quizId}/question-bank/${questionId}/status`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update status");
      }

      toast({
        title: "Success",
        description: "Status updated",
      });

      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update status",
        variant: "destructive",
      });
    }
  }

  async function handleDeleteQuestion(questionId: string) {
    if (!confirm("Are you sure you want to delete this question?")) return;

    try {
      const res = await fetch(
        `/api/quizzes/${quizId}/question-bank/${questionId}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete question");
      }

      toast({
        title: "Success",
        description: "Question deleted",
      });

      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete question",
        variant: "destructive",
      });
    }
  }

  function resetForm() {
    setQuestionForm({
      type: "MCQ",
      prompt: "",
      options: ["", "", "", ""],
      correctOptionIndex: 0,
      correctAnswer: "",
      rubric: "",
      promptTemplate: "",
      variables: "",
      answerFormula: "",
      explanation: "",
    });
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "FLAGGED_FOR_REVIEW":
        return <Badge variant="destructive">Needs Review</Badge>;
      case "DRAFT":
        return <Badge variant="secondary">Draft</Badge>;
      case "APPROVED":
        return <Badge variant="default">Approved</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  function getTypeBadge(type: string) {
    const colors: Record<string, string> = {
      MCQ: "bg-blue-100 text-blue-700",
      SHORT_ANSWER: "bg-green-100 text-green-700",
      CALCULATION: "bg-orange-100 text-orange-700",
    };
    return (
      <Badge className={colors[type] || "bg-gray-100 text-gray-700"}>
        {type.replace("_", " ")}
      </Badge>
    );
  }

  const flaggedQuestions = questions.filter((q) => q.status === "FLAGGED_FOR_REVIEW");
  const draftQuestions = questions.filter((q) => q.status === "DRAFT");
  const approvedQuestions = questions.filter((q) => q.status === "APPROVED");

  if (isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-64 mb-6" />
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
          {quiz?.lecture?.title || "Quiz"}
        </Button>
      </div>
      <h1 className="text-2xl font-bold mb-1">Question Bank</h1>
      <p className="text-muted-foreground mb-6">
        Manage questions for this quiz
      </p>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {questions.length} total questions
          </span>
          <div className="flex items-center gap-2 text-sm">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              {flaggedQuestions.length} flagged
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
              {draftQuestions.length} draft
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              {approvedQuestions.length} approved
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleOpenChat}
            disabled={isChatOpen}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-2"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Generate with AI
          </Button>
          <Dialog open={isAddingQuestion} onOpenChange={setIsAddingQuestion}>
            <DialogTrigger asChild>
              <Button>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-2"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add Question
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleAddQuestion}>
                <DialogHeader>
                  <DialogTitle>Add New Question</DialogTitle>
                  <DialogDescription>
                    Create a new question manually
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="q-type">Question Type</Label>
                    <select
                      id="q-type"
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={questionForm.type}
                      onChange={(e) =>
                        setQuestionForm({ ...questionForm, type: e.target.value as QuestionType })
                      }
                    >
                      <option value="MCQ">Multiple Choice (MCQ)</option>
                      <option value="SHORT_ANSWER">Short Answer</option>
                      <option value="CALCULATION">Calculation</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="q-prompt">
                      {questionForm.type === "CALCULATION"
                        ? "Prompt Template"
                        : "Question Prompt"}
                    </Label>
                    <Textarea
                      id="q-prompt"
                      placeholder="Enter your question..."
                      rows={3}
                      value={
                        questionForm.type === "CALCULATION"
                          ? questionForm.promptTemplate
                          : questionForm.prompt
                      }
                      onChange={(e) => {
                        if (questionForm.type === "CALCULATION") {
                          setQuestionForm({
                            ...questionForm,
                            promptTemplate: e.target.value,
                          });
                        } else {
                          setQuestionForm({ ...questionForm, prompt: e.target.value });
                        }
                      }}
                      required
                    />
                  </div>

                  {questionForm.type === "MCQ" && (
                    <>
                      <div className="space-y-2">
                        <Label>Options</Label>
                        {questionForm.options.map((opt, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="correctOption"
                              checked={questionForm.correctOptionIndex === idx}
                              onChange={() =>
                                setQuestionForm({
                                  ...questionForm,
                                  correctOptionIndex: idx,
                                })
                              }
                            />
                            <Input
                              placeholder={`Option ${idx + 1}`}
                              value={opt}
                              onChange={(e) => {
                                const newOptions = [...questionForm.options];
                                newOptions[idx] = e.target.value;
                                setQuestionForm({ ...questionForm, options: newOptions });
                              }}
                            />
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setQuestionForm({
                              ...questionForm,
                              options: [...questionForm.options, ""],
                            })
                          }
                        >
                          Add Option
                        </Button>
                      </div>
                    </>
                  )}

                  {questionForm.type === "SHORT_ANSWER" && (
                    <div className="space-y-2">
                      <Label htmlFor="correct-answer">Correct Answer</Label>
                      <Input
                        id="correct-answer"
                        value={questionForm.correctAnswer}
                        onChange={(e) =>
                          setQuestionForm({
                            ...questionForm,
                            correctAnswer: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                  )}

                  {questionForm.type === "CALCULATION" && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="formula">Answer Formula</Label>
                        <Input
                          id="formula"
                          placeholder="e.g., (a - b) / a * 100"
                          value={questionForm.answerFormula}
                          onChange={(e) =>
                            setQuestionForm({
                              ...questionForm,
                              answerFormula: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="variables">
                          Variables (name, min, max, decimals per line)
                        </Label>
                        <Textarea
                          id="variables"
                          placeholder="a, 10, 100&#10;b, 5, 50, 2"
                          rows={3}
                          value={questionForm.variables}
                          onChange={(e) =>
                            setQuestionForm({
                              ...questionForm,
                              variables: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="explanation">Explanation (optional)</Label>
                    <Textarea
                      id="explanation"
                      placeholder="Explanation for the correct answer..."
                      rows={2}
                      value={questionForm.explanation}
                      onChange={(e) =>
                        setQuestionForm({ ...questionForm, explanation: e.target.value })
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAddingQuestion(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Adding..." : "Add Question"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="flagged" className="space-y-4">
        <TabsList>
          <TabsTrigger value="flagged">
            Needs Review ({flaggedQuestions.length})
          </TabsTrigger>
          <TabsTrigger value="draft">
            Draft ({draftQuestions.length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved ({approvedQuestions.length})
          </TabsTrigger>
        </TabsList>

        {[
          { key: "flagged", questions: flaggedQuestions },
          { key: "draft", questions: draftQuestions },
          { key: "approved", questions: approvedQuestions },
        ].map((tab) => (
          <TabsContent key={tab.key} value={tab.key}>
            {tab.questions.length === 0 ? (
              <Card className="flex flex-col items-center justify-center py-8">
                <p className="text-muted-foreground">
                  No {tab.key === "flagged" ? "questions need review" : tab.key === "draft" ? "draft questions" : "approved questions"}
                </p>
              </Card>
            ) : (
              <div className="space-y-2">
                {tab.questions.map((question) => (
                  <Card key={question.id}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {getTypeBadge(question.type)}
                            {getStatusBadge(question.status)}
                          </div>
                          <p className="font-medium">
                            {String(
                              question.content.prompt ||
                                question.content.promptTemplate ||
                                ""
                            )}
                          </p>
                          {expandedQuestion === question.id && (
                            <div className="mt-4 space-y-2 text-sm">
                              {question.content.explanation && (
                                <p className="text-muted-foreground">
                                  <strong>Explanation:</strong>{" "}
                                  {String(question.content.explanation)}
                                </p>
                              )}
                              {Array.isArray(question.content.options) && (
                                <div>
                                  <strong>Options:</strong>
                                  <ul className="ml-4 mt-1 space-y-1">
                                    {(question.content.options as string[]).map(
                                      (opt: string, i: number) => (
                                        <li
                                          key={i}
                                          className={
                                            question.content.correctOptionIndex === i
                                              ? "text-green-600 font-medium"
                                              : ""
                                          }
                                        >
                                          {i + 1}. {opt}
                                          {question.content.correctOptionIndex === i &&
                                            " (correct)"}
                                        </li>
                                      )
                                    )}
                                  </ul>
                                </div>
                              )}
                              {question.content.correctAnswer && (
                                <p className="text-green-600">
                                  <strong>Correct Answer:</strong>{" "}
                                  {String(question.content.correctAnswer)}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setExpandedQuestion(
                                expandedQuestion === question.id ? null : question.id
                              )
                            }
                          >
                            {expandedQuestion === question.id ? "Less" : "More"}
                          </Button>
                          {tab.key !== "approved" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleUpdateStatus(question.id, "APPROVED")
                              }
                            >
                              Approve
                            </Button>
                          )}
                          {tab.key === "flagged" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleUpdateStatus(question.id, "DRAFT")
                              }
                            >
                              Reset to Draft
                            </Button>
                          )}
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteQuestion(question.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* AI Chat Panel for Question Generation */}
      <QBChatPanel
        quizId={quizId}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        onQuestionsCreated={handleQuestionsCreated}
      />
    </div>
  );
}
