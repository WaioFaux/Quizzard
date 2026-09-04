"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface GenerationPlan {
  count: number;
  questionTypes: string[];
  difficulty: string;
  customInstructions?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface QBChatPanelProps {
  quizId: string;
  isOpen: boolean;
  onClose: () => void;
  onQuestionsCreated?: () => void;
}

interface ChatState {
  messages: ChatMessage[];
  plan: GenerationPlan | null;
  readyToGenerate: boolean;
  phase: "configuring" | "generating" | "reviewing" | "completed";
}

interface GenerationStep {
  id: string;
  label: string;
  status: "pending" | "in_progress" | "completed" | "error";
  error?: string;
}

const QUESTION_TYPES = [
  { value: "MCQ", label: "Multiple Choice (MCQ)" },
  { value: "SHORT_ANSWER", label: "Short Answer" },
  { value: "CALCULATION", label: "Calculation" },
];

const DIFFICULTIES = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

export function QBChatPanel({
  quizId,
  isOpen,
  onClose,
  onQuestionsCreated,
}: QBChatPanelProps) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatState, setChatState] = useState<ChatState | null>(null);

  // Generation progress tracking
  const [generationSteps, setGenerationSteps] = useState<GenerationStep[]>([
    { id: "validate", label: "Validating configuration", status: "pending" },
    { id: "generate", label: "Generating questions with AI", status: "pending" },
    { id: "recheck", label: "AI quality review (blind recheck)", status: "pending" },
    { id: "save", label: "Saving questions to database", status: "pending" },
    { id: "complete", label: "Generation complete", status: "pending" },
  ]);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Plan configuration state
  const [configCount, setConfigCount] = useState(10);
  const [configTypes, setConfigTypes] = useState<string[]>(["MCQ"]);
  const [configDifficulty, setConfigDifficulty] = useState("medium");
  const [configInstructions, setConfigInstructions] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Helper function to update generation progress
  const updateGenerationStep = (stepId: string, status: GenerationStep["status"], error?: string) => {
    setGenerationSteps((prev) =>
      prev.map((step) =>
        step.id === stepId ? { ...step, status, error } : step
      )
    );
    if (status === "in_progress") {
      const stepIndex = generationSteps.findIndex((s) => s.id === stepId);
      setCurrentStepIndex(stepIndex);
    }
  };

  // Reset generation progress
  const resetGenerationProgress = () => {
    setGenerationSteps([
      { id: "validate", label: "Validating configuration", status: "pending" },
      { id: "generate", label: "Generating questions with AI", status: "pending" },
      { id: "recheck", label: "AI quality review (blind recheck)", status: "pending" },
      { id: "save", label: "Saving questions to database", status: "pending" },
      { id: "complete", label: "Generation complete", status: "pending" },
    ]);
    setCurrentStepIndex(-1);
    setGenerationError(null);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen && !chatState) {
      startSession();
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [chatState?.messages]);

  const startSession = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log("[QBChatPanel] Starting session", { quizId });

      const response = await fetch(`/api/quizzes/${quizId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          quizId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        console.error("[QBChatPanel] Session start failed:", {
          quizId,
          status: response.status,
          error: data.error,
          details: data.details,
          fullResponse: data,
          timestamp: new Date().toISOString(),
        });
        throw new Error(data.error || "Failed to start chat session");
      }

      const data = await response.json();

      setChatState({
        messages: [{ role: "assistant", content: data.data.response }],
        plan: data.data.plan,
        readyToGenerate: data.data.readyToGenerate,
        phase: "configuring",
      });

      // Update config if plan exists
      if (data.data.plan) {
        setConfigCount(data.data.plan.count);
        setConfigTypes(data.data.plan.questionTypes);
        setConfigDifficulty(data.data.plan.difficulty);
        setConfigInstructions(data.data.plan.customInstructions || "");
      }

      console.log("[QBChatPanel] Session started", {
        quizId,
        hasPlan: !!data.data.plan,
      });
    } catch (err) {
      console.error("[QBChatPanel] Error starting session:", err);
      setError(err instanceof Error ? err.message : "Failed to start chat");
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setError(null);

    // Optimistically add user message
    setChatState((prev) =>
      prev
        ? {
            ...prev,
            messages: [...prev.messages, { role: "user", content: userMessage }],
          }
        : null
    );

    setIsLoading(true);

    try {
      console.log("[QBChatPanel] Sending message", { quizId, message: userMessage });

      const response = await fetch(`/api/quizzes/${quizId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "message",
          quizId,
          message: userMessage,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        console.error("[QBChatPanel] Message send failed:", {
          quizId,
          status: response.status,
          error: data.error,
          details: data.details,
          fullResponse: data,
          timestamp: new Date().toISOString(),
        });
        throw new Error(data.error || "Failed to send message");
      }

      const data = await response.json();

      setChatState((prev) =>
        prev
          ? {
              ...prev,
              messages: [
                ...prev.messages,
                { role: "assistant", content: data.data.response },
              ],
              plan: data.data.plan || prev.plan,
              readyToGenerate: data.data.readyToGenerate,
            }
          : null
      );

      // Update config if plan changed
      if (data.data.plan) {
        setConfigCount(data.data.plan.count);
        setConfigTypes(data.data.plan.questionTypes);
        setConfigDifficulty(data.data.plan.difficulty);
        setConfigInstructions(data.data.plan.customInstructions || "");
      }

      console.log("[QBChatPanel] Message sent successfully", { quizId });
    } catch (err) {
      console.error("[QBChatPanel] Error sending message:", err);
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setIsLoading(false);
    }
  };

  const updatePlan = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log("[QBChatPanel] Updating plan", {
        quizId,
        count: configCount,
        types: configTypes,
        difficulty: configDifficulty,
      });

      const response = await fetch(`/api/quizzes/${quizId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updatePlan",
          quizId,
          plan: {
            count: configCount,
            questionTypes: configTypes,
            difficulty: configDifficulty,
            customInstructions: configInstructions || undefined,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        console.error("[QBChatPanel] Plan update failed:", {
          status: response.status,
          error: data.error,
          details: data.details,
          timestamp: new Date().toISOString(),
        });
        throw new Error(data.error || "Failed to update plan");
      }

      const data = await response.json();

      setChatState((prev) =>
        prev
          ? {
              ...prev,
              messages: [
                ...prev.messages,
                {
                  role: "assistant",
                  content: data.data.response,
                },
              ],
              plan: data.data.plan,
              readyToGenerate: data.data.readyToGenerate,
            }
          : null
      );

      console.log("[QBChatPanel] Plan updated successfully", { quizId });
    } catch (err) {
      console.error("[QBChatPanel] Error updating plan:", err);
      setError(err instanceof Error ? err.message : "Failed to update plan");
    } finally {
      setIsLoading(false);
    }
  };

  const generateQuestions = async () => {
    if (!chatState?.plan || isLoading) return;

    setIsLoading(true);
    setError(null);
    setGenerationError(null);
    setChatState((prev) => (prev ? { ...prev, phase: "generating" } : null));

    // Reset and start progress tracking
    resetGenerationProgress();
    updateGenerationStep("validate", "in_progress");

    console.log("[QBChatPanel] Starting question generation", {
      quizId,
      plan: chatState.plan,
      timestamp: new Date().toISOString(),
    });

    try {
      // Step 1: Validate configuration
      console.log("[QBChatPanel] Step 1: Validating configuration", {
        quizId,
        timestamp: new Date().toISOString(),
      });

      if (!chatState.plan.count || chatState.plan.count < 1) {
        throw new Error("Invalid question count");
      }
      if (!chatState.plan.questionTypes || chatState.plan.questionTypes.length === 0) {
        throw new Error("At least one question type must be selected");
      }

      updateGenerationStep("validate", "completed");
      updateGenerationStep("generate", "in_progress");

      // Step 2: Generate questions
      console.log("[QBChatPanel] Step 2: Calling generation API", {
        quizId,
        timestamp: new Date().toISOString(),
      });

      const response = await fetch(`/api/quizzes/${quizId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          quizId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        const errorMessage = data.error || "Failed to generate questions";
        const errorDetails = data.details || data.hint;
        
        console.error("[QBChatPanel] Generation API error:", {
          quizId,
          status: response.status,
          error: errorMessage,
          details: errorDetails,
          fullResponse: data,
          timestamp: new Date().toISOString(),
        });
        
        // Show detailed error in development
        const fullError = errorDetails 
          ? `${errorMessage}\n\nDetails: ${errorDetails}` 
          : errorMessage;
        
        throw new Error(fullError);
      }

      const data = await response.json();

      console.log("[QBChatPanel] Step 2: Questions generated", {
        quizId,
        questionCount: data.data.questions?.length ?? 0,
        createdCount: data.data.createdQuestions,
        timestamp: new Date().toISOString(),
      });

      updateGenerationStep("generate", "completed");
      updateGenerationStep("recheck", "completed"); // Recheck happens server-side

      console.log("[QBChatPanel] Step 3: Saving to database", {
        quizId,
        timestamp: new Date().toISOString(),
      });

      updateGenerationStep("save", "completed");
      updateGenerationStep("complete", "completed");

      console.log("[QBChatPanel] Generation completed successfully", {
        quizId,
        createdCount: data.data.createdQuestions,
        timestamp: new Date().toISOString(),
      });

      setChatState((prev) =>
        prev
          ? {
              ...prev,
              messages: [
                ...prev.messages,
                { role: "assistant", content: data.data.response },
              ],
              phase: "completed",
              readyToGenerate: false,
            }
          : null
      );

      // Notify parent to refresh
      onQuestionsCreated?.();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate questions";

      console.error("[QBChatPanel] Generation failed:", {
        quizId,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });

      // Mark current step as error
      const currentStep = generationSteps.find((s) => s.status === "in_progress");
      if (currentStep) {
        updateGenerationStep(currentStep.id, "error", errorMessage);
      }

      setGenerationError(errorMessage);
      setError(errorMessage);
      setChatState((prev) => (prev ? { ...prev, phase: "reviewing" } : null));
    } finally {
      setIsLoading(false);
    }
  };

  const endSession = async () => {
    try {
      console.log("[QBChatPanel] Ending session", { quizId });

      await fetch(`/api/quizzes/${quizId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "end",
          quizId,
        }),
      });
    } catch (err) {
      console.error("[QBChatPanel] Error ending session:", err);
    }

    setChatState(null);
    setError(null);
    onClose();
  };

  const toggleQuestionType = (type: string) => {
    setConfigTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 z-50 h-full w-96 bg-background border-l shadow-lg flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="font-semibold text-lg">Question Generator</h2>
          <p className="text-xs text-muted-foreground">
            Configure and generate quiz questions
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={endSession}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </Button>
      </div>

      {/* Error display */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-4">
          {chatState?.messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-4 py-2",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {isLoading && chatState?.phase !== "generating" && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-4 py-2">
                <p className="text-sm text-muted-foreground">Thinking...</p>
              </div>
            </div>
          )}

          {chatState?.phase === "generating" && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-4 py-3 w-full">
                {/* Step Progress Indicator */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                    <p className="text-sm font-medium">Generating Questions...</p>
                  </div>

                  {/* Progress Steps */}
                  <div className="space-y-1.5">
                    {generationSteps.map((step, index) => (
                      <div key={step.id} className="flex items-center gap-2 text-xs">
                        {step.status === "completed" ? (
                          <>
                            <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center">
                              <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <span className="text-green-600 dark:text-green-400">{step.label}</span>
                          </>
                        ) : step.status === "in_progress" ? (
                          <>
                            <div className="h-4 w-4 rounded-full border-2 border-primary bg-primary/20 animate-pulse"></div>
                            <span className="text-primary font-medium">{step.label}...</span>
                          </>
                        ) : step.status === "error" ? (
                          <>
                            <div className="h-4 w-4 rounded-full bg-red-500 flex items-center justify-center">
                              <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </div>
                            <span className="text-red-500">{step.label}</span>
                            {step.error && (
                              <span className="text-red-400 text-[10px] ml-1">({step.error})</span>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30"></div>
                            <span className="text-muted-foreground/50">{step.label}</span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Error Display */}
                  {generationError && (
                    <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-600 dark:text-red-400">
                      <p className="font-medium">Error: {generationError}</p>
                      <p className="text-muted-foreground mt-1">Check the browser console for more details.</p>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                    Open browser console (F12) to see detailed AI processing logs.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Configuration Panel */}
      {chatState && chatState.phase !== "completed" && (
        <div className="border-t">
          <div className="p-4 space-y-4">
            <h3 className="font-medium text-sm">Generation Settings</h3>

            {/* Count */}
            <div className="space-y-2">
              <Label htmlFor="count">Number of Questions</Label>
              <Input
                id="count"
                type="number"
                min={1}
                max={100}
                value={configCount}
                onChange={(e) => setConfigCount(parseInt(e.target.value) || 10)}
              />
            </div>

            {/* Question Types */}
            <div className="space-y-2">
              <Label>Question Types</Label>
              <div className="flex flex-wrap gap-2">
                {QUESTION_TYPES.map((type) => (
                  <Button
                    key={type.value}
                    variant={configTypes.includes(type.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleQuestionType(type.value)}
                  >
                    {type.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Difficulty */}
            <div className="space-y-2">
              <Label htmlFor="difficulty">Difficulty</Label>
              <Select value={configDifficulty} onValueChange={setConfigDifficulty}>
                <SelectTrigger id="difficulty">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTIES.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom Instructions */}
            <div className="space-y-2">
              <Label htmlFor="instructions">Custom Instructions (optional)</Label>
              <Input
                id="instructions"
                placeholder="Focus on specific topics..."
                value={configInstructions}
                onChange={(e) => setConfigInstructions(e.target.value)}
              />
            </div>

            <Button variant="outline" className="w-full" onClick={updatePlan} disabled={isLoading}>
              Update Settings
            </Button>
          </div>
        </div>
      )}

      {/* Success State */}
      {chatState?.phase === "completed" && (
        <div className="mx-4 mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-md">
          <p className="text-sm text-green-700 dark:text-green-400">
            Questions generated successfully! Check the question bank for the new questions.
          </p>
        </div>
      )}

      {/* Actions */}
      {!chatState?.createdQuestions && chatState?.readyToGenerate && (
        <div className="p-4 border-t space-y-2">
          <Button
            className="w-full"
            onClick={generateQuestions}
            disabled={isLoading || configTypes.length === 0}
          >
            {isLoading ? "Generating..." : `Generate ${configCount} Questions`}
          </Button>
        </div>
      )}

      {/* Input */}
      {!chatState?.createdQuestions && (
        <div className="p-4 border-t">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about question generation..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || !input.trim()}>
              Send
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
