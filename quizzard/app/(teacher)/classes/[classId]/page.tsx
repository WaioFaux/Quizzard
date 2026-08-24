import { Skeleton } from "@/components/ui/skeleton";

export default function TeacherClassDashboardPage() {
  return (
    <div className="p-6">
      <Skeleton className="h-8 w-64 mb-4" />
      <Skeleton className="h-4 w-96 mb-6" />
      <div className="grid gap-4">
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
