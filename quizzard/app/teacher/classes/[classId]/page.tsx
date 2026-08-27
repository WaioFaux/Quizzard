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
        title: "Error",
        description: "Failed to load class",
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
        throw new Error(data.error || "Failed to update class");
      }

      toast({
        title: "Success",
        description: "Class updated successfully",
      });

      setIsEditDialogOpen(false);
      fetchClass();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update class",
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
        title: "Error",
        description: "Please select a file",
        variant: "destructive",
      });
      setIsUploading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("classId", classId);

      const res = await fetch("/api/materials", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to upload material");
      }

      toast({
        title: "Success",
        description: "File uploaded successfully",
      });

      setIsUploadDialogOpen(false);
      form.reset();
      fetchClass();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload file",
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
        throw new Error(data.error || "Failed to create lecture");
      }

      toast({
        title: "Success",
        description: "Lecture created successfully",
      });

      setIsLectureDialogOpen(false);
      setLectureForm({ title: "" });
      fetchClass();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create lecture",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteMaterial(materialId: string) {
    if (!confirm("Are you sure you want to delete this material? This action cannot be undone.")) {
      return;
    }

    try {
      const res = await fetch(`/api/materials/${materialId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete material");
      }

      toast({
        title: "Success",
        description: "Material deleted successfully",
      });

      fetchClass();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete material",
        variant: "destructive",
      });
    }
  }

  async function handleDeleteLecture(lectureId: string) {
    if (!confirm("Are you sure you want to delete this lecture? This will also delete any associated quiz. This action cannot be undone.")) {
      return;
    }

    try {
      const res = await fetch(`/api/lectures/${lectureId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete lecture");
      }

      toast({
        title: "Success",
        description: "Lecture deleted successfully",
      });

      fetchClass();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete lecture",
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
          <h3 className="text-lg font-semibold mb-2">Class not found</h3>
          <Button variant="outline" onClick={() => router.push("/teacher/classes")}>
            Back to Classes
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
              Classes
            </Button>
          </div>
          <h1 className="text-2xl font-bold">{cls.name}</h1>
          {cls.description && (
            <p className="text-muted-foreground mt-1">{cls.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-sm text-muted-foreground">
              Code: <span className="font-mono font-semibold">{cls.classCode}</span>
            </span>
            <Separator orientation="vertical" className="h-4" />
            <span className="text-sm text-muted-foreground">
              {cls._count.enrollments} students enrolled
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
              Edit Class
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleUpdateClass}>
              <DialogHeader>
                <DialogTitle>Edit Class</DialogTitle>
                <DialogDescription>Update class information</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Class Name</Label>
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
                  <Label htmlFor="edit-description">Description</Label>
                  <Input
                    id="edit-description"
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm({ ...editForm, description: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-password">New Password (leave blank to keep current)</Label>
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
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="lectures">Lectures</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Students
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{cls._count.enrollments}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Lectures
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{cls.lectures.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Materials
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
            <h2 className="text-lg font-semibold">Course Materials</h2>
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
                  Upload PDF
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleFileUpload}>
                  <DialogHeader>
                    <DialogTitle>Upload Material</DialogTitle>
                    <DialogDescription>
                      Upload a PDF file to create lectures from
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="file">PDF File</Label>
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
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isUploading}>
                      {isUploading ? "Uploading..." : "Upload"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {cls.materials.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-8">
              <p className="text-muted-foreground mb-4">No materials uploaded yet</p>
              <Button variant="outline" onClick={() => setIsUploadDialogOpen(true)}>
                Upload your first material
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
            <h2 className="text-lg font-semibold">Lectures</h2>
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
                  Add Lecture
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleCreateLecture}>
                  <DialogHeader>
                    <DialogTitle>Add Lecture</DialogTitle>
                    <DialogDescription>
                      Create a new lecture for this class
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="lecture-title">Lecture Title</Label>
                      <Input
                        id="lecture-title"
                        placeholder="VD: Session 1 - Introduction"
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
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "Creating..." : "Create"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {cls.lectures.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-8">
              <p className="text-muted-foreground mb-4">No lectures yet</p>
              <Button variant="outline" onClick={() => setIsLectureDialogOpen(true)}>
                Create your first lecture
              </Button>
            </Card>
          ) : (
            <div className="space-y-2">
              {cls.lectures.map((lecture) => (
                <Card
                  key={lecture.id}
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => router.push(`/teacher/classes/${classId}/quizzes/${lecture.quiz?.id || 'new'}`)}
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
                            {lecture.quiz.questionsPerAttempt} questions • {lecture.quiz.timeLimitMinutes} min
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">No quiz yet</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {lecture.quiz && getStatusBadge(lecture.quiz.status)}
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
            <h2 className="text-lg font-semibold">Enrolled Students</h2>
            <div className="text-sm text-muted-foreground">
              {cls._count.enrollments} students
            </div>
          </div>

          {cls.enrollments.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-8">
              <p className="text-muted-foreground">No students enrolled yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Share the class code <span className="font-mono font-semibold">{cls.classCode}</span> with your students
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
    </div>
  );
}
