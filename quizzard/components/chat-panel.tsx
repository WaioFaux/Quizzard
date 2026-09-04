"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface LectureProposal {
  title: string;
  startPage: number;
  endPage: number;
  description?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatPanelProps {
  materialId: string;
  classId: string;
  isOpen: boolean;
  onClose: () => void;
  onLecturesCreated?: () => void;
}

interface ChatState {
  messages: ChatMessage[];
  proposals: LectureProposal[];
  readyToConfirm: boolean;
  createdLectures?: Array<{ lectureId: string; quizId: string }>;
}

export function ChatPanel({
  materialId,
  classId,
  isOpen,
  onClose,
  onLecturesCreated,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatState, setChatState] = useState<ChatState | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedProposals, setEditedProposals] = useState<LectureProposal[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      const response = await fetch(`/api/materials/${materialId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          materialId,
          classId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to start chat session");
      }

      const data = await response.json();
      setChatState({
        messages: [{ role: "assistant", content: data.data.response }],
        proposals: data.data.proposals || [],
        readyToConfirm: data.data.readyToConfirm,
      });
    } catch (err) {
      console.error("[ChatPanel] Error starting session:", err);
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
      const response = await fetch(`/api/materials/${materialId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "message",
          materialId,
          message: userMessage,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
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
              proposals: data.data.proposals || prev.proposals,
              readyToConfirm: data.data.readyToConfirm,
            }
          : null
      );
    } catch (err) {
      console.error("[ChatPanel] Error sending message:", err);
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setIsLoading(false);
    }
  };

  const confirmPlan = async () => {
    if (!chatState?.proposals.length || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/materials/${materialId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          materialId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to confirm plan");
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
              readyToConfirm: false,
              createdLectures: data.data.createdLectures,
            }
          : null
      );

      // Notify parent to refresh lectures list
      onLecturesCreated?.();
    } catch (err) {
      console.error("[ChatPanel] Error confirming plan:", err);
      setError(err instanceof Error ? err.message : "Failed to confirm plan");
    } finally {
      setIsLoading(false);
    }
  };

  const saveEditedProposals = async () => {
    if (!editedProposals.length || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/materials/${materialId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          materialId,
          proposals: editedProposals,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update proposals");
      }

      const data = await response.json();
      setChatState((prev) =>
        prev
          ? {
              ...prev,
              proposals: data.data.proposals,
              messages: [
                ...prev.messages,
                {
                  role: "assistant",
                  content: "I've updated the lecture proposals based on your changes.",
                },
              ],
            }
          : null
      );
      setIsEditing(false);
    } catch (err) {
      console.error("[ChatPanel] Error updating proposals:", err);
      setError(err instanceof Error ? err.message : "Failed to update proposals");
    } finally {
      setIsLoading(false);
    }
  };

  const endSession = async () => {
    try {
      await fetch(`/api/materials/${materialId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "end",
          materialId,
        }),
      });
    } catch (err) {
      console.error("[ChatPanel] Error ending session:", err);
    }

    setChatState(null);
    setError(null);
    onClose();
  };

  const startEditing = () => {
    setEditedProposals([...chatState!.proposals]);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setEditedProposals([]);
    setIsEditing(false);
  };

  const updateEditedProposal = (
    index: number,
    field: keyof LectureProposal,
    value: string | number
  ) => {
    const updated = [...editedProposals];
    updated[index] = { ...updated[index], [field]: value };
    setEditedProposals(updated);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 z-50 h-full w-96 bg-background border-l shadow-lg flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="font-semibold text-lg">AI Lecture Planner</h2>
          <p className="text-xs text-muted-foreground">Plan lectures from your document</p>
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

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-4 py-2">
                <p className="text-sm text-muted-foreground">Thinking...</p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Proposals Section */}
      {chatState?.proposals.length && chatState.proposals.length > 0 ? (
        <div className="border-t">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm">Lecture Proposals</h3>
              {!isEditing && !chatState.createdLectures && (
                <Button variant="ghost" size="sm" onClick={startEditing}>
                  Edit
                </Button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {editedProposals.map((proposal, i) => (
                  <Card key={i} className="p-3">
                    <div className="space-y-2">
                      <Input
                        value={proposal.title}
                        onChange={(e) =>
                          updateEditedProposal(i, "title", e.target.value)
                        }
                        placeholder="Lecture title"
                        className="h-8"
                      />
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          value={proposal.startPage}
                          onChange={(e) =>
                            updateEditedProposal(i, "startPage", parseInt(e.target.value) || 0)
                          }
                          placeholder="Start"
                          className="w-20 h-8"
                        />
                        <span className="self-center text-muted-foreground">to</span>
                        <Input
                          type="number"
                          value={proposal.endPage}
                          onChange={(e) =>
                            updateEditedProposal(i, "endPage", parseInt(e.target.value) || 0)
                          }
                          placeholder="End"
                          className="w-20 h-8"
                        />
                      </div>
                    </div>
                  </Card>
                ))}
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveEditedProposals} disabled={isLoading}>
                    Save Changes
                  </Button>
                  <Button variant="ghost" size="sm" onClick={cancelEditing}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {chatState.proposals.map((proposal, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{proposal.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Pages {proposal.startPage}-{proposal.endPage}
                      </p>
                    </div>
                    <Badge variant="secondary" className="ml-2 shrink-0">
                      {i + 1}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Success message when lectures created */}
      {chatState?.createdLectures && chatState.createdLectures.length > 0 && (
        <div className="mx-4 mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-md">
          <p className="text-sm text-green-700 dark:text-green-400">
            Successfully created {chatState.createdLectures.length} lecture(s) with quiz drafts!
          </p>
        </div>
      )}

      {/* Actions */}
      {!chatState?.createdLectures && (
        <div className="p-4 border-t space-y-2">
          {chatState?.readyToConfirm && (
            <Button
              className="w-full"
              onClick={confirmPlan}
              disabled={isLoading}
            >
              {isLoading ? "Generating..." : "Confirm Plan"}
            </Button>
          )}
        </div>
      )}

      {/* Input */}
      {!chatState?.createdLectures && (
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
              placeholder="Ask about the document or request changes..."
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
