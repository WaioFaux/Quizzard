import { getSession } from "@/lib/middleware/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function HomePage() {
  const session = await getSession();

  // If logged in, redirect to appropriate dashboard
  if (session?.userId) {
    if (session.role === "TEACHER") {
      redirect("/teacher/classes");
    } else {
      redirect("/student/classes");
    }
  }

  return (
    <div className="flex flex-col flex-1">
      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center py-24 px-8 bg-gradient-to-br from-background via-background to-muted">
        <div className="max-w-3xl text-center space-y-8">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl">
            Quizzard
          </h1>
          <p className="text-xl text-muted-foreground max-w-xl mx-auto">
            Nền tảng kiểm tra trực tuyến tích hợp AI dành cho giảng viên. Tải
            lên tài liệu bài giảng, dùng AI tạo câu hỏi và mang đến cho học sinh
            trải nghiệm làm bài tương tác hấp dẫn.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button asChild size="lg">
              <Link href="/signup">Bắt đầu</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/login">Đăng nhập</Link>
            </Button>
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section className="py-16 px-8 bg-card">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">
            Cách hoạt động
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Dành cho giáo viên</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Tải lên tài liệu bài giảng (PDF)</li>
                  <li>Cài đặt tham số cho bài kiểm tra</li>
                  <li>Xem trước và duyệt các câu hỏi do AI tạo</li>
                  <li>Công bố bài kiểm tra và theo dõi kết quả</li>
                </ol>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Dành cho học sinh</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Tham gia lớp bằng mã lớp</li>
                  <li>Xem các bài kiểm tra đang mở</li>
                  <li>Làm bài kiểm tra có đếm ngược thời gian</li>
                  <li>Kiểm tra kết quả và bảng xếp hạng</li>
                </ol>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tích hợp AI</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Nhiều dạng câu hỏi</li>
                  <li>Ngân hàng câu hỏi lấy ngẫu nhiên</li>
                  <li>Đảo thứ tự các đáp án</li>
                  <li>Câu tính toán với các số liệu động</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
