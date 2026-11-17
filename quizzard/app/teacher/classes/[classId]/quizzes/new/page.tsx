import { NewQuizForm } from "./new-quiz-form";

export default async function NewQuizPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ lectureId?: string }>;
}) {
  const { classId } = await params;
  const { lectureId } = await searchParams;

  return <NewQuizForm classId={classId} lectureId={lectureId ?? null} />;
}
