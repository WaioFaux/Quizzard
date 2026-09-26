import { requireAuth } from "@/lib/middleware/auth";
import { redirect } from "next/navigation";
import { TeacherSidebar } from "@/components/teacher-sidebar";
import { prisma } from "@/lib/db";

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();

  if (session.role !== "TEACHER") {
    redirect("/");
  }

  // Fetch user to get avatarUrl
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { avatarUrl: true },
  });

  return (
    <div className="flex h-screen overflow-hidden">
      <TeacherSidebar teacherName={session.name} avatarUrl={user?.avatarUrl} />
      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-background">
        {children}
      </main>
    </div>
  );
}
