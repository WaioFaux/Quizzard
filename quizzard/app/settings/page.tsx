"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { AvatarUpload } from "@/components/settings/avatar-upload";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AVAILABLE_FREE_MODELS, DEFAULT_MODEL } from "@/lib/ai/available-models";

interface User {
  id: string;
  name: string;
  email: string;
  role: "TEACHER" | "STUDENT";
  avatarUrl: string | null;
  createdAt: string;
  preferredModel?: string | null;
}

const STORAGE_KEY = "quizzard-preferred-model";

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  // Profile form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // AI Settings state
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [isSavingModel, setIsSavingModel] = useState(false);

  useEffect(() => {
    fetchUser();
    // Load saved model preference from localStorage
    const savedModel = localStorage.getItem(STORAGE_KEY);
    if (savedModel) {
      setSelectedModel(savedModel);
    } else {
      // Use default model from config
      setSelectedModel(DEFAULT_MODEL);
    }
  }, []);

  function handleAvatarUpdate(avatarUrl: string | null) {
    setUser((prev) => (prev ? { ...prev, avatarUrl } : null));
  }

  async function fetchUser() {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.data) {
        setUser(data.data);
        setName(data.data.name);
        setEmail(data.data.email);
      }
    } catch {
      toast({
        title: "Lỗi",
        description: "Không thể tải thông tin người dùng",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingProfile(true);

    try {
      const res = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to update profile");
      }

      setUser(data.data);
      toast({
        title: "Thành công",
        description: "Hồ sơ đã được cập nhật",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Lỗi",
        description: err instanceof Error ? err.message : "Không thể cập nhật hồ sơ",
        variant: "destructive",
      });
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: "Lỗi",
        description: "Mật khẩu mới không khớp",
        variant: "destructive",
      });
      return;
    }

    setIsSavingPassword(true);

    try {
      const res = await fetch("/api/users/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to change password");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      toast({
        title: "Thành công",
        description: "Mật khẩu đã được thay đổi",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Lỗi",
        description: err instanceof Error ? err.message : "Không thể thay đổi mật khẩu",
        variant: "destructive",
      });
    } finally {
      setIsSavingPassword(false);
    }
  }

  async function handleSaveModel() {
    setIsSavingModel(true);

    try {
      // Save to localStorage for now
      localStorage.setItem(STORAGE_KEY, selectedModel);

      toast({
        title: "Thành công",
        description: "Mô hình AI đã được lưu",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Lỗi",
        description: err instanceof Error ? err.message : "Không thể lưu mô hình AI",
        variant: "destructive",
      });
    } finally {
      setIsSavingModel(false);
    }
  }

  function getModelDisplayName(modelId: string): string {
    const model = AVAILABLE_FREE_MODELS.find((m) => m.id === modelId);
    return model?.name || modelId;
  }

  function formatContextLength(length: number): string {
    if (length >= 1000000) {
      return `${(length / 1000000).toFixed(0)}M tokens`;
    }
    return `${(length / 1024).toFixed(0)}K tokens`;
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("vi-VN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Cài đặt Tài khoản</h1>
      <p className="text-muted-foreground mb-6">Quản lý thông tin và bảo mật tài khoản</p>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Hồ sơ</TabsTrigger>
          <TabsTrigger value="ai">AI</TabsTrigger>
          <TabsTrigger value="security">Bảo mật</TabsTrigger>
          <TabsTrigger value="account">Tài khoản</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Thông tin hồ sơ</CardTitle>
              <CardDescription>Cập nhật ảnh đại diện, tên và email của bạn</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar Upload */}
              <div>
                <Label className="mb-2 block">Ảnh đại diện</Label>
                <AvatarUpload
                  currentAvatarUrl={user?.avatarUrl}
                  userName={user?.name}
                  onAvatarUpdate={handleAvatarUpdate}
                />
              </div>

              <Separator />

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Tên</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nhập tên của bạn"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Nhập email của bạn"
                    required
                  />
                </div>
                <Button type="submit" disabled={isSavingProfile}>
                  {isSavingProfile ? "Đang lưu..." : "Lưu thay đổi"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Tab */}
        <TabsContent value="ai">
          <Card>
            <CardHeader>
              <CardTitle>Cài đặt AI</CardTitle>
              <CardDescription>
                Chọn mô hình AI miễn phí để sử dụng cho việc tạo câu hỏi và bài giảng
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="model">Mô hình AI</Label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger id="model">
                    <SelectValue placeholder="Chọn mô hình AI" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_FREE_MODELS.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{model.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatContextLength(model.contextLength)} context
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Model Description */}
              {selectedModel && (
                <div className="rounded-lg border p-4 bg-muted/50">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{getModelDisplayName(selectedModel)}</h4>
                    <Badge variant="secondary">Miễn phí</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {AVAILABLE_FREE_MODELS.find((m) => m.id === selectedModel)?.description}
                  </p>
                </div>
              )}

              <div className="rounded-lg border p-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
                <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-2">
                  Lưu ý về giới hạn
                </h4>
                <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                  <li>• Miễn phí: 50 yêu cầu/ngày</li>
                  <li>• Với $10+ credits: 1000 yêu cầu/ngày</li>
                  <li>• Không cần thẻ tín dụng để bắt đầu</li>
                </ul>
              </div>

              <Button onClick={handleSaveModel} disabled={isSavingModel}>
                {isSavingModel ? "Đang lưu..." : "Lưu cài đặt AI"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Đổi mật khẩu</CardTitle>
              <CardDescription>
                Cập nhật mật khẩu để bảo vệ tài khoản của bạn
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Mật khẩu hiện tại</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Nhập mật khẩu hiện tại"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Mật khẩu mới</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nhập mật khẩu mới"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Mật khẩu phải có ít nhất 6 ký tự
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    required
                  />
                </div>
                <Button type="submit" disabled={isSavingPassword}>
                  {isSavingPassword ? "Đang lưu..." : "Đổi mật khẩu"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account Tab */}
        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Thông tin tài khoản</CardTitle>
              <CardDescription>
                Thông tin tài khoản của bạn
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b">
                <div>
                  <p className="text-sm font-medium">Vai trò</p>
                  <p className="text-sm text-muted-foreground">Loại tài khoản của bạn</p>
                </div>
                <Badge variant="secondary">
                  {user?.role === "TEACHER" ? "Giáo viên" : "Sinh viên"}
                </Badge>
              </div>
              <div className="flex items-center justify-between py-3 border-b">
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">Địa chỉ email của bạn</p>
                </div>
                <p className="text-sm">{user?.email}</p>
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">Ngày tạo</p>
                  <p className="text-sm text-muted-foreground">Ngày bạn đăng ký tài khoản</p>
                </div>
                <p className="text-sm">
                  {user?.createdAt ? formatDate(user.createdAt) : "—"}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
