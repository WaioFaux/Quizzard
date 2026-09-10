import { requireAuth } from "@/lib/middleware/auth";
import { redirect } from "next/navigation";
import { StudentSidebar } from "@/components/student-sidebar";
import { TeacherSidebar } from "@/components/teacher-sidebar";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();

  return (
    <div className="flex h-screen overflow-hidden">
      {session.role === "STUDENT" ? (
        <StudentSidebar studentName={session.name} />
      ) : (
        <TeacherSidebar teacherName={session.name} />
      )}
      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-slate-950">
        {children}
      </main>
    </div>
  );
}
