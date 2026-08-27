"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface TeacherSidebarProps {
  teacherName?: string;
}

export function TeacherSidebar({ teacherName }: TeacherSidebarProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
      setIsLoggingOut(false);
    }
  }

  return (
    <aside className="w-64 shrink-0 border-r bg-card flex flex-col h-full">
      <div className="p-6 border-b flex items-center gap-2.5">
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="8" fill="#4F46E5"/>
          <path d="M8 14.5L12 18.5L20 9.5" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="text-base font-semibold tracking-tight">Quizzard</span>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        <a
          href="/teacher/classes"
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
          </svg>
          My Classes
        </a>
        <a
          href="/teacher/reports"
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          Reports
        </a>
      </nav>

      <div className="p-4 border-t">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-semibold">
            {teacherName?.charAt(0).toUpperCase() || "T"}
          </div>
          <div className="leading-tight">
            <p className="text-sm font-medium">{teacherName || "Teacher"}</p>
            <p className="text-xs text-slate-400">Teacher</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full flex items-center gap-2 text-xs text-slate-400 hover:text-rose-600 transition disabled:opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          {isLoggingOut ? "..." : "Đăng xuất"}
        </button>
      </div>
    </aside>
  );
}
