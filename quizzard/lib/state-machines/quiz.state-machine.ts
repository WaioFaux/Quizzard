import { QuizStatus } from "@prisma/client";
import { IllegalTransitionError } from "../utils/errors";

type QuizTransition = {
  from: QuizStatus;
  to: QuizStatus;
};

const LEGAL_TRANSITIONS: QuizTransition[] = [
  { from: QuizStatus.DRAFT, to: QuizStatus.PUBLISHED },
];

export function transitionQuiz(from: QuizStatus, to: QuizStatus): void {
  const isLegal = LEGAL_TRANSITIONS.some(
    (t) => t.from === from && t.to === to
  );

  if (!isLegal) {
    throw new IllegalTransitionError("Quiz", from, to);
  }
}
