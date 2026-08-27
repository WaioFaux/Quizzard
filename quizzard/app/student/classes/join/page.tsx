"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function JoinClassPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    classCode: "",
    classPassword: "",
  });

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // The API endpoint uses classCode in the URL path
      const res = await fetch(`/api/classes/${formData.classCode}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classCode: formData.classCode,
          classPassword: formData.classPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to join class");
      }

      toast({
        title: "Success",
        description: "You've joined the class!",
      });

      router.push(`/student/classes/${data.data.class.id}`);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to join class",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/student/classes")}
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
          My Classes
        </Button>
      </div>

      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Join a Class</CardTitle>
            <CardDescription>
              Enter the class code and password provided by your teacher
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="classCode">Class Code</Label>
                <Input
                  id="classCode"
                  placeholder="e.g., ABC123"
                  value={formData.classCode}
                  onChange={(e) =>
                    setFormData({ ...formData, classCode: e.target.value.toUpperCase() })
                  }
                  required
                  className="text-center text-lg font-mono tracking-wider uppercase"
                  maxLength={10}
                />
                <p className="text-xs text-muted-foreground text-center">
                  The class code is usually 6 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="classPassword">Class Password</Label>
                <Input
                  id="classPassword"
                  type="password"
                  placeholder="Enter the class password"
                  value={formData.classPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, classPassword: e.target.value })
                  }
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Joining..." : "Join Class"}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t">
              <p className="text-sm text-muted-foreground text-center">
                Don't have a class code? Contact your teacher to get the code and password.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
