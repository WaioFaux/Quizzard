"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getAIHeaders } from "@/lib/ai/client-preferences";
import {
  GenerationPlan,
  TypeConfig,
  DifficultyLevel,
} from "@/lib/ai/qb-chat-prompts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type QuestionType = keyof Pick<GenerationPlan, "MCQ" | "SHORT_ANSWER" | "CALCULATION">;

interface GenerationStep {
  id: string;
  label: string;
  status: "pending" | "in_progress" | "completed" | "error";
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_META: Record<QuestionType, { label: string; description: string }> = {
  MCQ: {
    label: "Multiple Choice (MCQ)",
    description: "4-option multiple choice with one correct answer",
  },
  SHORT_ANSWER: {
    label: "Short Answer",
    description: "Open-ended questions with a concise correct answer",
  },
  CALCULATION: {
    label: "Calculation",
    description: "Math/physics problems with variable substitution",
  },
};

const DIFFICULTIES: DifficultyLevel[] = ["easy", "medium", "hard"];

function getDefaultTypeConfig(): TypeConfig {
  return {
    enabled: false,
    count: 0,
    distribution: { easy: 0, medium: 0, hard: 0 },
  };
}

function getDefaultPlan(): GenerationPlan {
  return {
    MCQ: { ...getDefaultTypeConfig(), enabled: true, count: 5, distribution: { easy: 2, medium: 2, hard: 1 } },
    SHORT_ANSWER: { ...getDefaultTypeConfig(), enabled: true, count: 5, distribution: { easy: 2, medium: 2, hard: 1 } },
    CALCULATION: getDefaultTypeConfig(),
  };
}

function validatePlan(plan: GenerationPlan): string | null {
  const enabledTypes = (["MCQ", "SHORT_ANSWER", "CALCULATION"] as QuestionType[]).filter(
    (t) => plan[t].enabled
  );
  if (enabledTypes.length === 0) return "Enable at least one question type.";
  for (const t of enabledTypes) {
    const cfg = plan[t];
    const { easy, medium, hard } = cfg.distribution;
    if (cfg.count < 1) return `${TYPE_META[t].label}: set a count of at least 1.`;
    if (easy + medium + hard !== cfg.count) {
      return `${TYPE_META[t].label}: easy (${easy}) + medium (${medium}) + hard (${hard}) must equal count (${cfg.count}).`;
    }
  }
  return null;
}

function getTotalCount(plan: GenerationPlan): number {
  return (["MCQ", "SHORT_ANSWER", "CALCULATION"] as QuestionType[]).reduce(
    (sum, t) => sum + (plan[t].enabled ? plan[t].count : 0),
    0
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface QBChatPanelProps {
  quizId: string;
  isOpen: boolean;
  onClose: () => void;
  onQuestionsCreated?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QBChatPanel({
  quizId,
  isOpen,
  onClose,
  onQuestionsCreated,
}: QBChatPanelProps) {
  const [plan, setPlan] = useState<GenerationPlan>(getDefaultPlan);
  const [customInstructions, setCustomInstructions] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [phase, setPhase] = useState<"idle" | "generating" | "completed" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Generation progress tracking
  const [generationSteps, setGenerationSteps] = useState<GenerationStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);

  // Session state
  const [sessionStarted, setSessionStarted] = useState(false);

  // ---------------------------------------------------------------------------
  // Start session on mount (no blocking AI call)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isOpen || sessionStarted) return;

    const start = async () => {
      try {
        const res = await fetch(`/api/quizzes/${quizId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAIHeaders() },
          body: JSON.stringify({ action: "start", quizId }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.data?.plan) {
            setPlan(data.data.plan);
            setCustomInstructions(data.data.plan.customInstructions ?? "");
          }
        }
      } catch {
        // Ignore session start errors — the panel still works with defaults
      }
      setSessionStarted(true);
    };

    start();
  }, [isOpen, quizId, sessionStarted]);

  // ---------------------------------------------------------------------------
  // Sync plan from state to local plan object
  // ---------------------------------------------------------------------------

  const planWithInstructions: GenerationPlan = {
    ...plan,
    customInstructions: customInstructions || undefined,
  };

  // ---------------------------------------------------------------------------
  // Update type config helpers
  // ---------------------------------------------------------------------------

  function updateType(type: QuestionType, updates: Partial<TypeConfig>) {
    setPlan((prev) => {
      const prevCfg = prev[type];
      const newCfg: TypeConfig = { ...prevCfg, ...updates };

      // When count changes, auto-distribute proportionally across difficulties
      if ("count" in updates && updates.count !== prevCfg.count) {
        const newCount = updates.count ?? 0;
        const dist = prevCfg.distribution;
        if (newCount === 0) {
          newCfg.distribution = { easy: 0, medium: 0, hard: 0 };
        } else {
          // Simple round-robin-ish distribution
          newCfg.distribution = { easy: 0, medium: 0, hard: 0 };
          const buckets: DifficultyLevel[] = ["easy", "medium", "hard"];
          for (let i = 0; i < newCount; i++) {
            const bucket = buckets[i % 3];
            newCfg.distribution[bucket]++;
          }
        }
      }

      return { ...prev, [type]: newCfg };
    });
  }

  function updateDistribution(type: QuestionType, difficulty: DifficultyLevel, value: number) {
    const clamped = Math.max(0, value);
    setPlan((prev) => {
      const newDist = { ...prev[type].distribution, [difficulty]: clamped };
      const newCount = newDist.easy + newDist.medium + newDist.hard;
      return {
        ...prev,
        [type]: {
          ...prev[type],
          distribution: newDist,
          count: newCount,
        },
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Suggest settings via AI (optional background call)
  // ---------------------------------------------------------------------------

  const handleSuggest = async () => {
    setIsSuggesting(true);
    try {
      const res = await fetch(`/api/quizzes/${quizId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAIHeaders() },
        body: JSON.stringify({ action: "start", quizId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.data?.plan) {
          setPlan(data.data.plan);
          setCustomInstructions(data.data.plan.customInstructions ?? "");
        }
      }
    } catch {
      // Ignore suggestion errors
    } finally {
      setIsSuggesting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Generate questions
  // ---------------------------------------------------------------------------

  function updateStep(stepId: string, status: GenerationStep["status"], errorMsg?: string) {
    setGenerationSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, status, error: errorMsg } : s))
    );
    if (status === "in_progress") {
      setGenerationSteps((prev) => {
        const idx = prev.findIndex((s) => s.id === stepId);
        setCurrentStepIndex(idx);
        return prev;
      });
    }
  }

  function buildSteps(totalBuckets: number) {
    const steps: GenerationStep[] = [
      { id: "validate", label: "Validating configuration", status: "pending" },
      ...Array.from({ length: totalBuckets }, (_, i) => ({
        id: `generate-${i}`,
        label: `Generating questions (${i + 1}/${totalBuckets})`,
        status: "pending" as const,
      })),
      { id: "recheck", label: "AI quality review", status: "pending" },
      { id: "save", label: "Saving to database", status: "pending" },
      { id: "complete", label: "Complete", status: "pending" },
    ];
    return steps;
  }

  const handleGenerate = async () => {
    const validationError = validatePlan(planWithInstructions);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    // Count active buckets
    const buckets: { type: QuestionType; difficulty: DifficultyLevel }[] = [];
    (["MCQ", "SHORT_ANSWER", "CALCULATION"] as QuestionType[]).forEach((t) => {
      if (!plan[t].enabled) return;
      DIFFICULTIES.forEach((d) => {
        if (plan[t].distribution[d] > 0) {
          buckets.push({ type: t, difficulty: d });
        }
      });
    });

    setGenerationSteps(buildSteps(buckets.length));
    setPhase("generating");

    try {
      // Step 1: Save the plan
      updateStep("validate", "in_progress");

      const saveRes = await fetch(`/api/quizzes/${quizId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAIHeaders() },
        body: JSON.stringify({ action: "savePlan", quizId, plan: planWithInstructions }),
      });

      if (!saveRes.ok) {
        const err = await saveRes.json();
        throw new Error(err.error || "Failed to save settings");
      }

      updateStep("validate", "completed");

      // Step 2: Trigger generation
      const genRes = await fetch(`/api/quizzes/${quizId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAIHeaders() },
        body: JSON.stringify({
          action: "generate",
          quizId,
          // The client owns the plan - send it back with the request.
          plan: planWithInstructions,
        }),
      });

      const genData = await genRes.json();

      if (!genRes.ok) {
        throw new Error(genData.error || "Generation failed");
      }

      // Mark all generation steps as done (the backend handles them)
      for (let i = 0; i < buckets.length; i++) {
        updateStep(`generate-${i}`, "completed");
      }
      updateStep("recheck", "completed");
      updateStep("save", "completed");
      updateStep("complete", "completed");

      setSuccessMessage(
        `${genData.data.createdQuestions ?? 0} question(s) generated successfully! Check the question bank.`
      );
      setPhase("completed");
      onQuestionsCreated?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      setError(msg);
      setPhase("error");

      // Mark current step as error
      setGenerationSteps((prev) => {
        const current = prev.find((s) => s.status === "in_progress");
        if (current) {
          return prev.map((s) =>
            s.id === current.id ? { ...s, status: "error" as const, error: msg } : s
          );
        }
        return prev;
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Close and reset
  // ---------------------------------------------------------------------------

  const handleClose = async () => {
    try {
      await fetch(`/api/quizzes/${quizId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAIHeaders() },
        body: JSON.stringify({ action: "end", quizId }),
      });
    } catch {
      // Ignore
    }
    setPhase("idle");
    setError(null);
    setSuccessMessage(null);
    setSessionStarted(false);
    onClose();
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!isOpen) return null;

  const totalCount = getTotalCount(plan);

  return (
    <div className="fixed right-0 top-0 z-50 h-full w-[420px] bg-background border-l shadow-lg flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b shrink-0">
        <div>
          <h2 className="font-semibold text-lg">Question Generator</h2>
          <p className="text-xs text-muted-foreground">
            Configure per-type and per-difficulty settings
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={handleClose}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </Button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {/* Error banner */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Success banner */}
        {successMessage && (
          <div className="mx-4 mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-md">
            <p className="text-sm text-green-700 dark:text-green-400">{successMessage}</p>
          </div>
        )}

        {/* Generation progress */}
        {phase === "generating" && (
          <div className="mx-4 mt-4 p-3 bg-muted rounded-lg space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              <p className="text-sm font-medium">Generating...</p>
            </div>
            <div className="space-y-1.5">
              {generationSteps.map((step, idx) => (
                <div key={step.id} className="flex items-center gap-2 text-xs">
                  {step.status === "completed" ? (
                    <>
                      <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                        <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-green-600 dark:text-green-400">{step.label}</span>
                    </>
                  ) : step.status === "in_progress" ? (
                    <>
                      <div className="h-4 w-4 rounded-full border-2 border-primary bg-primary/20 animate-pulse shrink-0" />
                      <span className="text-primary font-medium">{step.label}...</span>
                    </>
                  ) : step.status === "error" ? (
                    <>
                      <div className="h-4 w-4 rounded-full bg-red-500 flex items-center justify-center shrink-0">
                        <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <span className="text-red-500">{step.label}</span>
                    </>
                  ) : (
                    <>
                      <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                      <span className="text-muted-foreground/50">{step.label}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed state */}
        {phase === "completed" && (
          <div className="mx-4 mt-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setPhase("idle");
                setSuccessMessage(null);
              }}
            >
              Generate More
            </Button>
          </div>
        )}

        {/* Config form */}
        {phase !== "generating" && phase !== "completed" && (
          <div className="p-4 space-y-4">
            {/* Summary */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total questions:</span>
              <span className="font-semibold">{totalCount}</span>
            </div>

            {/* Type configs */}
            {(["MCQ", "SHORT_ANSWER", "CALCULATION"] as QuestionType[]).map((type) => {
              const meta = TYPE_META[type];
              const cfg = plan[type];

              return (
                <Card key={type}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{meta.label}</CardTitle>
                      <Button
                        variant={cfg.enabled ? "default" : "outline"}
                        size="sm"
                        onClick={() =>
                          updateType(type, {
                            enabled: !cfg.enabled,
                            count: cfg.enabled ? 0 : 5,
                            distribution: cfg.enabled
                              ? { easy: 0, medium: 0, hard: 0 }
                              : { easy: 2, medium: 2, hard: 1 },
                          })
                        }
                      >
                        {cfg.enabled ? "Enabled" : "Disabled"}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">{meta.description}</p>
                  </CardHeader>

                  {cfg.enabled && (
                    <CardContent className="space-y-3 pt-0">
                      {/* Total count */}
                      <div className="space-y-1">
                        <Label htmlFor={`${type}-count`} className="text-xs">
                          Total Count
                        </Label>
                        <Input
                          id={`${type}-count`}
                          type="number"
                          min={0}
                          max={100}
                          value={cfg.count}
                          onChange={(e) =>
                            updateType(type, { count: parseInt(e.target.value) || 0 })
                          }
                        />
                      </div>

                      {/* Difficulty distribution */}
                      <div className="space-y-1">
                        <Label className="text-xs">Difficulty Distribution</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {DIFFICULTIES.map((diff) => (
                            <div key={diff} className="space-y-1">
                              <Label className="text-xs capitalize text-muted-foreground">
                                {diff}
                              </Label>
                              <Input
                                type="number"
                                min={0}
                                max={cfg.count}
                                value={cfg.distribution[diff]}
                                onChange={(e) =>
                                  updateDistribution(type, diff, parseInt(e.target.value) || 0)
                                }
                                className="h-8 text-sm"
                              />
                            </div>
                          ))}
                        </div>
                        {/* Distribution bar */}
                        <div className="flex h-2 rounded-full overflow-hidden gap-0.5 mt-1">
                          {cfg.count > 0 ? (
                            <>
                              <div
                                className="bg-green-400 transition-all"
                                style={{ width: `${(cfg.distribution.easy / cfg.count) * 100}%` }}
                                title={`Easy: ${cfg.distribution.easy}`}
                              />
                              <div
                                className="bg-yellow-400 transition-all"
                                style={{ width: `${(cfg.distribution.medium / cfg.count) * 100}%` }}
                                title={`Medium: ${cfg.distribution.medium}`}
                              />
                              <div
                                className="bg-red-400 transition-all"
                                style={{ width: `${(cfg.distribution.hard / cfg.count) * 100}%` }}
                                title={`Hard: ${cfg.distribution.hard}`}
                              />
                            </>
                          ) : (
                            <div className="w-full bg-muted rounded-full" />
                          )}
                        </div>
                        {cfg.distribution.easy + cfg.distribution.medium + cfg.distribution.hard !== cfg.count && (
                          <p className="text-xs text-destructive">
                            Sum must equal count ({cfg.distribution.easy + cfg.distribution.medium + cfg.distribution.hard}/{cfg.count})
                          </p>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}

            {/* Custom instructions */}
            <div className="space-y-1">
              <Label htmlFor="custom-instructions" className="text-xs">
                Custom Instructions (optional)
              </Label>
              <Textarea
                id="custom-instructions"
                placeholder="e.g. Focus on Chapter 3, emphasize formulas..."
                rows={2}
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                className="text-sm"
              />
            </div>

            {/* Suggest settings button */}
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={handleSuggest}
              disabled={isSuggesting}
            >
              {isSuggesting ? (
                <>
                  <div className="animate-spin h-3 w-3 border border-current border-t-transparent rounded-full mr-2" />
                  Suggesting...
                </>
              ) : (
                "Suggest settings with AI"
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Footer actions */}
      {phase !== "generating" && phase !== "completed" && (
        <div className="p-4 border-t space-y-2 shrink-0">
          <Button
            className="w-full"
            onClick={handleGenerate}
            disabled={isLoading || totalCount === 0}
          >
            {isLoading ? "Generating..." : `Generate ${totalCount} Question${totalCount !== 1 ? "s" : ""}`}
          </Button>
        </div>
      )}
    </div>
  );
}
