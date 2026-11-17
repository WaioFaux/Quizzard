"use client";

import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AvatarUploadProps {
  currentAvatarUrl?: string | null;
  userName?: string;
  onAvatarUpdate: (avatarUrl: string | null) => void;
}

export function AvatarUpload({
  currentAvatarUrl,
  userName,
  onAvatarUpdate,
}: AvatarUploadProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn một file hình ảnh",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Lỗi",
        description: "Kích thước file quá lớn. Tối đa 2MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const res = await fetch("/api/users/avatar", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Tải lên thất bại");
      }

      onAvatarUpdate(data.data.avatarUrl);
      toast({
        title: "Thành công",
        description: "Ảnh đại diện đã được cập nhật",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Lỗi",
        description: err instanceof Error ? err.message : "Không thể tải lên ảnh",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }

  async function handleRemove() {
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("avatar", "");

      const res = await fetch("/api/users/avatar", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Xóa thất bại");
      }

      onAvatarUpdate(null);
      toast({
        title: "Thành công",
        description: "Ảnh đại diện đã được xóa",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Lỗi",
        description: err instanceof Error ? err.message : "Không thể xóa ảnh",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }

  const initial = userName?.charAt(0).toUpperCase() || "U";

  return (
    <div className="flex items-center gap-6">
      {/* Avatar Preview */}
      <div
        className={cn(
          "relative w-24 h-24 rounded-full overflow-hidden bg-muted flex items-center justify-center",
          isDragging && "ring-2 ring-primary ring-offset-2 ring-offset-background"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {currentAvatarUrl ? (
          <img
            src={currentAvatarUrl}
            alt="Ảnh đại diện"
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-3xl font-bold text-white">{initial}</span>
        )}
        {isUploading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {currentAvatarUrl ? "Đổi ảnh" : "Tải lên ảnh"}
        </Button>
        {currentAvatarUrl && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={isUploading}
            className="text-muted-foreground hover:text-destructive"
          >
            Xóa ảnh
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
          JPG, PNG, GIF, WebP. Tối đa 2MB.
        </p>
      </div>
    </div>
  );
}
