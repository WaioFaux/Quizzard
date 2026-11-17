"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
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
import { ChatPanel } from "@/components/chat-panel";
import { upload } from "@vercel/blob/client";
import { buildBlobPathname } from "@/lib/storage/blob-paths";

interface Material {
  id: string;
  fileName: string;
  status: "PROCESSING" | "PROCESSED" | "FAILED";
  uploadedAt: string;
}

interface Lecture {
  id: string;
  title: string;
  order: number;
  quiz: {
    id: string;
    status: string;
    deadline: string | null;
    questionsPerAttempt: number;
    timeLimitMinutes: number;
  } | null;
}

interface Student {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
}

interface ClassData {
  id: string;
  name: string;
  description: string | null;
  classCode: string;
  teacher: {
    id: string;
    name: string;
  };
  enrollments: Array<{
    id: string;
    student: Student;
  }>;
  lectures: Lecture[];
  materials: Material[];
  _count: {
    enrollments: number;
  };
}

export default function TeacherClassDashboardPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = use(params);
  const router = useRouter();
  const { toast } = useToast();

  const [cls, setClass] = useState<ClassData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isLectureDialogOpen, setIsLectureDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Chat panel state
  const [chatMaterialId, setChatMaterialId] = useState<string | null>(null);

  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    classPassword: "",
  });

  const [lectureForm, setLectureForm] = useState({
    title: "",
  });

  useEffect(() => {
    fetchClass();
  }, [classId]);

  async function fetchClass() {
    try {
      const res = await fetch(`/api/classes/${classId}`);
      const data = await res.json();
      if (data.data) {
        setClass(data.data);
        setEditForm({
          name: data.data.name,
          description: data.data.description || "",
          classPassword: "",
        });
      }
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể tải thông tin lớp",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdateClass(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload: Record<string, string> = {
        name: editForm.name,
      };
      if (editForm.description) {
        payload.description = editForm.description;
      }
      if (editForm.classPassword) {
        payload.classPassword = editForm.classPassword;
      }

      const res = await fetch(`/api/classes/${classId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Không thể cập nhật lớp");
      }

      toast({
        title: "Thành công",
        description: "Cập nhật lớp thành công",
      });

      setIsEditDialogOpen(false);
      fetchClass();
    } catch (error) {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể cập nhật lớp",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleFileUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsUploading(true);

    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    const file = fileInput?.files?.[0];

    if (!file) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn một tệp",
        variant: "destructive",
      });
      setIsUploading(false);
      return;
    }

    try {
      // Upload straight to the blob store from the browser: the serverless
      // request body limit is 4.5 MB, materials may be up to 50 MB.
      const pathname = buildBlobPathname("materials", file.name);
      const blob = await upload(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/materials/upload",
        clientPayload: JSON.stringify({ classId }),
        contentType: "application/pdf",
      });

      const res = await fetch("/api/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          fileName: file.name,
          url: blob.url,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Không thể tải lên tài liệu");
      }

      toast({
        title: "Thành công",
        description: "Tải lên tệp thành công",
      });

      setIsUploadDialogOpen(false);
      form.reset();
      fetchClass();
    } catch (error) {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể tải lên tệp",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }

  async function handleCreateLecture(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/lectures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          title: lectureForm.title,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Không thể tạo buổi giảng");
      }

      toast({
        title: "Thành công",
        description: "Tạo buổi giảng thành công",
      });

      setIsLectureDialogOpen(false);
      setLectureForm({ title: "" });
      fetchClass();
    } catch (error) {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể tạo buổi giảng",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteMaterial(materialId: string) {
    if (!confirm("Bạn có chắc muốn xóa tài liệu này? Hành động này không thể hoàn tác.")) {
      return;
    }

    try {
      const res = await fetch(`/api/materials/${materialId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Không thể xóa tài liệu");
      }

      toast({
        title: "Thành công",
        description: "Xóa tài liệu thành công",
      });

      fetchClass();
    } catch (error) {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể xóa tài liệu",
        variant: "destructive",
      });
    }
  }

  async function handleDeleteLecture(lectureId: string) {
    if (!confirm("Bạn có chắc muốn xóa buổi giảng này? Bài kiểm tra liên quan cũng sẽ bị xóa. Hành động này không thể hoàn tác.")) {
      return;
    }

    try {
      const res = await fetch(`/api/lectures/${lectureId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Không thể xóa buổi giảng");
      }

      toast({
        title: "Thành công",
        description: "Xóa buổi giảng thành công",
      });

      fetchClass();
    } catch (error) {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể xóa buổi giảng",
        variant: "destructive",
      });
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "DRAFT":
        return <Badge variant="secondary">Nháp</Badge>;
      case "PUBLISHED":
        return <Badge variant="default">Đã xuất bản</Badge>;
      case "PROCESSING":
        return <Badge variant="secondary">Đang xử lý</Badge>;
      case "PROCESSED":
        return <Badge variant="default">Đã xử lý</Badge>;
      case "FAILED":
        return <Badge variant="destructive">Thất bại</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
          <div className="h-64 bg-muted rounded mt-6"></div>
        </div>
      </div>
    );
  }

  if (!cls) {
    return (
      <div className="p-6">
        <Card className="flex flex-col items-center justify-center py-12">
          <h3 className="text-lg font-semibold mb-2">Không tìm thấy lớp</h3>
          <Button variant="outline" onClick={() => router.push("/teacher/classes")}>
            Quay lại danh sách lớp
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="sm" onClick={() => router.push("/teacher/classes")}>
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
              Lớp
            </Button>
          </div>
          <h1 className="text-2xl font-bold">{cls.name}</h1>
          {cls.description && (
            <p className="text-muted-foreground mt-1">{cls.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-sm text-muted-foreground">
              Mã lớp: <span className="font-mono font-semibold">{cls.classCode}</span>
            </span>
            <Separator orientation="vertical" className="h-4" />
            <span className="text-sm text-muted-foreground">
              {cls._count.enrollments} học sinh đã tham gia
            </span>
          </div>
        </div>
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
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
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Sửa lớp
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleUpdateClass}>
              <DialogHeader>
                <DialogTitle>Sửa lớp</DialogTitle>
                <DialogDescription>Cập nhật thông tin lớp</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Tên lớp</Label>
                  <Input
                    id="edit-name"
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-description">Mô tả</Label>
                  <Input
                    id="edit-description"
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm({ ...editForm, description: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-password">Mật khẩu mới (để trống nếu giữ nguyên)</Label>
                  <Input
                    id="edit-password"
                    type="password"
                    value={editForm.classPassword}
                    onChange={(e) =>
                      setEditForm({ ...editForm, classPassword: e.target.value })
                    }
                    minLength={4}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Hủy
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          <TabsTrigger value="materials">Tài liệu</TabsTrigger>
          <TabsTrigger value="lectures">Buổi giảng</TabsTrigger>
          <TabsTrigger value="students">Học sinh</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Tổng số học sinh
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{cls._count.enrollments}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Buổi giảng
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{cls.lectures.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Tài liệu
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{cls.materials.length}</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="materials" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Tài liệu môn học</h2>
            <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
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
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Tải lên PDF
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleFileUpload}>
                  <DialogHeader>
                    <DialogTitle>Tải lên tài liệu</DialogTitle>
                    <DialogDescription>
                      Tải lên tệp PDF để tạo các buổi giảng
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="file">Tệp PDF</Label>
                      <Input
                        id="file"
                        name="file"
                        type="file"
                        accept=".pdf"
                        required
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
                      Hủy
                    </Button>
                    <Button type="submit" disabled={isUploading}>
                      {isUploading ? "Đang tải lên..." : "Tải lên"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {cls.materials.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-8">
              <p className="text-muted-foreground mb-4">Chưa tải lên tài liệu nào</p>
              <Button variant="outline" onClick={() => setIsUploadDialogOpen(true)}>
                Hãy tải lên tài liệu đầu tiên của bạn
              </Button>
            </Card>
          ) : (
            <div className="space-y-2">
              {cls.materials.map((material) => (
                <Card key={material.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-muted-foreground"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <div>
                        <p className="font-medium">{material.fileName}</p>
                        <p className="text-sm text-muted-foreground">
                          Uploaded {new Date(material.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(material.status)}
                      {material.status === "PROCESSED" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setChatMaterialId(material.id)}
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
                            <path d="M12 8V4H8" />
                            <rect width="16" height="12" x="4" y="8" rx="2" />
                            <path d="M2 14h2" />
                            <path d="M20 14h2" />
                            <path d="M15 13v2" />
                            <path d="M9 13v2" />
                          </svg>
                          Trò chuyện AI
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteMaterial(material.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="lectures" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Buổi giảng</h2>
            <Dialog open={isLectureDialogOpen} onOpenChange={setIsLectureDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
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
                  Thêm buổi giảng
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleCreateLecture}>
                  <DialogHeader>
                    <DialogTitle>Thêm buổi giảng</DialogTitle>
                    <DialogDescription>
                      Tạo buổi giảng mới cho lớp này
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="lecture-title">Tiêu đề buổi giảng</Label>
                      <Input
                        id="lecture-title"
                        placeholder="VD: Buổi 1 - Giới thiệu"
                        value={lectureForm.title}
                        onChange={(e) =>
                          setLectureForm({ title: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsLectureDialogOpen(false)}>
                      Hủy
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "Đang tạo..." : "Tạo"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {cls.lectures.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-8">
              <p className="text-muted-foreground mb-4">Chưa có buổi giảng nào</p>
              <Button variant="outline" onClick={() => setIsLectureDialogOpen(true)}>
                Hãy tạo buổi giảng đầu tiên của bạn
              </Button>
            </Card>
          ) : (
            <div className="space-y-2">
              {cls.lectures.map((lecture) => (
                <Card
                  key={lecture.id}
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() =>
                    router.push(
                      `/teacher/classes/${classId}/quizzes/${lecture.quiz?.id || "new"}?lectureId=${lecture.id}`
                    )
                  }
                >
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-muted-foreground">
                        {lecture.order}
                      </span>
                      <div>
                        <p className="font-medium">{lecture.title}</p>
                        {lecture.quiz ? (
                          <p className="text-sm text-muted-foreground">
                            {lecture.quiz.questionsPerAttempt} câu hỏi • {lecture.quiz.timeLimitMinutes} phút
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Chưa có bài kiểm tra — nhấn để tạo
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {lecture.quiz && getStatusBadge(lecture.quiz.status)}
                      {!lecture.quiz && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(
                              `/teacher/classes/${classId}/quizzes/new?lectureId=${lecture.id}`
                            );
                          }}
                        >
                          Tạo bài kiểm tra
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteLecture(lecture.id);
                        }}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </Button>
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
                        className="text-muted-foreground"
                      >
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="students" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Học sinh đã tham gia</h2>
            <div className="text-sm text-muted-foreground">
              {cls._count.enrollments} học sinh
            </div>
          </div>

          {cls.enrollments.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-8">
              <p className="text-muted-foreground">Chưa có học sinh nào tham gia</p>
              <p className="text-sm text-muted-foreground mt-1">
                Chia sẻ mã lớp <span className="font-mono font-semibold">{cls.classCode}</span> với học sinh của bạn
              </p>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {cls.enrollments.map((enrollment) => (
                    <div key={enrollment.id} className="flex items-center justify-between px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-semibold">
                          {enrollment.student.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{enrollment.student.name}</p>
                          <p className="text-sm text-muted-foreground">{enrollment.student.email}</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Joined {new Date(enrollment.student.joinedAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* AI Chat Panel */}
      {chatMaterialId && (
        <ChatPanel
          materialId={chatMaterialId}
          classId={classId}
          isOpen={!!chatMaterialId}
          onClose={() => {
            setChatMaterialId(null);
            fetchClass();
          }}
          onLecturesCreated={() => fetchClass()}
        />
      )}
    </div>
  );
}
