import { Skeleton } from "@/components/ui/skeleton";

export default function QuizConfigPage() {
  return (
    <div className="p-6">
      <Skeleton className="h-8 w-64 mb-4" />
      <Skeleton className="h-64" />
    </div>
  );
}
