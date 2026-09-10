import { requireAuth } from "@/lib/middleware/auth";
import { redirect } from "next/navigation";
import { StudentSidebar } from "@/components/student-sidebar";
import { TeacherSidebar } from "@/components/teacher-sidebar";
import { prisma } from "@/lib/db";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();

  // Fetch user to get avatarUrl
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { avatarUrl: true },
  });

  return (
    <div className="flex h-screen overflow-hidden">
      {session.role === "STUDENT" ? (
        <StudentSidebar studentName={session.name} avatarUrl={user?.avatarUrl} />
      ) : (
        <TeacherSidebar teacherName={session.name} avatarUrl={user?.avatarUrl} />
      )}
      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-slate-950">
        {children}
      </main>
    </div>
  );
}
