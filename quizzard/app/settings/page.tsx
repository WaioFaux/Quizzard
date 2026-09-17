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
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import {
  ALL_MODELS,
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  getModelsByProvider,
  formatContextLength,
  formatPrice,
  type ModelOption,
  type AIProvider,
} from "@/lib/ai/available-models";

interface User {
  id: string;
  name: string;
  email: string;
  role: "TEACHER" | "STUDENT";
  avatarUrl: string | null;
  createdAt: string;
}

const PROVIDER_STORAGE_KEY = "quizzard-ai-provider";
const MODEL_STORAGE_KEY = "quizzard-ai-model";

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
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(DEFAULT_PROVIDER);
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);
  const [isSavingAI, setIsSavingAI] = useState(false);

  // Get available models for current provider
  const availableModels = getModelsByProvider(selectedProvider);

  useEffect(() => {
    fetchUser();
    // Load saved preferences from localStorage
    const savedProvider = localStorage.getItem(PROVIDER_STORAGE_KEY) as AIProvider | null;
    const savedModel = localStorage.getItem(MODEL_STORAGE_KEY);

    if (savedProvider) {
      setSelectedProvider(savedProvider);
    }

    if (savedModel) {
      // Validate that the saved model exists and matches the provider
      const model = ALL_MODELS.find((m) => m.id === savedModel);
      if (model && model.provider === (savedProvider || DEFAULT_PROVIDER)) {
        setSelectedModel(savedModel);
      }
    }
  }, []);

  // Update model selection when provider changes
  useEffect(() => {
    const modelsForProvider = getModelsByProvider(selectedProvider);
    if (modelsForProvider.length > 0) {
      // Select first available model for the new provider
      const currentModel = ALL_MODELS.find((m) => m.id === selectedModel);
      if (!currentModel || currentModel.provider !== selectedProvider) {
        setSelectedModel(modelsForProvider[0].id);
      }
    }
  }, [selectedProvider]);

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

  async function handleSaveAI() {
    setIsSavingAI(true);

    try {
      localStorage.setItem(PROVIDER_STORAGE_KEY, selectedProvider);
      localStorage.setItem(MODEL_STORAGE_KEY, selectedModel);

      toast({
        title: "Thành công",
        description: "Cài đặt AI đã được lưu",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Lỗi",
        description: err instanceof Error ? err.message : "Không thể lưu cài đặt AI",
        variant: "destructive",
      });
    } finally {
      setIsSavingAI(false);
    }
  }

  function getModelById(modelId: string): ModelOption | undefined {
    return ALL_MODELS.find((m) => m.id === modelId);
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
                Chọn nhà cung cấp và mô hình AI cho việc tạo câu hỏi và bài giảng
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* API Key Status */}
              <div className="rounded-lg border p-4 bg-muted/30 space-y-3">
                <h4 className="font-medium">Trạng thái API Keys</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${selectedProvider === "gemini" ? "bg-green-500" : "bg-gray-300"}`} />
                    <span>Gemini</span>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {selectedProvider === "gemini" ? "Đang sử dụng" : "Có sẵn"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${selectedProvider === "openrouter" ? "bg-green-500" : "bg-gray-300"}`} />
                    <span>OpenRouter</span>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {selectedProvider === "openrouter" ? "Đang sử dụng" : "Có sẵn"}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  API keys được cấu hình trong file .env trên server
                </p>
              </div>

              {/* Provider Selection */}
              <div className="space-y-3">
                <Label>Nhà cung cấp AI</Label>
                <RadioGroup
                  value={selectedProvider}
                  onValueChange={(value) => setSelectedProvider(value as AIProvider)}
                  className="flex flex-col space-y-2"
                >
                  <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="gemini" id="gemini" />
                    <div className="flex-1">
                      <Label htmlFor="gemini" className="cursor-pointer font-medium">
                        Google Gemini
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Sử dụng API key Gemini của bạn
                      </p>
                    </div>
                    <Badge variant="outline">Miễn phí tier</Badge>
                  </div>
                  <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="openrouter" id="openrouter" />
                    <div className="flex-1">
                      <Label htmlFor="openrouter" className="cursor-pointer font-medium">
                        OpenRouter
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Truy cập nhiều mô hình khác nhau (DeepSeek, GPT, Claude, v.v.)
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              <Separator />

              {/* Model Selection */}
              <div className="space-y-3">
                <Label htmlFor="model">Mô hình AI</Label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger id="model">
                    <SelectValue placeholder="Chọn mô hình AI" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <div className="flex items-center justify-between w-full">
                          <span className="font-medium">{model.name}</span>
                          <div className="flex items-center gap-2 ml-4">
                            {model.isFree && <Badge variant="secondary">Free</Badge>}
                            <span className="text-xs text-muted-foreground">
                              {formatContextLength(model.contextLength)}
                            </span>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Model Info Panel */}
              {selectedModel && (
                <div className="rounded-lg border p-4 bg-muted/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{getModelById(selectedModel)?.name}</h4>
                    <div className="flex items-center gap-2">
                      <Badge variant={selectedProvider === "openrouter" ? "default" : "secondary"}>
                        {selectedProvider === "openrouter" ? "OpenRouter" : "Gemini"}
                      </Badge>
                      {getModelById(selectedModel)?.isFree && (
                        <Badge variant="outline">Miễn phí</Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {getModelById(selectedModel)?.description}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Context: {formatContextLength(getModelById(selectedModel)?.contextLength || 0)}</span>
                    {getModelById(selectedModel)?.price && (
                      <span>Price: {formatPrice(getModelById(selectedModel)?.price)}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Info Box */}
              <div className="rounded-lg border p-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
                <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-2">
                  Lưu ý về giới hạn
                </h4>
                <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                  <li>Gemini: 15 requests/minute, 1500 requests/day (free tier)</li>
                  <li>OpenRouter Free: 50 requests/day</li>
                  <li>OpenRouter Paid: Tùy thuộc vào mô hình và credits</li>
                </ul>
              </div>

              <Button onClick={handleSaveAI} disabled={isSavingAI}>
                {isSavingAI ? "Đang lưu..." : "Lưu cài đặt AI"}
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
