import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function StudentClassesPage() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">My Classes</h1>
          <p className="text-muted-foreground">
            Classes you are enrolled in
          </p>
        </div>
      </div>
      <div className="grid gap-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  );
}
