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
        throw new Error(data.error || "Không thể tham gia lớp");
      }

      toast({
        title: "Thành công",
        description: "Bạn đã tham gia lớp!",
      });

      router.push(`/student/classes/${data.data.class.id}`);
    } catch (error) {
      toast({
        title: "Lỗi",
        description:
          error instanceof Error ? error.message : "Không thể tham gia lớp",
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
          Lớp của tôi
        </Button>
      </div>

      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Tham gia lớp</CardTitle>
            <CardDescription>
              Nhập mã lớp và mật khẩu do giáo viên cung cấp
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="classCode">Mã lớp</Label>
                <Input
                  id="classCode"
                  placeholder="ví dụ: ABC123"
                  value={formData.classCode}
                  onChange={(e) =>
                    setFormData({ ...formData, classCode: e.target.value.toUpperCase() })
                  }
                  required
                  className="text-center text-lg font-mono tracking-wider uppercase"
                  maxLength={10}
                />
                <p className="text-xs text-muted-foreground text-center">
                  Mã lớp thường gồm 6 ký tự
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="classPassword">Mật khẩu lớp</Label>
                <Input
                  id="classPassword"
                  type="password"
                  placeholder="Nhập mật khẩu của lớp"
                  value={formData.classPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, classPassword: e.target.value })
                  }
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Đang tham gia..." : "Tham gia lớp"}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t">
              <p className="text-sm text-muted-foreground text-center">
                Chưa có mã lớp? Hãy liên hệ giáo viên của bạn để được cấp mã và mật khẩu.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
